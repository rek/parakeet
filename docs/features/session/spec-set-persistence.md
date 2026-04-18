# Spec: Per-Set Persistence

**Status**: Implemented (2026-04-18) — all reads cut over, JSONB columns retained only as placeholder writes. Column drop documented at `tools/scripts/pending-drop-session-logs-jsonb.md`, coordinated with a follow-up client OTA.
**Domain**: Sessions
**Design**: [design-durability.md](./design-durability.md)

## What This Covers

Durable per-set storage. Each confirmed set writes to the server immediately on tap, not in a batch at End-of-workout. Eliminates the class of bugs where forgetting to tap End, crashing, or reinstalling wipes a full session of logged work.

## Schema

### New table: `set_logs`

```sql
CREATE TABLE public.set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('primary', 'auxiliary')),
  exercise text,                     -- null for primary; aux exercise name for auxiliary
  set_number int NOT NULL,           -- 1-based; scoped per (session, kind, exercise)
  weight_grams int NOT NULL,
  reps_completed int NOT NULL,
  rpe_actual numeric(3,1),           -- nullable; 6.0–10.0 in 0.5 increments
  notes text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  corrected_by uuid REFERENCES public.set_logs(id),  -- for future corrections flow
  UNIQUE (session_id, kind, exercise, set_number)
);

CREATE INDEX set_logs_session_id_idx ON public.set_logs(session_id);
CREATE INDEX set_logs_user_id_logged_at_idx ON public.set_logs(user_id, logged_at DESC);

ALTER TABLE public.set_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "set_logs owner read" ON public.set_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "set_logs owner write" ON public.set_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Updates only allowed via corrections flow (future); for now no update policy.
```

### Unique constraint rationale
`(session_id, kind, exercise, set_number)` with `NULLS NOT DISTINCT` (Postgres 15+) — idempotent upsert target. Repeated writes for the same set (retry, late sync) collapse to one row. `NULLS NOT DISTINCT` avoids the default Postgres behaviour that treats NULL exercise values as distinct, so primary-set rows dedupe correctly. (Originally planned as a generated `exercise_key` column; ended up simpler.)

### Trigger: flip to `in_progress` on first set
```sql
CREATE FUNCTION public.set_logs_mark_in_progress() RETURNS trigger AS $$
BEGIN
  UPDATE public.sessions
  SET status = 'in_progress'
  WHERE id = NEW.session_id
    AND status = 'planned';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_logs_mark_in_progress_trigger
AFTER INSERT ON public.set_logs
FOR EACH ROW EXECUTE FUNCTION public.set_logs_mark_in_progress();
```
Guarantees the server status reflects reality without a separate client call race.

## Tasks

### Data layer
- [x] `apps/parakeet/src/modules/session/data/session.repository.ts`
  - [x] `upsertSetLog(input: UpsertSetLogInput): Promise<void>` — idempotent upsert on `(session_id, kind, exercise, set_number)`.
  - [x] `fetchSetLogs(sessionId: string): Promise<SetLogRow[]>` — ordered by `kind, exercise, set_number`.
  - [x] `countSetLogsForSession(sessionId: string): Promise<number>` — used by `abandonStaleInProgressSessions` to decide skip vs auto-finalise.
  - [ ] `deleteSetLog(sessionId: string, kind, exercise, setNumber)` — deferred; requires corrections UX.

### Application layer
- [x] `apps/parakeet/src/modules/session/application/set-persistence.service.ts` (new)
  - [x] `persistSet(args)` — best-effort upsert; on network error enqueues `upsert_set_log`, on non-network error captures to Sentry. Never throws.
  - [x] `flushUnsyncedSets(userId)` — iterates store, fires persistSet for every `is_completed && !synced_at` set. Called on session screen mount and before `initSession` clobbers state.
- [x] `apps/parakeet/src/modules/session/application/session.service.ts`
  - [x] Added `auto_finalised` to `insertSessionLog` shape (feeds into `abandonStale` rewrite).
  - [ ] `completeSession` still writes `session_logs.actual_sets` / `auxiliary_sets` during dual-write window. Legacy batch remains authoritative until history reads cut over.

### Hook layer
- [x] `apps/parakeet/src/modules/session/hooks/useSetPersistence.ts` (new)
  - Subscribes to `sessionStore`, diffs primary+aux snapshots on each change, fires `persistSet` for transitions to completed and for edits to already-completed sets. Skips the initial rehydrate fire via snapshot seeding.
  - Mounted in `app/(tabs)/session/[sessionId].tsx`.
- [ ] `apps/parakeet/src/modules/session/hooks/useSetCompletionFlow.ts` — unchanged. The subscriber-based approach in `useSetPersistence` covers every `updateSet` / `updateAuxiliarySet` call site without per-handler wiring.

### Store
- [x] `apps/parakeet/src/platform/store/sessionStore.ts`
  - [x] `synced_at?: string` added to `ActualSet` and `AuxiliaryActualSet`.
  - [x] `updateSet` / `updateAuxiliarySet` clear `synced_at` when any value field changes (ensures the subscriber re-syncs edits).
  - [x] `markSetSynced` / `markAuxSetSynced` actions — called by `persistSet` success path and `useSyncQueue` drain.
  - [x] `wouldClobberSessionStore(newSessionId)` selector — true when there are completed-but-unsynced sets on a different session.

### Sync queue
- [x] `apps/parakeet/src/platform/store/syncStore.ts`
  - [x] New op kind `upsert_set_log` with payload matching `UpsertSetLogInput`.
  - [x] Dedupe on enqueue: re-enqueueing for the same `(sessionId, kind, exercise, set_number)` replaces the prior op (latest wins).
  - [x] `hasPendingForSession(sessionId)` helper for recovery flows.
- [x] `apps/parakeet/src/modules/session/hooks/useSyncQueue.ts`
  - [x] Drain handles `upsert_set_log` via `upsertSetLog`, marks matching store entry synced on success, standard retry semantics on network failure.

### History reads
- [x] `apps/parakeet/src/modules/history/` — reads set data via `getSessionSetsBySessionIds`, exported from session module's service layer (internal name in the repo is `fetchSessionSetsBySessionIds`; exposed publicly as the service-named `getSessionSetsBySessionIds` per ai-learnings.md barrel-leak rule). Consumers across JIT, achievements, cycle-review, body-review, motivational-message, export, and decision-replay also migrated.

## Backfill

Migration script (one-shot, idempotent):
```sql
INSERT INTO public.set_logs (session_id, user_id, kind, exercise, set_number, weight_grams, reps_completed, rpe_actual, notes, logged_at)
SELECT
  sl.session_id,
  sl.user_id,
  'primary',
  NULL,
  (s->>'set_number')::int,
  (s->>'weight_grams')::int,
  (s->>'reps_completed')::int,
  NULLIF(s->>'rpe_actual','')::numeric,
  s->>'notes',
  sl.completed_at
FROM public.session_logs sl,
     jsonb_array_elements(COALESCE(sl.actual_sets, '[]'::jsonb)) AS s
ON CONFLICT DO NOTHING;

-- Same for auxiliary_sets with kind='auxiliary', exercise = s->>'exercise'.
```

## Tests

### Unit
- [ ] `persistSet` idempotent: two calls with same `(session, kind, exercise, set_number)` produce one row.
- [ ] `persistSet` offline: enqueues, does not throw; queue drain resolves on reconnect.
- [ ] Store dedupe: re-enqueue with same set replaces payload.

### Integration
- [ ] Log 3 primary sets, kill process cold, reopen app → `set_logs` has 3 rows; session status = `in_progress`.
- [ ] Log 3 sets online, 2 aux sets offline → reconnect → server has 5 rows.
- [ ] Run backfill on a DB snapshot → row count equals sum of `jsonb_array_length(actual_sets) + jsonb_array_length(auxiliary_sets)` across existing `session_logs`.

### RLS
- [ ] Other-user cannot select / insert against a session they don't own.
- [ ] First-set trigger flips `planned → in_progress` but leaves `completed` untouched.

## Rollout

1. **(done 2026-04-17)** Ship migration + per-set dual-write. Backfill `tools/scripts/backfill-set-logs.sql` applied in prod (332 rows).
2. **(done 2026-04-18)** Cut every JSONB reader over to `getSessionSetsBySessionIds`. No consumer reads `session_logs.actual_sets` / `auxiliary_sets` any more.
3. **(done 2026-04-18)** Stop deriving the JSONB arrays in `completeSession` / `autoFinaliseSession`. Writes still include placeholder `[]` / `null` for schema compat.
4. **Pending** — coordinated deploy: (a) DB migration to loosen `actual_sets` NOT NULL + add default, (b) client OTA to stop sending the placeholder fields, (c) DB migration to drop the columns. See `tools/scripts/pending-drop-session-logs-jsonb.md`.

## Dependencies

- [spec-completion.md](./spec-completion.md) — completion responsibility shrinks.
- [spec-auto-finalize.md](./spec-auto-finalize.md) — depends on `set_logs` to gate auto-skip.
- [spec-offline.md](./spec-offline.md) — queue carries per-set ops.
