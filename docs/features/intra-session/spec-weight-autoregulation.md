# Spec: Intra-Set Weight Autoregulation

**Status**: Implemented

**Domain**: Training Engine | Mobile App

## What This Covers

After logging RPE for a set, if the RPE is significantly below target, suggest a weight increase for the next set. This closes the intensity gap that the RPE scaler fix (engine-044) can't solve on its own — the scaler values sets more fairly, but this feature ensures sets actually land at the right RPE.

Parallel to existing `volume-recovery.ts` (adds sets when RPE is low) and `intra-session-adapter.ts` (reduces weight on failure). This adds the missing upward direction.

Design doc: [intra-session-adaptation.md](../../design/intra-session-adaptation.md)
GitHub Issue: #130

## Tasks

### Engine: pure autoregulation logic

**`packages/training-engine/src/adjustments/weight-autoregulation.ts`** (new):

- [x] `WeightAutoregulationContext` type:
  - `rpeActual: number` — just-completed set RPE
  - `rpeTarget: number` — prescribed RPE target
  - `currentWeightKg: number` — weight used for the completed set
  - `primaryLift: Lift` — determines increment size
  - `remainingSetCount: number` — how many sets remain (0 = no suggestion)
  - `isDeload: boolean` — suppress suggestions on deload weeks
  - `isRecoveryMode: boolean` — suppress when soreness >= 9/10
  - `hasAlreadyAdjusted: boolean` — suppress cascading adjustments in same session
- [x] `WeightSuggestion` type:
  - `suggestedWeightKg: number` — rounded to nearest 2.5 kg
  - `deltaKg: number` — how much was added (for display)
  - `rationale: string` — e.g., "RPE 6.5 vs target 7.0 — try +5 kg"
- [x] `evaluateWeightAutoregulation(ctx: WeightAutoregulationContext): WeightSuggestion | null`
  - Returns `null` if no suggestion warranted
  - RPE gap (target - actual) >= 1.0 → suggest small increment
  - RPE gap >= 1.5 → suggest larger increment
  - Increment table:
    - Bench/OHP: +2.5 kg (gap >= 1.0), +5 kg (gap >= 1.5)
    - Squat/Deadlift: +5 kg (gap >= 1.0), +10 kg (gap >= 1.5)
  - Guard: `remainingSetCount === 0` → null (last set, too late)
  - Guard: `isDeload || isRecoveryMode` → null
  - Guard: `hasAlreadyAdjusted` → null (one adjustment per session)
  - Weight rounded to nearest 2.5 kg via existing `roundToNearest()`
- [x] Export from `packages/training-engine/src/index.ts`

**`packages/training-engine/src/adjustments/weight-autoregulation.test.ts`** (new):

- [x] RPE gap >= 1.0, bench → +2.5 kg suggestion
- [x] RPE gap >= 1.5, bench → +5 kg suggestion
- [x] RPE gap >= 1.0, squat → +5 kg suggestion
- [x] RPE gap >= 1.5, squat → +10 kg suggestion
- [x] RPE gap < 1.0 → null (within tolerance)
- [x] remainingSetCount === 0 → null
- [x] isDeload → null
- [x] isRecoveryMode → null
- [x] hasAlreadyAdjusted → null
- [x] Weight rounded to 2.5 kg
- [x] Rationale includes RPE values and delta

### Store: suggestion state

**`apps/parakeet/src/platform/store/sessionStore.ts`:**

- [x] Add `weightSuggestion: WeightSuggestion | null` to state (alongside `recoveryOffer`)
- [x] Add `hasAcceptedWeightSuggestion: boolean` to state (tracks `hasAlreadyAdjusted`)
- [x] `setWeightSuggestion(suggestion: WeightSuggestion | null)` action
- [x] `acceptWeightSuggestion()` action:
  - Finds the next incomplete set
  - Updates its `weight_grams` to `suggestion.suggestedWeightKg * 1000`
  - Sets `hasAcceptedWeightSuggestion = true`
  - Clears `weightSuggestion`
- [x] `dismissWeightSuggestion()` action: clears `weightSuggestion` without changing weight
- [x] Reset both fields in `resetSession()`

### App: wiring

**`apps/parakeet/src/modules/session/hooks/useSetCompletionFlow.ts`:**

- [x] Import `evaluateWeightAutoregulation` from `@parakeet/training-engine`
- [x] Add `checkWeightAutoregulation()` helper (parallel to existing `checkVolumeRecovery()`):
  - Build `WeightAutoregulationContext` from store state: latest completed set RPE, planned RPE target, current weight, primary lift, remaining sets count, deload/recovery flags, `hasAcceptedWeightSuggestion`
  - Call `evaluateWeightAutoregulation(ctx)`
  - If suggestion returned: `setWeightSuggestion(suggestion)`
- [x] Call `checkWeightAutoregulation()` in `handleRpeQuickSelect()` after `checkVolumeRecovery()` — only for main lift sets (not aux, not warmup)

### UI: suggestion display

**`apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`:**

- [x] Read `weightSuggestion`, `acceptWeightSuggestion`, `dismissWeightSuggestion` from store
- [x] Render suggestion inline on the next set card when `weightSuggestion !== null`:
  - Compact banner below set info: "Felt easy — try {suggestedWeight} kg?" with accept/dismiss actions
  - Accept: tap suggested weight chip → calls `acceptWeightSuggestion()`
  - Dismiss: implicit (start set at original weight) or explicit X button
- [x] Auto-dismiss suggestion when the next set is started at the original weight
- [x] Suggestion does NOT appear during warmup or aux exercises

### Domain doc update

**`docs/domain/session-prescription.md`:**

- [x] Add weight autoregulation to the JIT pipeline description as an intra-session mechanism (alongside volume recovery)

## Dependencies

- [engine-044](./engine-044-rpe-scaler-interpolation.md) — RPE scaler interpolation (implemented)
- Existing `intra-session-adapter.ts` — downward adaptation (independent, no conflicts)
- Existing `volume-recovery.ts` — parallel pattern for the wiring
