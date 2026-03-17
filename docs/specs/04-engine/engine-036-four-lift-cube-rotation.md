# Spec: 4-Lift Cube Rotation

**Status**: Planned

**Domain**: Training Engine

## What This Covers

Extends the cube method rotation to support 4 lifts (S/B/D/OHP). OHP follows the same 3-week intensity cycle as squat: heavy → explosive → rep. The `LIFTS` constant expands from 3 to 4 entries, and `CUBE_ROTATION` gains an OHP column.

## Tasks

**`packages/training-engine/src/auxiliary/exercise-catalog.ts`:**

- [ ] Add `'overhead_press'` to `LIFTS` array → `['squat', 'bench', 'deadlift', 'overhead_press']`

**`packages/training-engine/src/cube/scheduler.ts`:**

- [ ] Add `overhead_press` to each `CUBE_ROTATION` week:
  - Week 1: `overhead_press: 'heavy'`
  - Week 2: `overhead_press: 'explosive'`
  - Week 3: `overhead_press: 'rep'`

**`packages/training-engine/src/generator/program-generator.ts`:**

- [ ] Change hardcoded `const lifts: Lift[] = ['squat', 'bench', 'deadlift']` in `generateAuxiliaryAssignments` to use imported `LIFTS`

**Tests (`packages/training-engine/src/cube/scheduler.test.ts`):**

- [ ] Test `getIntensityTypeForWeek` returns correct intensity for `'overhead_press'` across all 3 weeks
- [ ] Verify `DEFAULT_TRAINING_DAYS[4]` produces 4-day schedule

**Tests (`packages/training-engine/src/generator/program-generator.test.ts`):**

- [ ] Test 4-day program generation: verify OHP appears on day 4
- [ ] Test `nextUnendingSession` cycles through 4 lifts (S→B→D→OHP→S→...)
- [ ] Test `generateAuxiliaryAssignments` produces assignments for all 4 lifts

## Notes

- 3-day programs are unaffected: `dayIndex` 0,1,2 with `LIFTS.length=4` → `0%4=0`, `1%4=1`, `2%4=2` → squat, bench, deadlift (same as before)
- `generateWeekSessions` and `generateDeloadWeek` already use `LIFTS[dayIndex % LIFTS.length]` — no code change needed in those functions
- `nextUnendingSession` uses `LIFTS[index % LIFTS.length]` — automatically cycles through 4 lifts
- `auxiliary-rotator.ts` loops over `LIFTS` dynamically — no change needed

## Dependencies

- types-003 (Lift enum must include `'overhead_press'`)
