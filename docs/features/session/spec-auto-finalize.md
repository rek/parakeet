# Spec: Auto-Finalize + Recovery

**Status**: Planned
**Domain**: Sessions
**Design**: [design-durability.md](./design-durability.md)

## What This Covers

Two safety nets once per-set persistence ships:

1. **Server-side auto-finalise** — if a user never taps End, the session still reaches a clean terminal state with its sets intact. No silent `skipped` on a session with logged work.
2. **Client-side recovery** — if the local store holds completed sets that the server has no record of (legacy writes, clock desync, clobbered store), surface the data and let the user reconcile.

## Tasks

### Server-side finalisation

- [ ] `apps/parakeet/src/modules/session/application/session.service.ts` — `abandonStaleInProgressSessions(userId)`
  - [ ] Replace current unconditional skip with:
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
  - [ ] Emit Sentry breadcrumb on every auto-finalise with `{ sessionId, setCount, hoursSince }`. Tag `auto_finalised: true` on the `session_logs` row (new column `auto_finalised boolean NOT NULL DEFAULT false`).

- [ ] Migration: `ALTER TABLE session_logs ADD COLUMN auto_finalised boolean NOT NULL DEFAULT false;`

- [ ] `STALE_SESSION_HOURS` stays at 48 (existing). Re-evaluate after one cycle of telemetry.

### Client-side recovery

- [ ] `apps/parakeet/src/platform/store/sessionStore.ts` — `initSession(sessionId, plannedSets)`
  - [ ] Before overwriting, check current store state:
    ```
    if (current.sessionId && current.sessionId !== sessionId) {
      const hasUnsyncedWork = current.actualSets.some(
        (s) => s.is_completed && !s.synced_at
      );
      if (hasUnsyncedWork) {
        throw new SessionStoreClobberError(current.sessionId, sessionId);
      }
    }
    ```
  - [ ] Caller handles `SessionStoreClobberError` by routing to recovery modal (see below).
  - [ ] Sentry breadcrumb on every throw.

- [ ] `apps/parakeet/src/modules/session/hooks/useSessionRecovery.ts` (new)
  - [ ] Mount at root layout (alongside `useSyncQueue`, `useMissedSessionReconciliation`).
  - [ ] On foreground + authed:
    1. Read `sessionStore.sessionId` and `actualSets`.
    2. If store holds `is_completed` sets with no `synced_at`:
       - Fetch server session by id.
       - If status ∈ {`skipped`, `missed`}: open recovery modal, `captureException` (post-fix should never happen).
       - If status ∈ {`in_progress`, `planned`}: flush unsynced sets via `persistSet` (normal path).
       - If status = `completed`: clear store (server already has the data, local is stale).

- [ ] `apps/parakeet/src/app/session/recovery.tsx` (new route)
  - [ ] Displays unsynced sets with date, lift, weight × reps × rpe.
  - [ ] Actions:
    - **Resume**: flip server session back to `in_progress` (if not completed elsewhere), flush sets, navigate to session screen.
    - **Save as-is**: flip to `in_progress`, flush sets, auto-finalise immediately (no RPE prompt).
    - **Discard**: clear local store. Confirm dialog. Sentry breadcrumb.

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
