# engine-026: EMG-Based Muscle Contribution Weights + RPE Volume Scaling

## Status: Planned

## Context

The current muscle contribution weights in `EXERCISE_MUSCLES` (and `LIFT_MUSCLES`) use a binary 1.0 / 0.5 model — 1.0 for primary movers, 0.5 for significant secondary muscles. This was a deliberate starting point consistent with the RP Strength "hard set" counting framework, but it is a coarse approximation.

EMG (electromyography) research provides measured muscle activation percentages for specific exercises, which would let us assign more accurate fractional weights (e.g. 0.75, 0.25, 0.0) for each muscle's contribution to a set.

**Why it matters:** Inaccurate weights cause MRV to be miscounted. For example:

- **Leg Press** currently counts glutes at 0.5, but the hip is not at full extension under load — actual glute activation is much lower than a squat
- **Good Mornings** counts lower_back at 0.5, but it is arguably the primary mover — should be 1.0
- **Dips** (chest-leaning) vs **Dips** (upright) differ significantly in chest vs. triceps split
- **Sumo DL** has higher quad activation than conventional but less hamstring — the current split may be reversed

## Research Task

Before writing any code, research and document the correct contribution weights for each exercise. Use literature, not estimates.

### Primary sources (in order of preference)

1. **Bret Contreras EMG studies** — the most comprehensive applied EMG database for strength exercises. See bretcontreras.com, and papers published in _Journal of Strength and Conditioning Research_.
2. **Brad Schoenfeld** — _Science and Development of Muscle Hypertrophy_ (2nd ed.), exercise-specific EMG appendix.
3. **NSCA Essentials of Strength Training and Conditioning** — biomechanics chapters per exercise.
4. **PubMed** — search `[exercise name] EMG activation` for peer-reviewed studies.

### What to record per exercise

For each exercise in `EXERCISE_MUSCLES`, find the mean % MVC (maximum voluntary contraction) or normalised EMG for each involved muscle. Map activation percentages to contribution weights using the EMG → weight scale in [domain/muscle-mapping.md](../../domain/muscle-mapping.md).

Document the source (paper title, author, year) next to each updated value in the code comment or in this spec.

## Exercises to Revisit (priority order)

High-priority — known likely errors in current model:

| Exercise        | Current weights                            | Suspected issue                                                            |
| --------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| Leg Press       | quads 1.0, glutes 0.5                      | Glutes likely 0.25 (hip not loaded through full ROM)                       |
| Good Mornings   | hamstrings 1.0, lower_back 1.0, glutes 0.5 | Lower_back may deserve 1.0 already; hamstrings vs lower_back split unclear |
| Sumo DL         | glutes 1.0, quads 0.5, hamstrings 0.5      | Quads activation is notably higher in sumo than conventional               |
| Dips            | chest 1.0, triceps 1.0, shoulders 0.5      | Chest vs triceps split depends on torso angle — needs nuance               |
| Hyperextensions | lower_back 1.0, glutes 0.5, hamstrings 0.5 | Glute/ham split varies widely by setup (hip position)                      |
| Romanian DL     | hamstrings 1.0, glutes 1.0, lower_back 0.5 | Ham vs glute primary split may be context-dependent                        |

Lower priority — model likely reasonable but confirm:

- Box Squat (vs Pause Squat — different muscle emphasis?)
- Block Pulls vs Rack Pull (upper_back vs lower_back split)
- Incline DB Press (chest vs shoulders split at various angles)
- Floor Press (triceps lockout emphasis vs chest)
- Bulgarian Split Squat (glute vs quad — research suggests both are primary)

## Part 2: RPE-Based Volume Scaling

### The Gap

Currently all logged sets count equally toward MRV regardless of how hard they were. Per the RP Strength definition, only **hard sets** (RIR 0–3, ~RPE 7+) should count. A set logged at RPE 5 is not a hard set and should contribute little or nothing. A set at RPE 9+ is maximally stimulating and should count fully.

`actual_sets` JSONB already stores `rpe_actual?: number` per set. This data exists but is never read for volume purposes.

### Research Task

Find the literature-backed RPE → effective-set multiplier. Key questions:

- At what RPE does a set start counting toward hypertrophic volume? (RP Strength suggests ~RPE 6 as the minimum, but this should be confirmed)
- Is the relationship linear or step-function? (e.g. RPE 6 = 0.5x, RPE 7 = 0.75x, RPE 8+ = 1.0x)
- Does this differ for strength vs hypertrophy? (This app targets powerlifting — strength focus)

**Sources to consult:**

- Mike Israetel / RP Strength: "Effective Reps" concept and proximity-to-failure research
- Schoenfeld & Grgic 2019 — "Does Training to Failure Maximize Muscle Hypertrophy?"
- Refalo et al. 2022 — "Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy"

### Proposed Implementation (pending research)

A starting point based on current RP guidance (to be updated with exact literature values):

| rpe_actual   | Set multiplier                   |
| ------------ | -------------------------------- |
| < 6          | 0.0 (does not count)             |
| 6            | 0.25                             |
| 7            | 0.5                              |
| 8            | 0.75                             |
| 9–10         | 1.0                              |
| not recorded | 1.0 (conservative — assume hard) |

Add a helper to the engine:

```typescript
// packages/training-engine/src/volume/rpe-scaler.ts
export function rpeSetMultiplier(rpeActual: number | undefined): number;
```

### Data Pipeline Changes

`CompletedSetLog` (in `packages/training-engine/src/types.ts`) needs to carry RPE per set, not just a count:

```typescript
export interface CompletedSetLog {
  lift: Lift;
  completedSets: number; // keep for backward compat / simple callers
  exercise?: string;
  setRpes?: (number | undefined)[]; // one entry per completed set
}
```

`computeWeeklyVolume` changes to sum `rpeSetMultiplier(rpe)` per set instead of `completedSets`:

```typescript
// Instead of: raw[muscle] += log.completedSets * contribution
// Use:
const effectiveSets = log.setRpes ? log.setRpes.reduce((sum, rpe) => sum + rpeSetMultiplier(rpe), 0) : log.completedSets;
raw[muscle] += effectiveSets * contribution;
```

`getCurrentWeekLogs` (`session.service.ts`) needs to extract `rpe_actual` from each set in `actual_sets` and pass them through.

`jit.ts` volume accumulation likewise needs to read `rpe_actual` per set.

### Note on Session-Level RPE

We also store `session_rpe` at the session level, but this is too coarse — a session might have some near-maximal sets and some lighter ones. Per-set `rpe_actual` is the correct granularity.

## Implementation

**Part 1 — EMG weights:**

`packages/training-engine/src/volume/muscle-mapper.ts` — update `EXERCISE_MUSCLES` values. Add a code comment per exercise referencing the source:

```typescript
// Bret Contreras 2012 — quads: high activation; glutes: low (hip stays flexed)
'Leg Press': [
  { muscle: 'quads', contribution: 1.0 },
  { muscle: 'glutes', contribution: 0.25 },
],
```

Also update `LIFT_MUSCLES` for the main three lifts if research suggests current weights are off.

**Part 2 — RPE scaling:**

1. `packages/training-engine/src/volume/rpe-scaler.ts` — new file, `rpeSetMultiplier(rpe?: number): number`
2. `packages/training-engine/src/types.ts` — add `setRpes?: (number | undefined)[]` to `CompletedSetLog`
3. `packages/training-engine/src/volume/mrv-mev-calculator.ts` — `computeWeeklyVolume` uses `setRpes` when present
4. `apps/parakeet/src/modules/session/data/session.repository.ts` — extract `rpe_actual` from each set in `actual_sets` / `auxiliary_sets`
5. `apps/parakeet/src/modules/session/application/session.service.ts` — pass `setRpes` through in `CompletedSetLog` entries
6. `apps/parakeet/src/modules/jit/lib/jit.ts` — use `rpe_actual` per set when accumulating `weeklyVolumeToDate`

## Tests

- `getMusclesForExercise` assertions: update values that change from EMG research
- New describe block for `rpeSetMultiplier`: boundary cases at 5, 6, 7, 8, 9, undefined
- Update `computeWeeklyVolume` tests to pass `setRpes` and assert effective-set counts

## Verification

1. `npx nx run training-engine:test` — all tests pass
2. `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json` — clean
3. Review: manually check that a squat week with Leg Press aux does not over-report glute volume

## Domain References

- [domain/muscle-mapping.md](../../domain/muscle-mapping.md) — EMG activation → contribution weight scale; canonical lift and exercise muscle maps
