# Spec: Offline Sync and Optimistic State

**Status**: Implemented (being extended for per-set queue — see [design-durability.md](./design-durability.md))
**Domain**: parakeet App

## What This Covers

Handling offline scenarios during active workout logging. Session logging works without network; data syncs when connectivity restores. After the durability redesign, the queue carries **per-set** ops, not just session-completion ops, so an unsent set survives reinstall.

## Tasks

**Core problem:** A user may lose connectivity — or tap End — with logged sets on device. We must not lose their sets.

**Strategy: Optimistic local state with per-set background sync queue**

**`src/platform/store/sessionStore.ts` (Zustand + AsyncStorage persistence):**
- All set updates are written to AsyncStorage immediately via Zustand `persist` middleware (survives app crash).
- `actualSets` array is the authoritative in-progress state on device.
- Each `actualSets` / `auxiliarySets` entry carries `synced_at?: string`, set only after the matching `upsert_set_log` drains successfully.
- `warmupCompleted` (Set) and `startedAt` (Date) require special handling: `warmupCompleted` excluded from persistence; `startedAt` rehydrated via custom `merge`.

**`src/platform/store/syncStore.ts` (pending operations queue):**
- Queue entries: `{ id, operation, payload, createdAt, retryCount }`.
- Operation kinds:
  - `upsert_set_log` — per-set write (primary or auxiliary). Payload keyed by `(sessionId, kind, exercise, set_number)`.
  - `complete_session` — session summary write (session_rpe, completed_at, adjuster trigger).
- `skip_session` is fire-and-forget (no queue entry).
- Dedupe on enqueue: an incoming `upsert_set_log` replaces an existing queued op with the same `(sessionId, kind, exercise, set_number)` — latest wins.
- On success: remove op, mark matching `actualSets` entry `synced_at`.
- On network error: keep in queue, `retryCount++`, retry on reconnect.
- On non-retryable error (constraint violation, auth): dequeue + `captureException` + alert.

**Per-set offline handling:**
- User taps check on a set → store updates locally → `persistSet()` called.
- If online: `upsertSetLog` succeeds → mark `synced_at`.
- If offline: enqueue `upsert_set_log` → UI shows set as confirmed with small pending indicator.
- On reconnect: `useSyncQueue` drains per-set ops first, then `complete_session` if present.

**Session completion offline handling:**
- `completeSession()` failure due to network → enqueue `complete_session` op (session summary only, since sets already queued/synced).
- Optimistic success UI with sync indicator.
- On reconnect + foreground: queue drains; per-set ops first (ordering matters: `complete_session` assumes set_logs present).

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

- `src/platform/store/syncStore.ts` — pending op queue
- `src/platform/store/sessionStore.ts` — added AsyncStorage persistence
- `src/platform/network/useNetworkStatus.ts` — pure-JS connectivity probe via `AppState` + `fetch` (no native module)
- `src/modules/session/hooks/useSyncQueue.ts` — drains queue on reconnect
- `src/app/session/[sessionId].tsx` — offline banner
- `src/app/session/complete.tsx` — offline-safe completion
- `src/app/_layout.tsx` — mounts `useSyncQueue`

## Dependencies

- [parakeet-005-session-logging-screen.md](./parakeet-005-session-logging-screen.md)
- [spec-set-persistence.md](./spec-set-persistence.md) — defines `upsert_set_log` op and `set_logs` schema.
- [spec-auto-finalize.md](./spec-auto-finalize.md) — server-side safety net when End never fires.
