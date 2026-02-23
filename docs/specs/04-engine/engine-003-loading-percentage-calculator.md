# Spec: Loading Percentage Calculator

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

The default formula configuration (system defaults in kg) and the `calculateSets` function that converts block + intensity type + 1RM (kg) into concrete planned sets.

## Tasks

**File: `packages/training-engine/src/cube/blocks.ts`**

- Export `DEFAULT_FORMULA_CONFIG: FormulaConfig` constant with all Cube Method defaults (kg system):
  - Block 1: Heavy=80%/2×5/RPE8.5, Explosive=65%/3×8/RPE7.0, Rep=70%/2-3×8-12/RPE8.0
  - Block 2: Heavy=85%/2×3/RPE9.0, Explosive=70%/2×6/RPE7.5, Rep=80%/2-3×4-8/RPE8.0
  - Block 3: Heavy=90%/4×1-2/RPE9.5, Explosive=75%/2×2/RPE8.0, Rep=85%/2-3×3-5/RPE8.5
  - Deload: 40%/3×5/RPE5.0
  - `progressive_overload.heavy_pct_increment_per_block: 0.05`
  - Training max increase (kg): `{ bench_min: 2.5, bench_max: 5, squat_min: 5, squat_max: 10, deadlift_min: 5, deadlift_max: 10 }`
  - `rounding_increment_kg: 2.5`

**File: `packages/training-engine/src/generator/set-calculator.ts`**

- `calculateSets(lift: Lift, intensityType: IntensityType, blockNumber: 1|2|3, oneRmKg: number, formulaConfig: FormulaConfig): PlannedSet[]`
  - Heavy: returns `sets` × `reps` at `roundToNearest(pct × oneRmKg)` kg
  - Explosive: same pattern
  - Rep: midpoint of pct_min/pct_max and reps_min/reps_max; includes `reps_range` per set
  - Deload: 40% × 3×5
  - All weights in kg (floating point, rounded to nearest 2.5kg)

- `mergeFormulaConfig(systemDefaults: FormulaConfig, userOverrides: Partial<FormulaConfig>): FormulaConfig`
  - Deep merge — null/undefined fields fall back to system defaults

**Unit tests:**
- Block 1 heavy, Squat 1RM=140kg → weight = 112.5kg (80% = 112, rounded to nearest 2.5 = 112.5), 2 sets, 5 reps
- Block 2 rep, Bench 1RM=100kg → weight = 80kg (80%), 2-3 sets, 4-8 reps
- Block 3 heavy, DL 1RM=180kg → weight = 162.5kg (90% = 162, rounds to 162.5), 4 sets, 1-2 reps
- User override block1.heavy.pct=0.75, Squat 140kg → 105.0kg
- merge: override only replaces specified fields; others use system defaults

## Dependencies

- [engine-002-cube-method-scheduler.md](./engine-002-cube-method-scheduler.md)
