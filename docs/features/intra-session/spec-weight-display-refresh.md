# Spec: Weight Autoregulation Display Refresh (Bug Fix)

**Status**: Implemented

**Domain**: UI

## What This Covers

When the user accepts the "Felt easy? +5kg" banner, the store correctly bumps `actualSets[next].weight_grams`, but every display site that reads the upcoming weight (`SetRow`, rest timer "Next" label, `PostRestOverlay`) still shows the old planned weight. This is because `getEffectivePlannedSet` — the single source of truth for all display sites — ignores `actualSet.weight_grams` for incomplete sets when no weight-modifying adaptation (`weight_reduced`, `sets_capped`) is active.

The fix is to make `getEffectivePlannedSet` prefer `actualSet.weight_grams / 1000` for incomplete sets when no weight-modifying adaptation is active, since `actualSets` is initialised from `plannedSets` and any accepted bump is written there.

## Tasks

**`apps/parakeet/src/shared/utils/getEffectivePlannedSet.ts`:**

- [x] Add `weight_grams: number` to the local `ActualSet` interface
- [x] For all sets (completed or incomplete) with no weight-modifying adaptation, return `{ weight_kg: weightGramsToKg(actual.weight_grams), reps: planned.reps }` — the store's `weight_grams` is always the source of truth
  - Weight-modifying adaptation case (`weight_reduced`, `sets_capped`) — adaptation weight wins for uncompleted sets; completed sets return actual weight
- [x] Update tests:
  - "no adaptation, incomplete set with weight_grams matching planned" → displayWeightKg = actualSet value (still same result)
  - "no adaptation, incomplete set with bumped weight_grams (110000g)" → displayWeightKg = 110 (not planned 100)
  - Existing adaptation tests remain valid (adaptation weight still overrides)

**`apps/parakeet/src/modules/session/utils/buildNextLiftLabel.ts`:**

- [x] Add `weight_grams: number` to the local `ActualSet` type so it flows through to `getEffectivePlannedSet`

**`apps/parakeet/src/modules/session/utils/buildNextLiftLabel.test.ts`:**

- [x] Add `weight_grams` to all `actualSets` fixtures (set to `weight_kg * 1000` so existing test expectations are unchanged)
- [x] Add a test: when weight is bumped (`weight_grams` differs from planned), label shows the bumped weight

**`apps/parakeet/src/modules/jit/utils/adaptation-display.test.ts`:**

- [x] Update "uses planned weights when there is no adaptation" test: actualSet fixtures have `weight_grams: 80000` (80kg) but planned is 100/105kg — with the fix, display will use `actualSet.weight_grams` (80kg), so update expectations accordingly
- [x] Add a test: "uses bumped actualSet weight when no adaptation and weight_grams differs from planned"

## Dependencies

- [spec-weight-autoregulation.md](./spec-weight-autoregulation.md) — original implementation that this bug fix extends
