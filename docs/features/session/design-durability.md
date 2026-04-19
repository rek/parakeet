# Design: Set Durability

**Status**: Implemented (2026-04-19) — append-only `set_logs`, per-set dual-write, offline queue, server auto-finalise, recovery Alert, and the coordinated column drop are all shipped. `session_logs.actual_sets` / `auxiliary_sets` were removed in migrations `20260419130000_loosen_session_logs_set_arrays.sql` + `20260419140000_drop_session_logs_set_arrays.sql`; every writer now targets `set_logs` exclusively.
**Date**: 2026-04-17

## Problem

A logged set can be permanently lost. Current flow:

1. User taps check on a set → state writes to `sessionStore` (Zustand + AsyncStorage).
2. Sets stay local until user taps **End Workout**.
3. `completeSession()` batch-writes `session_logs.actual_sets` (JSONB) and flips session to `completed`.

Anything that interrupts step 3 destroys every set in that session:

- User forgets to tap End → `abandonStaleInProgressSessions` flips `in_progress → skipped` after 48h. Server has no sets. Local store may be overwritten by the next `initSession()`.
- App reinstall / clear-data / store migration → AsyncStorage gone.
- `initSession(newId)` fires before user returns to the old session → `actualSets` overwritten in place, no prompt.
- Crash during `completeSession()` network call → sync queue only queues if `completeSession()` itself was called, i.e. only after End was tapped.

Real incident: 2026-04-15 bench session. User logged sets, never tapped End. Session sat in `planned` (or `in_progress`, same outcome), foreground reconciliation flipped it to `skipped`, no `session_logs` row ever existed, sets vanished.

## Principle

**A completed set is durable the moment the user confirms it.** End is finalisation, not persistence. Losing the End tap must cost at most a `session_rpe` value, never a set.

## Strategy

### Per-set persistence

New append-only `set_logs` table. One row per confirmed set. Written the instant `is_completed` flips to true on the device. Weights as integer grams. `session_logs.actual_sets` becomes derived (or dropped) after backfill.

Append-only over JSONB upsert because:
- Set data is immutable by nature — each confirmed set is a fact, not a mutable record.
- Natural dedupe key `(session_id, kind, set_number)` — kind ∈ {`primary`, `auxiliary`}, set_number scoped per exercise for aux.
- Trivial multi-device reconcile.
- Clean audit trail for future corrections flow.

### Status machine

- First `set_logs` insert for a session → flip `planned → in_progress` (DB trigger or client guaranteed-before-first-set).
- `abandonStaleInProgressSessions` must **never** skip an `in_progress` session that has ≥1 `set_logs` row. Instead, **auto-finalise**: insert a synthesised `session_logs` summary row (or compute from `set_logs` on read), mark `completed_at = last_set.logged_at`, `session_rpe = null`.
- `markMissedSessions` already excludes `in_progress`. No change.

### End is cosmetic

**End Workout** writes `session_rpe`, `completed_at`, and any aggregate stats (performance classification, achievement detection). If it fails or never fires, the auto-finaliser covers the gap. User loses no sets — only subjective session RPE.

### Local store guard

`initSession(newId)` refuses to overwrite a store that holds:
- a different `sessionId`, AND
- any `actualSets` entry with `is_completed: true` AND a set not yet present in `set_logs` on server.

Surface a recovery prompt. Log a Sentry breadcrumb on every would-be clobber.

### Recovery on foreground

If local store holds completed sets whose `sessionId` resolves to a `skipped` or `missed` server session → force-show recovery modal + `captureException` (post-fix, should be impossible; alarm if it fires).

### Queue

Sync queue stores per-set ops (`upsert_set_log`) alongside `complete_session`. Idempotent upsert on `(session_id, kind, exercise, set_number)`. Retries survive reinstall (already on AsyncStorage via Zustand persist).

## Non-Goals

- Changing the logging UI.
- Changing the performance adjuster / achievements pipeline (consumes the same shape post-finalisation).
- Cross-device live session sync (explicit out-of-scope; dedupe is sufficient).

## Migration (complete)

Phased dual-write + backfill → reader cutover → column drop:

1. **2026-04-17** — `set_logs` table created (`20260417000000_create_set_logs.sql`). Client + server started writing `set_logs` on every confirmed set while `session_logs.actual_sets` / `auxiliary_sets` continued to be written for back-compat.
2. **2026-04-17** — Historical backfill from JSONB into `set_logs` via `tools/scripts/backfill-set-logs.sql` (now archived).
3. **2026-04-18** — All readers (JIT, history, cycle review, export, assemble-coaching-context, video-analysis) cut over to synthesise `actual_sets` / `auxiliary_sets` buckets from `set_logs` via `fetchSessionSetsBySessionIds`.
4. **2026-04-19** — Migration A (`20260419130000_loosen_session_logs_set_arrays.sql`) dropped the `NOT NULL` on `actual_sets` and set a default of `'[]'::jsonb`. Client stopped sending the placeholder JSONB fields from `insertSessionLog` + `tools/scripts/import-csv.ts`.
5. **2026-04-19** — Migration B (`20260419140000_drop_session_logs_set_arrays.sql`) dropped both columns. All clients controlled in-house, so no soak period was needed. `tools/scripts/backfill-set-logs.sql` is a historical artefact and will error against the current schema — do not rerun.

## Specs

- [spec-set-persistence.md](./spec-set-persistence.md) — schema, writes, queue, backfill.
- [spec-auto-finalize.md](./spec-auto-finalize.md) — stale in_progress finalisation + local recovery UX.
- [spec-completion.md](./spec-completion.md) — End-of-workout responsibility shrinks.
- [spec-offline.md](./spec-offline.md) — queue entries per set.
- [spec-lifecycle.md](./spec-lifecycle.md) — `abandonStaleInProgressSessions` gated by `set_logs`.

## References

- 2026-04-15 data-loss incident (user `rekarnar@gmail.com`, session `3a50da65`).
- Existing AsyncStorage behaviour: `apps/parakeet/src/platform/store/sessionStore.ts`.
- Existing sync queue: `apps/parakeet/src/platform/store/syncStore.ts`, `apps/parakeet/src/modules/session/hooks/useSyncQueue.ts`.
