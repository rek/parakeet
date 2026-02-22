# Spec: Formula Config Validation

**Status**: Planned
**Domain**: Formula Management

## What This Covers

Zod validation schema for formula config overrides. Ensures user and AI inputs stay within safe and sensible ranges before reaching the training engine.

## Tasks

**File: `packages/shared-types/src/formula.schema.ts`**

- `FormulaBlockIntensitySchema` (Zod):
  - `pct`: optional number, min 0.40, max 1.05
  - `sets`: optional integer, min 1, max 10
  - `reps`: optional integer, min 1, max 20
  - `rpe_target`: optional number, min 5.0, max 10.0, multiple of 0.5

- `FormulaRepIntensitySchema` (extends above):
  - `pct_min`, `pct_max`: both optional, pct_min must be ≤ pct_max when both provided
  - `sets_min`, `sets_max`, `reps_min`, `reps_max`: integer ranges with same constraint

- `FormulaBlockSchema` (Zod):
  - `heavy`, `explosive`, `rep`: all optional (partial override)
  - At least one field required if block is provided

- `FormulaOverridesSchema` (Zod):
  - `block1`, `block2`, `block3`: all optional
  - `deload`: optional
  - `progressive_overload.heavy_pct_increment_per_block`: optional, min 0.025, max 0.10
  - `training_max_increase.*`: optional positive numbers, min values must be ≤ max values

- Export `CreateFormulaConfigSchema` (wraps overrides) and inferred type `CreateFormulaConfigInput`

**Validation in API route handler:**
- Call `CreateFormulaConfigSchema.parse(body)` before reaching service
- On validation failure: return 400 with array of validation errors in a user-readable format
  - Example: `"block1.heavy.pct must be between 0.40 and 1.05"` (not raw Zod error messages)

**Unit tests:**
- Valid partial override passes (only block1.heavy.pct provided, everything else absent)
- pct = 1.10 fails (above max)
- pct_min = 0.85, pct_max = 0.80 fails (min > max)
- Empty overrides `{}` is valid (user can "save" with no changes, creates a version snapshot)

## Dependencies

- [types-001-zod-schemas.md](../03-types/types-001-zod-schemas.md)
