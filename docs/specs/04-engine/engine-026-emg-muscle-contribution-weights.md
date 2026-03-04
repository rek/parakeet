# engine-026: EMG-Based Muscle Contribution Weight Refinement

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

1. **Bret Contreras EMG studies** — the most comprehensive applied EMG database for strength exercises. See bretcontreras.com, and papers published in *Journal of Strength and Conditioning Research*.
2. **Brad Schoenfeld** — *Science and Development of Muscle Hypertrophy* (2nd ed.), exercise-specific EMG appendix.
3. **NSCA Essentials of Strength Training and Conditioning** — biomechanics chapters per exercise.
4. **PubMed** — search `[exercise name] EMG activation` for peer-reviewed studies.

### What to record per exercise

For each exercise in `EXERCISE_MUSCLES`, find the mean % MVC (maximum voluntary contraction) or normalised EMG for each involved muscle. Then map to contribution weights using:

| EMG activation | Contribution weight |
|---|---|
| >70% MVC (primary mover) | 1.0 |
| 40–70% MVC | 0.75 |
| 20–40% MVC | 0.5 |
| <20% MVC | 0.25 |
| Negligible / not measured | 0.0 (omit from map) |

Document the source (paper title, author, year) next to each updated value in the code comment or in this spec.

## Exercises to Revisit (priority order)

High-priority — known likely errors in current model:

| Exercise | Current weights | Suspected issue |
|---|---|---|
| Leg Press | quads 1.0, glutes 0.5 | Glutes likely 0.25 (hip not loaded through full ROM) |
| Good Mornings | hamstrings 1.0, lower_back 1.0, glutes 0.5 | Lower_back may deserve 1.0 already; hamstrings vs lower_back split unclear |
| Sumo DL | glutes 1.0, quads 0.5, hamstrings 0.5 | Quads activation is notably higher in sumo than conventional |
| Dips | chest 1.0, triceps 1.0, shoulders 0.5 | Chest vs triceps split depends on torso angle — needs nuance |
| Hyperextensions | lower_back 1.0, glutes 0.5, hamstrings 0.5 | Glute/ham split varies widely by setup (hip position) |
| Romanian DL | hamstrings 1.0, glutes 1.0, lower_back 0.5 | Ham vs glute primary split may be context-dependent |

Lower priority — model likely reasonable but confirm:
- Box Squat (vs Pause Squat — different muscle emphasis?)
- Block Pulls vs Rack Pulls (upper_back vs lower_back split)
- Incline DB Press (chest vs shoulders split at various angles)
- Floor Press (triceps lockout emphasis vs chest)
- Bulgarian Split Squat (glute vs quad — research suggests both are primary)

## Implementation

All changes are localised to one file:

**`packages/training-engine/src/volume/muscle-mapper.ts`** — update `EXERCISE_MUSCLES` values.

Add a code comment per exercise referencing the source:
```typescript
// Bret Contreras 2012 — quads: high activation; glutes: low (hip stays flexed)
'Leg Press': [
  { muscle: 'quads', contribution: 1.0 },
  { muscle: 'glutes', contribution: 0.25 },
],
```

Also update `LIFT_MUSCLES` for the main three lifts if the research suggests current weights are off.

## Tests

Update affected assertions in `packages/training-engine/src/volume/mrv-mev-calculator.test.ts` — specifically the `getMusclesForExercise` describe block added in engine-025 (aux MRV integration).

## Verification

1. `npx nx run training-engine:test` — all tests pass
2. `tsc --noEmit -p apps/parakeet/tsconfig.typecheck.json` — clean
3. Review: manually check that a squat week with Leg Press aux does not over-report glute volume
