# Spec: Formula Defaults API

**Status**: Planned
**Domain**: Formula Management

## What This Covers

The `GET /v1/formulas/defaults` endpoint that returns the system's built-in Cube Method formula configuration. This is the canonical reference that user overrides are applied against.

## Tasks

**Route:**
- `GET /v1/formulas/defaults`
  - No auth required for this endpoint (public; returns the same data for all users)
  - Returns the `DEFAULT_FORMULA_CONFIG` constant exported from `packages/training-engine`
  - Response is serialized to the `FormulaConfigResponse` shape (human-readable format with lbs/kg where applicable, descriptions of each field)

**Response shape:**
```json
{
  "blocks": {
    "1": {
      "heavy":    { "pct": 0.80, "sets": 2, "reps": 5, "rpe_target": 8.5, "description": "80% of 1RM, 2 sets of 5" },
      "explosive":{ "pct": 0.65, "sets": 3, "reps": 8, "rpe_target": 7.0 },
      "rep":      { "pct_min": 0.70, "pct_max": 0.70, "sets_min": 2, "sets_max": 3, "reps_min": 8, "reps_max": 12, "rpe_target": 8.0 }
    },
    "2": { ... },
    "3": { ... }
  },
  "deload": { "pct": 0.40, "sets": 3, "reps": 5, "rpe_target": 5.0 },
  "progressive_overload": { "heavy_pct_increment_per_block": 0.05 },
  "training_max_increase": {
    "bench_min_lbs": 10, "bench_max_lbs": 20,
    "squat_min_lbs": 20, "squat_max_lbs": 40,
    "deadlift_min_lbs": 20, "deadlift_max_lbs": 40
  }
}
```

**Implementation note:** This endpoint imports `DEFAULT_FORMULA_CONFIG` directly from `@parakeet/training-engine`. No database query — the defaults are code constants, not DB rows. This ensures the defaults are always in sync with the engine.

## Dependencies

- [engine-003-loading-percentage-calculator.md](../04-engine/engine-003-loading-percentage-calculator.md)
