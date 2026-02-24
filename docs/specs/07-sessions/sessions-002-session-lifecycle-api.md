# Spec: Session Lifecycle (Supabase Direct)

**Status**: Implemented
**Domain**: Sessions & Performance

## What This Covers

Helpers for transitioning session status: starting, skipping. Session completion is in sessions-003. All writes go directly to Supabase; no backend API server. RLS ensures each user can only modify their own sessions.

## Tasks

**`apps/parakeet/lib/sessions.ts` (lifecycle helpers, additions):**

```typescript
// Transition session to in_progress
async function startSession(sessionId: string): Promise<void> {
  await supabase
    .from('sessions')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'planned')  // guard: only planned sessions can be started
}

// Skip a session (planned or in_progress → skipped)
async function skipSession(sessionId: string, reason?: string): Promise<void> {
  await supabase
    .from('sessions')
    .update({ status: 'skipped', notes: reason ?? null })
    .eq('id', sessionId)
    .in('status', ['planned', 'in_progress'])
}
```

**Status transition rules:**
- `planned → in_progress` — valid (startSession)
- `planned → skipped` — valid (skipSession)
- `in_progress → skipped` — valid (skipSession)
- `completed → *` — invalid; completed sessions are immutable
- `skipped → *` — invalid; skipped sessions are immutable

The `.eq('status', ...)` and `.in('status', [...])` guards on Supabase updates silently no-op on invalid transitions (0 rows updated). The app checks for 0 rows affected and shows an error toast if needed.

**Soreness check-in gate:**
Before `startSession()` is called, the app must route through the soreness screen (`session/soreness.tsx`). The soreness check-in writes to `soreness_checkins` and then triggers JIT generation before the session begins. The actual `startSession()` call happens after JIT completes and the user taps "Start Workout".

## Dependencies

- [sessions-001-session-read-api.md](./sessions-001-session-read-api.md)
- [parakeet-011-soreness-checkin-screen.md](../09-parakeet/parakeet-011-soreness-checkin-screen.md)
- [engine-007-jit-session-generator.md](../04-engine/engine-007-jit-session-generator.md)
