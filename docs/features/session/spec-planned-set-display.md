# Spec: Unified Planned Set Display

**Status**: Implemented

**Domain**: UI

## What This Covers

The session screen has three independent code paths that resolve "what weight/reps to show for set N": `computeDisplayWeights` (SetRow), `buildNextLiftLabel` (rest timer), and `showMainPostRest` (post-rest overlay). Only the first applies intra-session adaptations. This causes the rest timer and post-rest overlay to show stale base weights when an adaptation is active (e.g. SetRow shows 7.5kg after weight reduction, but rest timer still says 10kg).

This spec introduces a single `getEffectivePlannedSet()` function and wires all three display sites through it.

## Tasks

**`apps/parakeet/src/modules/session/utils/getEffectivePlannedSet.ts`:**

- [x] `getEffectivePlannedSet(index, plannedSets, actualSets, currentAdaptation): { weight_kg: number; reps: number }` — returns the effective planned weight/reps for a given 0-based set index, applying adaptation logic when present
  - If no adaptation or adaptation type is `none` / `extended_rest` / `reps_reduced`: return `plannedSets[index]`
  - If adaptation type is `weight_reduced` or `sets_capped`: count uncompleted sets before `index` to find the correct offset into `adaptation.sets[]`, return adapted weight
  - Return `plannedSets[index]` as fallback if index is out of bounds for adaptation sets
- [x] Export from `modules/session/index.ts`
- [x] Unit tests in `utils/getEffectivePlannedSet.test.ts`:
  - No adaptation → returns actual weight from store (initialised from planned, may be bumped)
  - `extended_rest` adaptation → returns actual weight from store (no weight override)
  - `weight_reduced` adaptation with mix of completed/uncompleted sets → returns adapted weight for uncompleted, actual weight for completed
  - `sets_capped` adaptation → same behavior as weight_reduced
  - Index out of bounds for adaptation.sets → falls back to planned
  - Empty plannedSets → returns undefined gracefully

**`apps/parakeet/src/modules/jit/utils/adaptation-display.ts`:**

- [x] Refactor `computeDisplayWeights` to call `getEffectivePlannedSet` per set instead of duplicating the adaptation offset logic internally
  - Import from `@modules/session`
  - Existing tests must still pass — behavior is identical

**`apps/parakeet/src/modules/session/utils/buildNextLiftLabel.ts`:**

- [x] Add `actualSets` and `currentAdaptation` parameters
- [x] Replace `plannedSets[pendingMainSetNumber]` with `getEffectivePlannedSet(pendingMainSetNumber, plannedSets, actualSets, currentAdaptation)`
  - Same for aux path if applicable (aux uses `auxAdaptations` — check if needed)

**`apps/parakeet/src/modules/session/hooks/useSetCompletionFlow.ts`:**

- [x] `showMainPostRest`: use `getEffectivePlannedSet` to resolve `plannedReps` (and weight if stored) instead of raw `plannedSets[pendingMain]`
- [x] `showWarmupPostRest`: same treatment for `firstSet.reps`

**`apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`:**

- [x] Pass `actualSets` and `currentAdaptation` through to `buildNextLiftLabel` call site (~line 1300)
- [x] Verify `PostRestOverlay` receives effective (not base) weight/reps — trace the prop chain

**Existing tests:**

- [x] `buildNextLiftLabel` tests: update to cover adaptation scenarios
- [x] `computeDisplayWeights` tests: must still pass unchanged (refactor, not behavior change)

## Dependencies

- None — purely internal refactor of existing session module code
