# Spec: OHP Formula Config Defaults

**Status**: Planned

**Domain**: Training Engine

## What This Covers

Adds OHP training max increase defaults to the formula config system. OHP uses smaller increments than squat/deadlift (1.25–2.5 kg) since absolute loads are lower.

## Tasks

**`packages/training-engine/src/types.ts`:**

- [ ] Add `overhead_press_min?: number` to `FormulaConfig.training_max_increase`
- [ ] Add `overhead_press_max?: number` to `FormulaConfig.training_max_increase`

**`packages/training-engine/src/cube/blocks.ts`:**

- [ ] Add to `DEFAULT_FORMULA_CONFIG_MALE.training_max_increase`:
  - `overhead_press_min: 1.25`
  - `overhead_press_max: 2.5`
- [ ] Add to `DEFAULT_FORMULA_CONFIG_FEMALE.training_max_increase`:
  - `overhead_press_min: 1.25`
  - `overhead_press_max: 2.5`

**Tests (`packages/training-engine/src/cube/blocks.test.ts`):**

- [ ] Verify OHP defaults present in both male and female configs

## Notes

- OHP fields are optional in the `FormulaConfig` interface so existing formula configs in DB (which lack OHP entries) remain valid
- 1.25–2.5 kg range mirrors bench press increments — appropriate for a smaller compound lift

## Dependencies

- types-003 (formula schema must include OHP fields)
