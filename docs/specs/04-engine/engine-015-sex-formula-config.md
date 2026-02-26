# Spec: Sex-Differentiated Formula Config Defaults

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

Sex-specific default `FormulaConfig` objects for the Cube Method scheduler. Female lifters get slightly higher set counts on Block 1–2 heavy/rep days, lower RPE targets across all blocks, and tighter training-max increment ceilings. `FormulaConfig` type is unchanged — user overrides layer on top as before.

## Tasks

**File: `packages/training-engine/src/cube/blocks.ts`**

- [ ] Rename `DEFAULT_FORMULA_CONFIG` → `DEFAULT_FORMULA_CONFIG_MALE`
- [ ] Add `DEFAULT_FORMULA_CONFIG_FEMALE`:
  - `block1.heavy`: sets 3, rpe_target 8.0 (was 2, 8.5)
  - `block1.explosive`: rpe_target 6.5 (was 7.0); sets unchanged
  - `block1.rep`: sets_min 3, sets_max 4, rpe_target 7.5 (was 2/3, 8.0)
  - `block2.heavy`: sets 3, rpe_target 8.5 (was 2, 9.0)
  - `block2.explosive`: rpe_target 7.0 (was 7.5); sets unchanged
  - `block2.rep`: sets_min 3, sets_max 4, rpe_target 7.5 (was 2/3, 8.0)
  - `block3.heavy`: rpe_target 9.0 (was 9.5); sets unchanged (block3 does not get +1 set)
  - `block3.explosive`: rpe_target 7.5 (was 8.0); sets unchanged
  - `block3.rep`: rpe_target 8.0 (was 8.5); sets unchanged
  - `deload`: unchanged
  - `progressive_overload`: unchanged
  - `training_max_increase`: bench_min 2.5, bench_max 2.5, squat_min 5, squat_max 7.5, deadlift_min 5, deadlift_max 7.5
  - `rounding_increment_kg`: unchanged (2.5)
- [ ] Export `getDefaultFormulaConfig(biologicalSex?: 'female' | 'male'): FormulaConfig`
  - `'female'` → `DEFAULT_FORMULA_CONFIG_FEMALE`
  - `'male'` or `undefined` → `DEFAULT_FORMULA_CONFIG_MALE`

**Unit tests (`packages/training-engine/src/__tests__/blocks.test.ts`):**
- [ ] `getDefaultFormulaConfig('female').block1.heavy.sets` === 3
- [ ] `getDefaultFormulaConfig('female').block1.heavy.rpe_target` === 8.0
- [ ] `getDefaultFormulaConfig('female').block2.heavy.sets` === 3
- [ ] `getDefaultFormulaConfig('female').block3.heavy.sets` === 4 (unchanged)
- [ ] `getDefaultFormulaConfig('female').training_max_increase.bench_max` === 2.5
- [ ] `getDefaultFormulaConfig('female').training_max_increase.squat_max` === 7.5
- [ ] `getDefaultFormulaConfig('male')` returns same object reference as `DEFAULT_FORMULA_CONFIG_MALE`
- [ ] `getDefaultFormulaConfig(undefined)` returns male config

**Export from `packages/training-engine/src/index.ts`:**
- [ ] `export * from './cube/blocks'` already covers new exports — no change needed

## Usage Context

- Program creation (`apps/parakeet/src/lib/programs.ts`): call `getDefaultFormulaConfig(profile.biological_sex)` when no user formula override exists, instead of hardcoding `DEFAULT_FORMULA_CONFIG`

## Dependencies

- [data-004-athlete-profile.md](../05-data/data-004-athlete-profile.md) — `biological_sex` field
- [engine-002-cube-method-scheduler.md](./engine-002-cube-method-scheduler.md) — `FormulaConfig` type origin
