# Spec: Session Completion (Supabase Direct)

**Status**: Implemented
**Domain**: Sessions & Performance

## What This Covers

Writing a completed session log to Supabase, computing performance metrics locally using the training engine, and storing the results. No REST API server, no Pub/Sub — everything runs in the app.

## Tasks

**`apps/parakeet/lib/sessions.ts` (completion helper):**
- [x] `completeSession(sessionId: string, userId: string, input: CompleteSessionInput): Promise<void>`
  1. Compute completion stats locally (`completionPct`, `classifyPerformance`)
  2. Insert `session_logs` row with `actual_sets` JSONB (weights stored in grams)
  3. Update session status to `completed`
  4. Run `suggestProgramAdjustments()` locally (last 6 logs for the lift)
  5. Write `performance_metrics` row if suggestions were generated

**`CompleteSessionInput` type:**
```typescript
interface CompleteSessionInput {
  actualSets: {
    set_number: number
    weight_grams: number   // kg × 1000 — e.g. 112500 for 112.5kg
    reps_completed: number
    rpe_actual?: number    // 6.0–10.0 in 0.5 increments
    notes?: string
  }[]
  sessionRpe?: number
  startedAt?: Date
  completedAt?: Date
}
```

**`classifyPerformance` helper:**
- [x] `'over'`: avg actual reps > planned reps by >10%
- [x] `'at'`: within 10% of planned reps
- [x] `'under'`: completion_pct < 90%
- [x] `'incomplete'`: completion_pct < 50%

**Performance adjuster suggestions:**
- [x] If `suggestProgramAdjustments()` returns suggestions, store in `performance_metrics.suggestions` JSONB
- [x] On next app open: show non-blocking notification "Based on your recent sessions, consider reducing Squat Heavy intensity by 2.5%. Tap to preview."
  - User taps → formula editor screen opens with suggested change pre-filled

## Dependencies

- [sessions-002-session-lifecycle-api.md](./sessions-002-session-lifecycle-api.md)
- [engine-005-performance-adjuster.md](../04-engine/engine-005-performance-adjuster.md)
- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
