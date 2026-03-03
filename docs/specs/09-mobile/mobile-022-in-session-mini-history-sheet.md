# Spec: In-Session Mini History Sheet

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Adds a quick, context-aware history surface for the active lift while a session is in progress. The user can check recent performance without navigating away from the session logging flow.

## Tasks

**Trigger behavior**
- [ ] Add a new banner interaction mode for active sessions: tapping the return banner opens a mini history sheet after returning to the session route.
- [ ] Keep current one-tap return behavior available as fallback when history data cannot be loaded.

**`apps/parakeet/src/app/session/[sessionId].tsx`:**
- [ ] Add a bottom-sheet/modal section for "Recent [Lift] Performance".
- [ ] Sheet content must be read-only and non-blocking for set logging.
- [ ] Sheet closes independently; session timer and set state remain intact.

**Mini history content**
- [ ] Show last 3-5 completed sessions for the same lift:
  - planned date
  - top estimated 1RM (if available)
  - session RPE
  - completion %
- [ ] Show a compact trend indicator (improving/stable/declining) for that lift.
- [ ] Show an empty-state message when no prior lift data exists.

**Data/query**
- [ ] Add a dedicated query helper scoped to `userId + lift` for lightweight recent-history reads.
- [ ] Query should not fetch full program/session payloads; keep response small for in-workout responsiveness.

**Resilience**
- [ ] If query fails, show inline error state in the sheet and keep session logging fully usable.
- [ ] If offline, show cached data when available; otherwise show "history unavailable offline".

## Dependencies

- [mobile-021-in-session-history.md](./mobile-021-in-session-history.md) — active-session banner and return flow
- [mobile-020-history-screen.md](./mobile-020-history-screen.md) — existing history data patterns
- [mobile-017-rest-timer.md](./mobile-017-rest-timer.md) — timer must continue during sheet interaction
