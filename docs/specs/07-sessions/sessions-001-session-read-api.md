# Spec: Session Read (Supabase Direct)

**Status**: Implemented
**Domain**: Sessions & Performance

## What This Covers

Helper functions for reading session data from Supabase. Used by the Today screen, Program view, and History tab. No REST API server — Supabase SDK is called directly from the app.

## Tasks

**`apps/mobile/lib/sessions.ts` (read helpers):**

```typescript
// Today's session: nearest upcoming session not yet completed/skipped
async function findTodaySession(userId: string): Promise<Session | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['planned', 'in_progress'])
    .gte('planned_date', today)
    .order('planned_date', { ascending: true })
    .limit(1)
    .single()
  return data
}

// Full session detail (used when opening a specific session)
async function getSession(sessionId: string): Promise<Session | null> {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  return data  // RLS ensures user can only access their own sessions
}

// All sessions for a given week of a program (used by Program week grid)
async function getSessionsForWeek(
  programId: string,
  weekNumber: number
): Promise<Session[]> {
  const { data } = await supabase
    .from('sessions')
    .select('id, week_number, day_number, primary_lift, intensity_type, block_number, is_deload, planned_date, status, jit_generated_at')
    .eq('program_id', programId)
    .eq('week_number', weekNumber)
    .order('planned_date', { ascending: true })
  return data ?? []
}

// Paginated list of completed sessions (History tab)
async function getCompletedSessions(
  userId: string,
  page: number,
  pageSize = 20
): Promise<Session[]> {
  const { data } = await supabase
    .from('sessions')
    .select('id, primary_lift, intensity_type, planned_date, status, week_number, block_number')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('planned_date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)
  return data ?? []
}
```

**Note on `planned_sets`:** Sessions are created with `planned_sets = null`. The field is only populated after the JIT generator runs (when the user opens the session after the soreness check-in). The `jit_generated_at` column indicates whether JIT has run for a session.

## Dependencies

- [programs-002-program-generation-api.md](../06-programs/programs-002-program-generation-api.md)
- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
