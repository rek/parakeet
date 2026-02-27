# Spec: Offline Sync and Optimistic State

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Handling offline scenarios during active workout logging. The session logging screen must work without network connectivity; data syncs when connectivity is restored.

## Tasks

**Core problem:** A user may lose connectivity during a workout. We must not lose their logged sets.

**Strategy: Optimistic local state with background sync queue**

**`apps/parakeet/store/sessionStore.ts` (Zustand + MMKV persistence):**
- All set updates are written to MMKV immediately (survives app crash)
- State is never lost between app background/foreground cycles
- `actualSets` array is the authoritative in-progress state

**`apps/parakeet/store/syncStore.ts` (pending operations queue):**
- Queue of pending Supabase SDK operations: `{ id, operation: 'complete_session' | 'skip_session', payload, createdAt }`
- Operations are added optimistically before the Supabase call
- On success: remove from queue
- On failure (network error): keep in queue, retry on reconnect
- On non-retryable error (Supabase constraint violation, auth error): surface to user, do not retry

**Session completion offline handling:**
- If `completeSession()` Supabase SDK call fails due to network:
  1. Store complete payload in MMKV under key `pending_session_completion_:sessionId`
  2. Show success UI to user (optimistic) with a small sync indicator
  3. Register background fetch task (`expo-background-fetch`) to retry when online
  4. On next app foreground + connectivity: retry the pending Supabase `upsert` to `session_logs`

**Connectivity detection:**
- Show offline banner in session screen when connectivity is lost
- Banner disappears and pending sync triggers when connectivity restored

**Conflict resolution:**
- Server wins for program data (planned sets, session schedule)
- Client wins for session log data (what the user actually lifted — never overwrite with server data)
- If session was somehow completed on the server during an offline period: compare `logged_at` timestamps; keep the most recent

**React Query integration:**
- Mutations (complete session, skip session) use React Query's `onMutate` / `onError` / `onSettled` for optimistic updates
- If mutation fails: rollback optimistic state and re-fetch from server

## Implementation Notes

- AsyncStorage used instead of MMKV (already installed, avoids native module overhead)
- `expo-background-fetch` not used; queue drains on foreground + connectivity restore
- `sessionStore` uses Zustand `persist` + AsyncStorage; `warmupCompleted` (Set) and `startedAt` (Date) excluded from persistence to avoid serialization issues
- `syncStore` persists queue to AsyncStorage; survives app restart/crash
- `useSyncQueue` mounted at root layout; processes up to `MAX_RETRIES=5` per op
- Non-retryable errors (Supabase constraint, auth) dequeue + alert user
- Network errors detected by message heuristic (`isNetworkError` in `useSyncQueue.ts`)

## Files

- `src/store/syncStore.ts` — pending op queue
- `src/store/sessionStore.ts` — added AsyncStorage persistence
- `src/hooks/useNetworkStatus.ts` — pure-JS connectivity probe via `AppState` + `fetch` (no native module)
- `src/hooks/useSyncQueue.ts` — drains queue on reconnect
- `src/app/session/[sessionId].tsx` — offline banner
- `src/app/session/complete.tsx` — offline-safe completion
- `src/app/_layout.tsx` — mounts `useSyncQueue`

## Dependencies

- [parakeet-005-session-logging-screen.md](./parakeet-005-session-logging-screen.md)
