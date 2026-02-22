# Spec: Performance Adjuster

**Status**: Planned
**Domain**: Training Engine

## What This Covers

The adjustment suggestion engine that analyzes logged session performance and generates formula modification suggestions when patterns are detected.

## Tasks

**File: `packages/training-engine/src/adjustments/performance-adjuster.ts`**

- `suggestProgramAdjustments(recentLogs: SessionLogSummary[], thresholds: AdjustmentThresholds): AdjustmentSuggestion[]`
  - `recentLogs`: last N session logs for a specific user (N configurable, default 6)
  - Groups logs by `lift` and `intensity_type`
  - Applies detection rules:

  **Rule 1 — High RPE Pattern:**
  - If `actual_rpe - target_rpe > 1.0` for 2+ consecutive sessions on the same lift
  - Generate suggestion: reduce `heavy.pct` or `explosive.pct` by 0.025 (-2.5%)
  - Include `rationale: "Squat Heavy RPE has averaged X.X above target over last N sessions"`
  - Include `affected_lift`, `affected_block`, `pct_adjustment: -0.025`

  **Rule 2 — Low RPE Pattern:**
  - If `target_rpe - actual_rpe > 1.0` for 2+ consecutive sessions on the same lift
  - Generate suggestion: increase `pct` by 0.025 (+2.5%)
  - Include `rationale: "Loading appears below intended stimulus"`

  **Rule 3 — Incomplete Session:**
  - If `completion_pct < 80` for a single session
  - Generate suggestion type: `'flag_for_review'` (no formula change)
  - Include session ID and completion percentage

- `AdjustmentThresholds` type:
  - `rpe_deviation_threshold: number` (default 1.0)
  - `consecutive_sessions_required: number` (default 2)
  - `incomplete_session_threshold: number` (default 80)
  - `max_suggestions_per_lift: number` (default 1) — don't generate multiple suggestions for the same lift simultaneously

**File: `packages/training-engine/src/adjustments/edge-case-adjuster.ts`** (see edge-cases-004)

**Unit tests (`packages/training-engine/__tests__/performance-adjuster.test.ts`):**
- 2 consecutive Squat Heavy sessions with RPE 9.6 (target 8.5) → high RPE suggestion returned
- 1 session with high RPE → no suggestion (below threshold)
- 3 sessions alternating high/low RPE → no suggestion (not consecutive)
- Incomplete session (60% completion) → flag_for_review suggestion
- Low RPE pattern → increase suggestion

## Dependencies

- [engine-004-program-generator.md](./engine-004-program-generator.md)
