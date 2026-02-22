# Spec: Session Completion API

**Status**: Planned
**Domain**: Sessions & Performance

## What This Covers

The `POST /v1/sessions/:sessionId/complete` endpoint — writes the session log, computes performance metrics, and publishes the Pub/Sub event that triggers async analytics processing.

## Tasks

**Service (`sessions.service.ts` addition):**
- `completeSession(sessionId: string, userId: string, input: CompleteSessionInput): Promise<SessionLog>`
  1. Validate session belongs to user and status is `'in_progress'` or `'planned'` (allow direct completion without explicit start)
  2. Validate `actual_sets` array length matches `planned_sets` count (warn if mismatch, don't error)
  3. Compute `completion_pct`: `(sets_with_reps_completed / planned_sets.length) × 100`
  4. Compute `performance_vs_plan`:
     - `'over'`: avg actual reps > planned reps by >10%
     - `'at'`: within 10%
     - `'under'`: completion_pct < 90%
     - `'incomplete'`: completion_pct < 50%
  5. Begin transaction:
     a. Insert `session_logs` row with all computed fields
     b. Update `sessions` row: `status = 'completed'`, `updated_at = NOW()`
  6. Publish `session.completed` Pub/Sub message: `{ session_log_id, user_id, session_id, lift, intensity_type, block_number }`
  7. Call `suggestProgramAdjustments()` from training-engine with recent logs (last 6 for same lift)
  8. If suggestions returned, store them as pending `formula_configs` rows with `source='ai_suggestion'`, `is_active=false` (surfaced separately via notification)
  9. Return the created `session_log`

**Input validation (Zod):**
- `actual_sets`: array of `{ set_number: number, weight_lbs: number, reps_completed: number, rpe_actual?: number, notes?: string }`
- `session_rpe`: optional number 6.0-10.0 in 0.5 increments
- `started_at`, `completed_at`: optional ISO timestamps (backfill support)

**Routes:**
- `POST /v1/sessions/:sessionId/complete`

## Dependencies

- [sessions-002-session-lifecycle-api.md](./sessions-002-session-lifecycle-api.md)
- [engine-005-performance-adjuster.md](./engine-005-performance-adjuster.md)
- [infra-002-gcp-project-bootstrap.md](./infra-002-gcp-project-bootstrap.md)
