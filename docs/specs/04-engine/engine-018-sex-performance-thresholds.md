# Spec: Sex-Differentiated Performance Adjuster Thresholds

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

Adds `DEFAULT_THRESHOLDS_FEMALE` alongside the renamed `DEFAULT_THRESHOLDS_MALE`. Female lifters' RPE naturally fluctuates across the menstrual cycle (late luteal phase raises perceived effort at identical loads), so the male threshold of 1.0 RPE deviation across 2 sessions generates false-positive adjustment suggestions. Female thresholds require a larger deviation across more sessions before triggering a suggestion. `suggestProgramAdjustments` signature is unchanged — callers select the threshold set.

## Tasks

**File: `packages/training-engine/src/adjustments/performance-adjuster.ts`**

- [ ] Rename `DEFAULT_THRESHOLDS` → `DEFAULT_THRESHOLDS_MALE`
- [ ] Add `DEFAULT_THRESHOLDS_FEMALE`:
  ```typescript
  export const DEFAULT_THRESHOLDS_FEMALE: AdjustmentThresholds = {
    rpe_deviation_threshold: 1.5,
    consecutive_sessions_required: 3,
    incomplete_session_threshold: 80,  // unchanged
    max_suggestions_per_lift: 1,       // unchanged
  }
  ```
- [ ] Export `getDefaultThresholds(biologicalSex?: 'female' | 'male'): AdjustmentThresholds`
  - `'female'` → `DEFAULT_THRESHOLDS_FEMALE`
  - `'male'` or `undefined` → `DEFAULT_THRESHOLDS_MALE`
- [ ] `suggestProgramAdjustments` unchanged — it already accepts `thresholds` as a parameter

**File: `apps/parakeet/src/lib/performance.ts`**

- [ ] Update `getPendingAdjustmentSuggestions(userId)` (or equivalent caller) to call `getDefaultThresholds(profile.biological_sex)` when selecting thresholds, rather than using `DEFAULT_THRESHOLDS` directly
  - `biological_sex` available from `getProfile(userId)` — may already be in scope

**Unit tests (`packages/training-engine/src/__tests__/performance-adjuster.test.ts`):**
- [ ] `getDefaultThresholds('female').rpe_deviation_threshold` === 1.5
- [ ] `getDefaultThresholds('female').consecutive_sessions_required` === 3
- [ ] `getDefaultThresholds('male').rpe_deviation_threshold` === 1.0
- [ ] `getDefaultThresholds(undefined)` returns male thresholds
- [ ] `DEFAULT_THRESHOLDS_MALE.rpe_deviation_threshold` === 1.0 (ensure rename didn't change values)
- [ ] `suggestProgramAdjustments` with female thresholds: 2 sessions at +1.2 RPE deviation → no suggestion generated (below 1.5 threshold)
- [ ] `suggestProgramAdjustments` with female thresholds: 3 sessions at +1.6 RPE deviation → `reduce_pct` suggestion generated

## Usage Context

- When cycle tracking is enabled (future — engine-014), thresholds for female lifters in the luteal phase may be further relaxed; this is a future enhancement and not part of this spec
- `prefer_not_to_say` → uses male thresholds (higher sensitivity; conservative)

## Dependencies

- [engine-005-performance-adjuster.md](./engine-005-performance-adjuster.md) — current adjuster
- [data-004-athlete-profile.md](../05-data/data-004-athlete-profile.md) — `biological_sex` field
- [engine-014-cycle-phase-calculator.md](./engine-014-cycle-phase-calculator.md) — future integration point
