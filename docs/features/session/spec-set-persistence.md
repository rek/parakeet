# Spec: Per-Set Persistence

**Status**: Planned
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
`(session_id, kind, exercise, set_number)` — idempotent upsert target. Repeated writes for the same set (retry, late sync) collapse to one row. For primary sets, `exercise` is `NULL`; Postgres treats NULLs as distinct in UNIQUE by default — handle with `COALESCE(exercise, '')` in a partial index or use a generated column. Implementation: add a generated column `exercise_key text GENERATED ALWAYS AS (COALESCE(exercise, '')) STORED` and make the unique on `(session_id, kind, exercise_key, set_number)`.

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
- [ ] `apps/parakeet/src/modules/session/data/session.repository.ts`
  - [ ] `upsertSetLog(input: UpsertSetLogInput): Promise<void>` — idempotent on `(session_id, kind, exercise_key, set_number)` via `.upsert({ onConflict: 'session_id,kind,exercise_key,set_number', ignoreDuplicates: false })`.
  - [ ] `fetchSetLogs(sessionId: string): Promise<SetLogRow[]>` — ordered by `kind, exercise, set_number`.
  - [ ] `deleteSetLog(sessionId: string, kind, exercise, setNumber)` — for uncheck; subject to confirmation UX, not auto-called.

### Application layer
- [ ] `apps/parakeet/src/modules/session/application/session.service.ts`
  - [ ] `persistSet(input: PersistSetInput): Promise<void>` — called from the set-confirmation handler. Enqueues on network failure via `syncStore`.
  - [ ] Remove set-batch write from `completeSession`. Keep `completeSession` responsible only for `session_logs` summary row, session status, performance adjuster, achievements.

### Hook layer
- [ ] `apps/parakeet/src/modules/session/hooks/useSetCompletionFlow.ts`
  - [ ] On `is_completed = true` transition for a set, call `persistSet()` before any other side-effect (rest timer, RPE prompt). Await it; surface a retry inline on failure.
  - [ ] On unchecking, **do not** auto-delete from server. Instead, mark locally and require explicit confirm to remove server row (prevents accidental loss).

### Store
- [ ] `apps/parakeet/src/platform/store/sessionStore.ts`
  - [ ] Add per-set `synced_at?: string` in `actualSets`/`auxiliarySets` entries.
  - [ ] `updateSet`/`updateAuxSet` do not mutate `synced_at`; only the success path in `persistSet` does.

### Sync queue
- [ ] `apps/parakeet/src/platform/store/syncStore.ts`
  - [ ] New op kind `'upsert_set_log'` with payload `{ sessionId, userId, kind, exercise, set_number, weight_grams, reps_completed, rpe_actual, notes, logged_at }`.
  - [ ] Dedupe on enqueue: if queue already contains an op with the same `(sessionId, kind, exercise, set_number)`, replace payload in place (latest wins).
- [ ] `apps/parakeet/src/modules/session/hooks/useSyncQueue.ts`
  - [ ] Drain handles `upsert_set_log` via `upsertSetLog`; same retry semantics as `complete_session`.

### History reads
- [ ] `apps/parakeet/src/modules/history/` — read sets from `set_logs` joined to `sessions`. `session_logs.actual_sets` only used as fallback during migration window.

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

1. Ship migration + dual-write. App continues to write `session_logs.actual_sets` as before.
2. Ship history reads from `set_logs` (fallback to `session_logs.actual_sets` when no `set_logs` exist for a session).
3. Run backfill in prod.
4. Verify parity for a release cycle.
5. Drop `session_logs.actual_sets` + `auxiliary_sets` columns. Remove dual-write.

## Dependencies

- [spec-completion.md](./spec-completion.md) — completion responsibility shrinks.
- [spec-auto-finalize.md](./spec-auto-finalize.md) — depends on `set_logs` to gate auto-skip.
- [spec-offline.md](./spec-offline.md) — queue carries per-set ops.
