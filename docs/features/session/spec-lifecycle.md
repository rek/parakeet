# Spec: Session Lifecycle (Supabase Direct)

**Status**: Implemented
**Domain**: Sessions & Performance

## What This Covers

Helpers for transitioning session status: starting, skipping. Session completion is in sessions-003. All writes go directly to Supabase; no backend API server. RLS ensures each user can only modify their own sessions.

## Tasks

**`apps/parakeet/src/modules/session/application/session.service.ts` (lifecycle helpers):**
- [x] `startSession(sessionId: string): Promise<void>` — transition `planned → in_progress`; guarded with `.eq('status', 'planned')`
- [x] `skipSession(sessionId: string, reason?: string): Promise<void>` — transition `planned | in_progress → skipped`
- [x] `getInProgressSession(userId: string): Promise<{ id: string } | null>` — returns the active in_progress session, if any

**Status transition rules:**
- `planned → in_progress` — valid (startSession)
- `planned → skipped` — valid (skipSession)
- `in_progress → skipped` — valid (skipSession)
- `completed → *` — invalid; completed sessions are immutable
- `skipped → *` — invalid; skipped sessions are immutable

The `.eq('status', ...)` guards silently no-op on invalid transitions. The UI prevents invalid starts at the UI layer (see below).

**Single active session enforcement:**
- Only one `in_progress` session is permitted per user at a time
- Enforced at the UI layer: both `WorkoutCard` and `SessionSummary` check `useInProgressSession()` at render time
  - `WorkoutCard`: if another session is active, "Start Workout" shows as greyed "Another session active" (no-op)
  - `SessionSummary`: planned rows dim to 45% opacity + 🔒 icon; tap is disabled
- No `Alert.alert()` dialogs are used; the locked state is entirely visual

**Stale session auto-abandon:**
- `abandonStaleInProgressSessions(userId)` runs on app foreground (alongside `markMissedSessions`)
- An `in_progress` session whose `planned_date` is more than 48 hours ago is handled as follows:
  - **0 `set_logs` rows** → marked `skipped` (existing behaviour, nothing to save).
  - **≥1 `set_logs` rows** → **auto-finalised**, not skipped. See [spec-auto-finalize.md](./spec-auto-finalize.md). Never silently drop a session that contains real logged work.
- Prevents the user from being locked out of new workouts after an interrupted session (e.g., phone dies mid-workout) **without** discarding sets they already confirmed.

**Soreness check-in gate:**
- [x] Before `startSession()` is called, the app routes through `session/soreness.tsx` **only for `planned` sessions**
  - The soreness check-in writes to `soreness_checkins` and triggers JIT generation
  - The actual `startSession()` call happens inside `session/[sessionId].tsx` after JIT data is loaded
- [x] Resuming an `in_progress` session bypasses the soreness screen entirely — navigates directly to `session/[sessionId]` with cached JIT data

## Dependencies

- [sessions-001-session-read-api.md](./sessions-001-session-read-api.md)
- [mobile-011-soreness-checkin-screen.md](../soreness-and-readiness/spec-soreness-screen.md)
- [engine-007-jit-session-generator.md](../jit-pipeline/spec-generator.md)
- [spec-set-persistence.md](./spec-set-persistence.md) — DB trigger flips `planned → in_progress` on first set insert.
- [spec-auto-finalize.md](./spec-auto-finalize.md) — stale-session handling branches on `set_logs` count.
