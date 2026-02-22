# Spec: Offline Sync and Optimistic State

**Status**: Planned
**Domain**: Mobile App

## What This Covers

Handling offline scenarios during active workout logging. The session logging screen must work without network connectivity; data syncs when connectivity is restored.

## Tasks

**Core problem:** A user may lose connectivity during a workout. We must not lose their logged sets.

**Strategy: Optimistic local state with background sync queue**

**`apps/mobile/store/sessionStore.ts` (Zustand + MMKV persistence):**
- All set updates are written to MMKV immediately (survives app crash)
- State is never lost between app background/foreground cycles
- `actualSets` array is the authoritative in-progress state

**`apps/mobile/store/syncStore.ts` (pending operations queue):**
- Queue of pending API operations: `{ id, endpoint, method, body, createdAt }`
- Operations are added optimistically before the network request
- On success: remove from queue
- On failure (network error): keep in queue, retry on reconnect
- On non-retryable error (4xx): surface to user, do not retry

**Session completion offline handling:**
- If `POST /v1/sessions/:sessionId/complete` fails due to network:
  1. Store complete payload in MMKV under key `pending_session_completion_:sessionId`
  2. Show success UI to user (optimistic) with a small sync indicator
  3. Register background fetch task (`expo-background-fetch`) to retry when online
  4. On next app foreground + connectivity: retry the pending completion

**Connectivity detection:**
- Use `@react-native-community/netinfo` to detect online/offline state
- Show offline banner in session screen when connectivity is lost
- Banner disappears and pending sync triggers when connectivity restored

**Conflict resolution:**
- Server wins for program data (planned sets, session schedule)
- Client wins for session log data (what the user actually lifted — never overwrite with server data)
- If session was somehow completed on the server during an offline period: compare `logged_at` timestamps; keep the most recent

**React Query integration:**
- Mutations (complete session, skip session) use React Query's `onMutate` / `onError` / `onSettled` for optimistic updates
- If mutation fails: rollback optimistic state and re-fetch from server

## Dependencies

- [mobile-005-session-logging-screen.md](./mobile-005-session-logging-screen.md)
