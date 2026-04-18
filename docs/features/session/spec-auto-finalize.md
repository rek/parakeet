# Spec: Auto-Finalize + Recovery

**Status**: Implemented (2026-04-18) — server auto-finalise + Sentry breadcrumb + client recovery hook + recovery Alert flow are all live. Dedicated recovery route intentionally skipped in favour of the Alert scaffold; good enough for the rare pathological case.
**Domain**: Sessions
**Design**: [design-durability.md](./design-durability.md)

## What This Covers

Two safety nets once per-set persistence ships:

1. **Server-side auto-finalise** — if a user never taps End, the session still reaches a clean terminal state with its sets intact. No silent `skipped` on a session with logged work.
2. **Client-side recovery** — if the local store holds completed sets that the server has no record of (legacy writes, clock desync, clobbered store), surface the data and let the user reconcile.

## Tasks

### Server-side finalisation

- [x] `apps/parakeet/src/modules/session/application/session.service.ts` — `abandonStaleInProgressSessions(userId)`
  - [x] Replaces the unconditional skip with:
    ```
    1. Fetch stale in_progress session(s) older than STALE_SESSION_HOURS.
    2. For each: count set_logs rows.
    3. If count == 0: mark skipped (existing behaviour).
    4. If count > 0: auto-finalise.
       - Insert session_logs summary row using latest set_logs for actual_sets snapshot
         (transitional; remove once history reads from set_logs).
       - completed_at = max(logged_at) from set_logs.
       - session_rpe = null (user never provided one).
       - Set status = 'completed'.
       - Do NOT run performance adjuster (no session_rpe, unreliable signal).
       - Do NOT detect achievements (require explicit End for PRs — avoids surprise PRs on auto-finalised partials).
    ```
  - [x] `auto_finalised: true` column on `session_logs` ships in the same migration as `set_logs`.
  - [x] Sentry breadcrumb on each auto-finalise (category: `session.durability`, level: info, data: `sessionId`, `setCount`).

- [x] Migration: `ALTER TABLE session_logs ADD COLUMN auto_finalised boolean NOT NULL DEFAULT false;` — see `20260417000000_create_set_logs.sql`.

- [x] `STALE_SESSION_HOURS` stays at 48. Re-evaluate after one cycle of telemetry.

### Client-side recovery

Ended up with a two-tier approach:

**Tier 1 — silent flush (happy path).** The session screen calls `flushUnsyncedSets(userId)` before `initSession` clobbers the store with a different session. `useSetPersistence` also calls it on mount. Any unsynced set lands in `set_logs` (or the per-set sync queue if offline). Auto-finalise picks up the old server session next foreground.

**Tier 2 — pathological-case Alert.** `useSessionRecovery` (root-mounted) detects when the local store holds unsynced completed sets whose server-side session is `skipped` / `missed` (the exact shape of the 2026-04-15 incident). Fires a `captureException` for observability and surfaces an Alert with Save / Discard. Save re-animates the session via `reviveSkippedSessionToInProgress`, flushes the local sets, then auto-finalises.

Implementation:

- [x] `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx` — `flushUnsyncedSets(user.id)` before both `initSession` sites.
- [x] `apps/parakeet/src/modules/session/hooks/useSetPersistence.ts` — mount-time flush.
- [x] `apps/parakeet/src/modules/session/hooks/useSessionRecovery.ts` (new) — foreground detection + Alert for skipped / missed case.
- [x] `apps/parakeet/src/modules/session/application/session.service.ts::recoverSkippedSessionFromLocal` — service fn that the Alert's Save action calls.
- [x] `apps/parakeet/src/modules/session/data/session.repository.ts::reviveSkippedSessionToInProgress` — guarded status flip used by the recovery fn.
- [x] `apps/parakeet/src/app/_layout.tsx` — mounts `useSessionRecovery(user?.id)`.

Dedicated recovery route deliberately skipped — the Alert gives Save / Discard in two taps with the full data safety net. A richer modal is backlog material if telemetry shows users hitting the pathological case often.

### Telemetry

- [ ] Add Sentry tags on all auto-finalise + clobber + recovery events: `session_durability: <event>`.
- [ ] Count `auto_finalised = true` in `session_logs` weekly. If > 0 steady-state, investigate — user is consistently forgetting End.

## Tests

### Unit
- [ ] `abandonStaleInProgressSessions` with 0 `set_logs` → marks skipped.
- [ ] Same with ≥1 `set_logs` → auto-finalises; `session_logs.auto_finalised = true`; achievements NOT called.
- [ ] `initSession` with different sessionId + unsynced completed set → throws `SessionStoreClobberError`.
- [ ] `initSession` with same sessionId → no throw.
- [ ] `initSession` with different sessionId but all sets synced → no throw (clears safely).

### Integration
- [ ] Simulate: log sets Mon, skip End, foreground Wed → session `completed`, sets present, `auto_finalised=true`, no achievements.
- [ ] Simulate: local store has unsynced Wed sets, server session is `skipped` → recovery modal opens; user taps Save → server session becomes `completed` with those sets.
- [ ] Simulate: crash mid-logging, reopen same session → no duplicate set rows, recovery modal not shown (synced path).

## Dependencies

- [spec-set-persistence.md](./spec-set-persistence.md) — provides `set_logs` used by finalisation logic.
- [spec-lifecycle.md](./spec-lifecycle.md) — `abandonStaleInProgressSessions` contract changes.
- [spec-completion.md](./spec-completion.md) — `completeSession` no longer writes sets.
