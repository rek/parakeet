# Spec: Auto-Finalize + Recovery

**Status**: In Progress (server auto-finalise shipped 2026-04-17; client recovery modal pending)
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
  - [ ] Sentry breadcrumb on each auto-finalise (deferred — add alongside recovery-modal telemetry).

- [x] Migration: `ALTER TABLE session_logs ADD COLUMN auto_finalised boolean NOT NULL DEFAULT false;` — see `20260417000000_create_set_logs.sql`.

- [x] `STALE_SESSION_HOURS` stays at 48. Re-evaluate after one cycle of telemetry.

### Client-side recovery

Taken a simpler shape than originally specced. Rather than a throwing `initSession` + modal/route, the session screen calls `flushUnsyncedSets(userId)` **before** clobbering the store. That:

- Forces any unsynced set into the per-set queue (idempotent upserts).
- Lets the server-side auto-finalise handle the old session if the user never returns to it.
- Eliminates the "you have unsynced work, resume / save / discard?" modal entirely.

Implementation:

- [x] `apps/parakeet/src/platform/store/sessionStore.ts` — `wouldClobberSessionStore(newSessionId)` selector exposed for diagnostic/telemetry use.
- [x] `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx` — calls `flushUnsyncedSets(user.id)` before both `initSession` sites (JIT-driven and free-form ad-hoc) when the stored `sessionId` differs.
- [x] `apps/parakeet/src/modules/session/hooks/useSetPersistence.ts` — on mount, calls `flushUnsyncedSets` to recover crash/pre-subscriber unsynced work.

Deferred (not blocking durability):
- [ ] Sentry tagging and a dedicated recovery screen for pathological cases (e.g. local store holds completed sets while the server session is `skipped`/`missed`). Today those will get flushed to the server; auto-finalise will then convert the server session to `completed`. The dedicated route is nice-to-have UX, not a data-safety requirement.

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
