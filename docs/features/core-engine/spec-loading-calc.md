# Spec: Loading Percentage Calculator

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

The default formula configuration (system defaults in kg) and the `calculateSets` function that converts block + intensity type + 1RM (kg) into concrete planned sets.

## Tasks

**File: `packages/training-engine/src/cube/blocks.ts`**

- [x] Export `DEFAULT_FORMULA_CONFIG: FormulaConfig` constant with all Cube Method defaults (kg system). See [domain/periodization.md](../../domain/periodization.md) for block loading tables (percentages, sets, reps, RPE, progressive overload increments).

**File: `packages/training-engine/src/generator/set-calculator.ts`**

- [x] `calculateSets(lift: Lift, intensityType: IntensityType, blockNumber: 1|2|3, oneRmKg: number, formulaConfig: FormulaConfig): PlannedSet[]`
  - Heavy: returns `sets` × `reps` at `roundToNearest(pct × oneRmKg)` kg
  - Explosive: same pattern
  - Rep: midpoint of pct_min/pct_max and reps_min/reps_max; includes `reps_range` per set
  - Deload: 40% × 3×5
  - All weights in kg (floating point, rounded to nearest 2.5kg)
- [x] `mergeFormulaConfig(systemDefaults: FormulaConfig, userOverrides: Partial<FormulaConfig>): FormulaConfig`
  - Deep merge — null/undefined fields fall back to system defaults

**Unit tests:**
- [x] Block 1 heavy, Squat 1RM=140kg → weight = 112.5kg (80% = 112, rounded to nearest 2.5 = 112.5), 2 sets, 5 reps
- [x] Block 2 rep, Bench 1RM=100kg → weight = 80kg (80%), 2-3 sets, 4-8 reps
- [x] Block 3 heavy, DL 1RM=180kg → weight = 162.5kg (90% = 162, rounds to 162.5), 4 sets, 1-2 reps
- [x] User override block1.heavy.pct=0.75, Squat 140kg → 105.0kg
- [x] merge: override only replaces specified fields; others use system defaults

## Dependencies

- [engine-002-cube-method-scheduler.md](./engine-002-cube-method-scheduler.md)

## Domain References

- [domain/periodization.md](../../domain/periodization.md) — block loading tables (percentages, sets, reps, RPE, progressive overload, rounding increments)
