# Feature: 4-Day Programs with Overhead Press

**Status**: Planned
**Date**: 9 Mar 2026

## Overview

Add overhead press (OHP) as a first-class primary lift and support 4-day training programs. Currently the system hardcodes 3 lifts (squat/bench/deadlift) throughout: type system, cube scheduler, program generator, onboarding, and all UI screens. This feature makes the lift list dynamic per program, adds OHP-specific engine logic, and lets users choose between 3-day and 4-day programs during program creation.

## Problem Statement

**Pain points:**
- The `Lift` type is `'squat' | 'bench' | 'deadlift'` — OHP cannot be a primary lift even though it's a standard compound lift in powerbuilding programs.
- Historical data from imports contains 22 completed OHP sessions. The DB constraint already allows `overhead_press`, but the app ignores it.
- 4-day programs (Mon/Tue/Thu/Sat) are common. The cube scheduler already defines `DEFAULT_TRAINING_DAYS[4]`, but the lift rotation always cycles through 3 lifts, meaning day 4 would repeat squat instead of introducing OHP.
- Users who train 4 days/week are forced into a 3-lift rotation that doesn't match their real programming.

**Desired outcome:** Users can create a 4-day program where OHP is the 4th primary lift. The cube method rotation extends naturally to 4 lifts. All downstream systems (JIT, soreness, volume, warmups, auxiliary exercises) handle OHP correctly.

## User Experience

### User Flows

**Flow A — Program Creation (4-day):**

1. During onboarding or "New Program", user reaches the program settings step
2. A "Training Days" selector shows 3, 4, or 5 days/week options (currently only 3 is supported)
3. User selects 4 days
4. An additional screen or section appears to collect OHP 1RM (same format as squat/bench/deadlift maxes)
5. Program is generated with 4 lifts rotating across 4 days

**Flow B — Session with OHP:**

1. User's scheduled session for the day has `primary_lift: 'overhead_press'`
2. Soreness check-in shows OHP-relevant muscles (shoulders, triceps, upper back)
3. JIT generates workout using OHP loading percentages, warmup protocol, and auxiliary pool
4. Session logging, completion, and history all work identically to S/B/D sessions

**Alternative Flows:**
- 3-day programs remain unchanged — `LIFT_ORDER` is `['squat', 'bench', 'deadlift']` as today
- Existing programs are unaffected by the migration
- Historical OHP sessions from imports display correctly with proper labels

### Visual Design Notes

- **Training day selector**: Pill row (3 / 4 / 5) in program creation, same style as existing readiness pills
- **OHP lift label**: "Overhead Press" (full) or "OHP" (abbreviated where space is tight)
- **OHP lift color**: A 4th distinct color for charts and history (suggest purple/violet — S=blue, B=green, D=red, OHP=purple)

## What Already Works

These pieces require no changes:
- **4-day scheduling**: `DEFAULT_TRAINING_DAYS[4] = [1, 2, 4, 6]` (Mon/Tue/Thu/Sat) already exists in `scheduler.ts`
- **OHP muscle mapping**: `EXERCISE_MUSCLES['Overhead Press']` is defined in `muscle-mapper.ts` (shoulders 1.0, triceps 1.0, upper back 0.5)
- **DB constraints**: Migration `20260315` already adds `overhead_press` to `sessions.primary_lift` and `auxiliary_exercises.lift` constraints
- **Generic session scaffolding**: `generateWeekSessions()` works with any `dayOffsets.length`
- **Unending program mode**: Structurally generic — rotation just needs a longer lift list

## Core Design Decision: Lift Rotation

**Current** — 3 lifts × 3 intensity types = 3-week block cycle:
```
Week 1: squat=heavy,    bench=rep,       deadlift=explosive
Week 2: squat=explosive, bench=heavy,     deadlift=rep
Week 3: squat=rep,       bench=explosive, deadlift=heavy
```

**Proposed** — Configurable lift list per program. `LIFT_ORDER` becomes a program-level property rather than a global constant. For a 4-lift program, the rotation extends naturally:

```
Week 1: squat=heavy,    bench=rep,       deadlift=explosive, ohp=heavy
Week 2: squat=explosive, bench=heavy,     deadlift=rep,       ohp=explosive
Week 3: squat=rep,       bench=explosive, deadlift=heavy,     ohp=rep
```

Each lift cycles through heavy → explosive → rep across weeks (same 3-week block), but with 4 training days per week. The 4th lift follows the same intensity pattern as the 1st (offset by 3 positions in the rotation).

This approach:
- Preserves backward compatibility for 3-lift programs
- Doesn't require a 4-week block structure
- Keeps the deload cadence unchanged

## What We Chose NOT To Do

- **No arbitrary lift selection**: Users pick 3 or 4 days. 4 days always means S/B/D/OHP. We don't support "pick any 3 of 4" or custom lift combinations — that level of configurability adds complexity without improving training outcomes.
- **No 5-day programs yet**: Although `DEFAULT_TRAINING_DAYS[5]` exists, 5-day programming introduces questions about lift frequency and recovery that aren't needed now.
- **No OHP-specific deload logic**: OHP uses the same deload rules as the other lifts.
- **No feature flag**: Ships as a single batch when all pieces are ready.

## Blast Radius (~30 files)

### Type System (2 files)
| File | Change |
|------|--------|
| `packages/shared-types/src/program.schema.ts` | Add `'overhead_press'` to `LiftSchema` |
| `packages/shared-types/src/lifter-maxes.schema.ts` | Add optional `overhead_press` field to `LifterMaxesInputSchema` + `overhead_press_kg` to response |

### Engine (6 files)
| File | Change |
|------|--------|
| `packages/training-engine/src/cube/scheduler.ts` | Extend `CUBE_ROTATION` for 4-lift variant |
| `packages/training-engine/src/cube/blocks.ts` | Add `overhead_press_min/max` to `FormulaConfig.training_max_increase` defaults |
| `packages/training-engine/src/generator/program-generator.ts` | `LIFT_ORDER` becomes dynamic from program config |
| `packages/training-engine/src/auxiliary/exercise-catalog.ts` | Add OHP auxiliary exercise pool |
| `packages/training-engine/src/auxiliary/auxiliary-rotator.ts` | Loop over dynamic lift list, not hardcoded 3 |
| `packages/training-engine/src/volume/muscle-mapper.ts` | Add `LIFT_MUSCLES.overhead_press` entry |

### Schemas (2 files)
| File | Change |
|------|--------|
| `packages/shared-types/src/formula.schema.ts` | Add `overhead_press_min/max` to `training_max_increase` |
| `packages/shared-types/src/disruption.schema.ts` | Add `'overhead_press'` to `affected_lifts` enum |

### App Constants & Services (5 files)
| File | Change |
|------|--------|
| `apps/.../shared/constants/training.ts` | Add OHP to `TRAINING_LIFTS`, `LIFT_LABELS`, `LIFT_PRIMARY_SORENESS_MUSCLES` |
| `apps/.../modules/settings/lib/warmup-config.ts` | Add OHP warmup defaults |
| `apps/.../modules/program/lib/auxiliary-config.ts` | Fetch OHP auxiliary pool |
| `apps/.../modules/jit/lib/max-estimation.ts` | Add OHP bodyweight multipliers + min estimated max |
| `apps/.../modules/disruptions/lib/disruption-presets.ts` | Auto-inherits from `TRAINING_LIFTS` |

### UI Screens (8 files)
| File | Change |
|------|--------|
| `app/(auth)/onboarding/lift-maxes.tsx` | Conditionally collect OHP max when 4-day selected |
| `app/settings/auxiliary-exercises.tsx` | Show OHP pool tab |
| `app/settings/aux-block-assignments.tsx` | OHP block assignments |
| `app/settings/warmup-protocol.tsx` | OHP warmup picker |
| `app/(tabs)/history.tsx` | OHP label + color |
| `app/history/lift/[lift].tsx` | OHP label + color |
| `app/history/[sessionId].tsx` | OHP label |
| `app/(tabs)/session/soreness.tsx` | OHP primary muscles (auto from constant) |

### Tests (~5 files)
- `scheduler.test.ts`, `program-generator.test.ts`, `auxiliary-rotator.test.ts`, `blocks.test.ts`, `muscle-mapper.test.ts`

## Spec Breakdown

| Spec ID | Title | Layer |
|---------|-------|-------|
| types-003 | Add `overhead_press` to Lift enum | shared-types |
| engine-036 | 4-lift cube rotation | training-engine |
| engine-037 | OHP formula config defaults (training max increase: 1.25–2.5 kg) | training-engine |
| engine-038 | OHP auxiliary exercise catalog | training-engine |
| engine-039 | OHP muscle mapping for primary lift volume | training-engine |
| mobile-043 | OHP onboarding + app services | mobile |
| mobile-044 | OHP UI across screens | mobile |
| data-009 | OHP lifter maxes schema + migration | data |

## Open Questions

- What are appropriate OHP training max increase defaults? Likely 1.25–2.5 kg (smaller than S/D at 5–10 kg, similar to bench at 2.5–5 kg).
- What warmup preset for OHP? Lighter working set % than squat/deadlift. Likely matches bench warmup profile but with lower bar weight.
- Should OHP bodyweight multiplier for max estimation be ~0.5× (male) / ~0.35× (female)?

## Future Enhancements

- **5-day programs**: Once 4-day works, extending to 5 days (with a repeated lift or accessory day) becomes straightforward.
- **Custom lift selection**: Let users pick which lifts to include rather than tying it to day count.
- **OHP-specific performance thresholds**: Tune RPE thresholds for OHP (may differ from the big 3 due to smaller absolute loads).

## References

- Related Design Docs: [volume-mrv-methodology.md](./volume-mrv-methodology.md), [sex-based-adaptations.md](./sex-based-adaptations.md)
- Cube Method: Each lift cycles through intensity types across weeks; extending to 4 lifts preserves this structure
