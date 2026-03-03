# Spec: Session Completion (Supabase Direct)

**Status**: Implemented
**Domain**: Sessions & Performance

## What This Covers

Writing a completed session log to Supabase, computing performance metrics locally using the training engine, and storing the results. No REST API server, no Pub/Sub — everything runs in the app.

## Tasks

**`apps/parakeet/src/modules/session/application/session.service.ts` (completion helper; re-exported via `apps/parakeet/src/modules/session/application/session.service.ts`):**
- [x] `completeSession(sessionId: string, userId: string, input: CompleteSessionInput): Promise<void>`
  1. Compute completion stats locally from explicit `is_completed` confirmations (`completionPct`, `classifyPerformance`)
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
    is_completed: boolean  // explicit user confirmation that set was completed
    rpe_actual?: number    // 6.0–10.0 in 0.5 increments
    notes?: string
  }[]
  auxiliarySets?: {        // optional; absent if no auxiliary work was done
    exercise: string
    set_number: number
    weight_grams: number
    reps_completed: number
    is_completed: boolean
    rpe_actual?: number
  }[]
  sessionRpe?: number
  startedAt?: Date
  completedAt?: Date
}
```

**`session_logs.auxiliary_sets`:** JSONB column (nullable); present in current consolidated schema migration (`20260307000001_fix_personal_records_unique_index.sql`).

**`classifyPerformance` helper:**
- [x] `'incomplete'`: completion_pct < 50%
- [x] `'under'`: completion_pct < 90%
- [x] `'over'`: completed set count exceeds planned count by >10%
- [x] `'at'`: otherwise

**Performance adjuster suggestions:**
- [x] `suggestProgramAdjustments()` is evaluated after completion using the most recent 6 logs for the session lift.
- [x] Non-empty suggestion results currently gate a `performance_metrics` insert for the session/lift context.

## Completion Semantics Contract

Completion metric contract:
1. numerator: count of sets explicitly confirmed complete (`is_completed === true`)
2. denominator: planned set count from `session.planned_sets.length` when available (fallback to logged set count)
3. completion percentage: `(completedCount / plannedCount) * 100`

Implementation notes:
- `is_completed` is used for computation only and is stripped from persisted `session_logs.actual_sets` payload.
- This avoids treating prefilled planned reps as completed work.

## Dependencies

- [sessions-002-session-lifecycle-api.md](./sessions-002-session-lifecycle-api.md)
- [engine-005-performance-adjuster.md](../04-engine/engine-005-performance-adjuster.md)
- [infra-003-supabase-setup.md](../01-infra/infra-003-supabase-setup.md)
