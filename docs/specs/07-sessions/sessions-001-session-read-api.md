# Spec: Session Read (Supabase Direct)

**Status**: Implemented
**Domain**: Sessions & Performance

## What This Covers

Helper functions for reading session data from Supabase. Used by the Today screen, Program view, and History tab. No REST API server — Supabase SDK is called directly from the app.

## Tasks

**`apps/parakeet/src/modules/session/application/session.service.ts` (read helpers; re-exported via `apps/parakeet/src/modules/session/application/session.service.ts`):**
- [x] `findTodaySession(userId: string): Promise<Session | null>` — priority: active `in_progress` → `completed` with `planned_date = today` (so the today screen can show "Workout Done") → nearest `planned` by `planned_date` ascending
- [x] `getSession(sessionId: string): Promise<Session | null>` — full session detail including `planned_sets` (RLS ensures ownership)
- [x] `getSessionsForWeek(programId: string, weekNumber: number): Promise<Session[]>` — all sessions for a week, excluding `planned_sets` for performance
- [x] `getCompletedSessions(userId: string, page: number, pageSize?: number): Promise<Session[]>` — paginated list of completed sessions for History tab

**Note on `planned_sets`:** Sessions are created with `planned_sets = null`. The field is only populated after the JIT generator runs (when the user opens the session after the soreness check-in). The `jit_generated_at` column indicates whether JIT has run for a session.

## Session Selection Contract

Today session lookup order:
1. return the earliest `in_progress` session for the user (by `planned_date`)
2. if none, return a `completed` session with `planned_date = today` (shows "Workout Done" on the today screen)
3. if none, return the nearest `planned` session (by `planned_date` ascending)
4. if none, return `null` (rest day or program complete state)

## Dependencies

- [programs-002-program-generation-api.md](../06-programs/programs-002-program-generation-api.md)
- [infra-003-supabase-setup.md](../01-infra/infra-003-supabase-setup.md)
