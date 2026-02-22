# Spec: Loading Percentage Calculator

**Status**: Planned
**Domain**: Training Engine

## What This Covers

The default formula configuration (system defaults) and the `calculateSets` function that converts block + intensity type + 1RM into concrete planned sets with weight, reps, and RPE targets.

## Tasks

**File: `packages/training-engine/src/cube/blocks.ts`**

- Export `DEFAULT_FORMULA_CONFIG: FormulaConfig` constant with all Cube Method defaults:
  - Block 1: Heavy=80%/2×5/RPE8.5, Explosive=65%/3×8/RPE7.0, Rep=70%/2-3×8-12/RPE8.0
  - Block 2: Heavy=85%/2×3/RPE9.0, Explosive=70%/2×6/RPE7.5, Rep=80%/2-3×4-8/RPE8.0
  - Block 3: Heavy=90%/4×1-2/RPE9.5, Explosive=75%/2×2/RPE8.0, Rep=85%/2-3×3-5/RPE8.5
  - Deload: 40%/3×5/RPE5.0
  - Progressive overload increment: 0.05 (5% per block)
  - Training max increase: Bench 10-20 lbs, Squat/DL 20-40 lbs

**File: `packages/training-engine/src/generator/set-calculator.ts`**

- `calculateSets(lift: Lift, intensityType: IntensityType, blockNumber: 1|2|3, oneRmLbs: number, formulaConfig: FormulaConfig, roundingIncrement: number): PlannedSet[]`
  - Heavy: returns `sets` × `reps` at `pct × oneRM` rounded to increment
  - Explosive: same pattern, lower percentage
  - Rep: uses midpoint of pct_min/pct_max and reps_min/reps_max for planning; includes `reps_range` on each set so the UI can display the range
  - Deload: fixed 40% × 3×5

- `mergeFormulaConfig(systemDefaults: FormulaConfig, userOverrides: Partial<FormulaConfig>): FormulaConfig`
  - Deep merge — user overrides take precedence, nulls fall back to system defaults

**Unit tests (`packages/training-engine/__tests__/loading-calculator.test.ts`):**
- Block 1 heavy, Squat 315 lbs → weight = 252.5 lbs (80% rounded to 2.5), 2 sets, 5 reps
- Block 2 rep, Bench 225 lbs → weight = 180.0 lbs (80%), 2-3 sets, 4-8 reps
- Block 3 heavy, DL 365 lbs → weight = 327.5 lbs (90% rounded), 4 sets, 1-2 reps
- User override: block1.heavy.pct=0.75, Squat 315 → 235.0 lbs
- merge: overrides only replace specified fields; others use system defaults

## Dependencies

- [engine-002-cube-method-scheduler.md](./engine-002-cube-method-scheduler.md)
