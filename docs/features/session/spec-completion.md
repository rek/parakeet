# Spec: Session Completion (Supabase Direct)

**Status**: Implemented (being reshaped — see [design-durability.md](./design-durability.md))
**Domain**: Sessions & Performance

## What This Covers

End-of-workout finalisation. After [spec-set-persistence.md](./spec-set-persistence.md) ships, sets are already durable at confirmation time; this spec covers summary + adjuster + achievements only.

## Durability Note (post-redesign)

End is no longer the save-gate for sets. Sets persist per-tap via `persistSet()` → `set_logs`. If End never fires, [spec-auto-finalize.md](./spec-auto-finalize.md) finalises the session on the server with the existing `set_logs`. Losing End costs at most a `session_rpe` value.

## Tasks

**`apps/parakeet/src/modules/session/application/session.service.ts` (completion helper):**
- [x] `completeSession(sessionId: string, userId: string, input: CompleteSessionInput): Promise<void>` — current batch behaviour; kept intact during dual-write rollout.
- [ ] Post-rollout changes:
  1. Compute completion stats from `set_logs` (not from local `actualSets`).
  2. Write `session_logs` summary row with `session_rpe`, `completed_at`, `completion_pct`, `performance_vs_plan`, `cycle_phase`. **Do NOT** write `actual_sets` / `auxiliary_sets` (derived from `set_logs`).
  3. Update session status `in_progress → completed` (guard `.eq('status', 'in_progress')`).
  4. Run `suggestProgramAdjustments()` locally (last 6 logs for the lift).
  5. Write `performance_metrics` row if suggestions were generated.
  6. Fire achievement detection.

**Legacy batch behaviour (during dual-write window only):**
- [x] Insert `session_logs` row with `actual_sets` JSONB (weights stored in grams).
- [x] Writes stripped once backfill verified and `session_logs.actual_sets` column dropped.

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

**`classifyPerformance` helper** (`apps/parakeet/src/modules/session/utils/classify-performance.ts`; thresholds cross-referenced in `docs/domain/periodization.md` → *Completion Classification Thresholds*):
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
- `is_completed` is a local-store-only field. Post durability rollout (#16), per-set writes go to `set_logs` on each confirmation, which by definition only contains confirmed sets — so `is_completed` never needs to be serialised.
- Prefilled planned reps (not yet confirmed) never reach `set_logs`, so no downstream code treats them as completed work.

## Dependencies

- [spec-set-persistence.md](./spec-set-persistence.md) — source of truth for set data post-rollout.
- [spec-auto-finalize.md](./spec-auto-finalize.md) — fallback finalisation when End is not tapped.
- [spec-lifecycle.md](./spec-lifecycle.md) — status transitions.
- [engine-005-performance-adjuster.md](../core-engine/spec-performance-adjuster.md)
- [infra-003-supabase-setup.md](../infra/spec-supabase.md)
