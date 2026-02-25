# Spec: Session Read (Supabase Direct)

**Status**: Implemented
**Domain**: Sessions & Performance

## What This Covers

Helper functions for reading session data from Supabase. Used by the Today screen, Program view, and History tab. No REST API server — Supabase SDK is called directly from the app.

## Tasks

**`apps/parakeet/lib/sessions.ts` (read helpers):**
- [x] `findTodaySession(userId: string): Promise<Session | null>` — nearest upcoming session with status `planned` or `in_progress`, ordered by planned_date ascending
- [x] `getSession(sessionId: string): Promise<Session | null>` — full session detail including `planned_sets` (RLS ensures ownership)
- [x] `getSessionsForWeek(programId: string, weekNumber: number): Promise<Session[]>` — all sessions for a week, excluding `planned_sets` for performance
- [x] `getCompletedSessions(userId: string, page: number, pageSize?: number): Promise<Session[]>` — paginated list of completed sessions for History tab

**Note on `planned_sets`:** Sessions are created with `planned_sets = null`. The field is only populated after the JIT generator runs (when the user opens the session after the soreness check-in). The `jit_generated_at` column indicates whether JIT has run for a session.

## Dependencies

- [programs-002-program-generation-api.md](../06-programs/programs-002-program-generation-api.md)
- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
