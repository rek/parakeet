# Spec: Sex-Aware Soreness Adjuster

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

`getSorenessModifier` gains an optional `biologicalSex` parameter. Female lifters receive a lighter adjustment at soreness level 4 (−1 set, 3% intensity cut vs −2 sets, 5% cut) because female lifters experience less acute muscle damage per training stimulus at equivalent relative intensities, meaning level-4 soreness encodes less physiological damage than the same rating in a male lifter. Level 5 is unchanged — recovery session applies regardless of sex.

## Tasks

**File: `packages/training-engine/src/adjustments/soreness-adjuster.ts`**

- [ ] Add `SORENESS_TABLE_FEMALE` constant, overriding only level 4:
  ```typescript
  const SORENESS_TABLE_FEMALE: Record<SorenessLevel, SorenessModifier> = {
    ...SORENESS_TABLE,
    4: { setReduction: 1, intensityMultiplier: 0.97, recoveryMode: false, warning: 'High soreness — reduced 1 set and intensity 3%' },
  }
  ```
- [ ] Update `getSorenessModifier` signature: `getSorenessModifier(sorenessLevel: SorenessLevel, biologicalSex?: 'female' | 'male'): SorenessModifier`
  - `'female'` → look up in `SORENESS_TABLE_FEMALE`
  - `'male'` or `undefined` → look up in `SORENESS_TABLE` (existing behaviour)
- [ ] `applySorenessToSets` signature unchanged — it receives the resolved `SorenessModifier`, not the sex directly

**File: `packages/training-engine/src/generator/jit-session-generator.ts`**

- [ ] Thread `biologicalSex` from `JITInput` into `getSorenessModifier(worstSoreness, biologicalSex)` call at Step 3
- [ ] No other changes to JIT pipeline

**Unit tests (`packages/training-engine/src/__tests__/soreness-adjuster.test.ts`):**
- [ ] `getSorenessModifier(4, 'female').setReduction` === 1
- [ ] `getSorenessModifier(4, 'female').intensityMultiplier` === 0.97
- [ ] `getSorenessModifier(4, 'male').setReduction` === 2
- [ ] `getSorenessModifier(4, 'male').intensityMultiplier` === 0.95
- [ ] `getSorenessModifier(4)` (no sex) === same as male
- [ ] `getSorenessModifier(5, 'female').recoveryMode` === true (unchanged from male)
- [ ] `getSorenessModifier(3, 'female').setReduction` === 1 (unchanged from male)

## Usage Context

- `generateJITSession` is the only production caller of `getSorenessModifier`; `biologicalSex` is already in `JITInput`
- `applySorenessToSets` (used in tests and potentially in future standalone callers) is unaffected — it accepts the already-resolved modifier

## Dependencies

- [engine-007-jit-session-generator.md](./engine-007-jit-session-generator.md) — JIT pipeline
- [engine-009-soreness-adjuster.md](./engine-009-soreness-adjuster.md) — current soreness system
- [data-004-athlete-profile.md](../05-data/data-004-athlete-profile.md) — `biological_sex` field
