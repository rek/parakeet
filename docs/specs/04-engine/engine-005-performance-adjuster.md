# Spec: Performance Adjuster

**Status**: Planned
**Domain**: Training Engine

## What This Covers

Analyzes logged session performance and generates adjustment suggestions when patterns are detected. Runs **locally in the app** (part of `packages/training-engine`) after each session completion. Results are written to Supabase `performance_metrics` table.

## Tasks

**File: `packages/training-engine/src/adjustments/performance-adjuster.ts`**

- `suggestProgramAdjustments(recentLogs: SessionLogSummary[], thresholds: AdjustmentThresholds): AdjustmentSuggestion[]`
  - `recentLogs`: last N session logs for a specific lift (N configurable, default 6)
  - Groups logs by `lift` and `intensity_type`
  - Applies detection rules:

  **Rule 1 — High RPE Pattern:**
  - If `actual_rpe - target_rpe > 1.0` for 2+ consecutive sessions on the same lift
  - Generate suggestion: reduce `heavy.pct` or `explosive.pct` by 0.025 (-2.5%)
  - `rationale: "Squat Heavy RPE has averaged X.X above target over last N sessions"`
  - Fields: `affected_lift`, `affected_block`, `pct_adjustment: -0.025`

  **Rule 2 — Low RPE Pattern:**
  - If `target_rpe - actual_rpe > 1.0` for 2+ consecutive sessions on the same lift
  - Generate suggestion: increase `pct` by 0.025 (+2.5%)
  - `rationale: "Loading appears below intended stimulus"`

  **Rule 3 — Incomplete Session:**
  - If `completion_pct < 80` for a single session
  - Suggestion type: `'flag_for_review'` (no formula change)
  - Include session ID and completion percentage

- `AdjustmentThresholds` type:
  - `rpe_deviation_threshold: number` (default 1.0)
  - `consecutive_sessions_required: number` (default 2)
  - `incomplete_session_threshold: number` (default 80)
  - `max_suggestions_per_lift: number` (default 1)

**Integration with Supabase (called from app after session completion):**
```typescript
// apps/mobile — after session complete
const logs = await supabase
  .from('session_logs')
  .select('*')
  .eq('lift', lift)
  .order('completed_at', { ascending: false })
  .limit(6)

const suggestions = suggestProgramAdjustments(logs.data, DEFAULT_THRESHOLDS)

// Write performance_metrics row
await supabase.from('performance_metrics').insert({
  session_id: sessionId,
  user_id: userId,
  suggestions: suggestions,         // JSONB
  computed_at: new Date().toISOString(),
})
```

**Unit tests (`packages/training-engine/__tests__/performance-adjuster.test.ts`):**
- 2 consecutive Squat Heavy sessions RPE 9.6 (target 8.5) → high RPE suggestion returned
- 1 session with high RPE → no suggestion (below consecutive threshold)
- 3 sessions alternating high/low RPE → no suggestion (not consecutive)
- Incomplete session (60% completion) → flag_for_review suggestion
- Low RPE pattern → increase suggestion

## Dependencies

- [engine-004-program-generator.md](./engine-004-program-generator.md)
- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
