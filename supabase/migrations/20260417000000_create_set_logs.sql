-- Per-set durability. Each confirmed set writes one append-only row here,
-- eliminating the class of data-loss bugs where forgetting to tap End wiped
-- a full session of local-only work. See docs/features/session/design-durability.md.

create table set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('primary', 'auxiliary')),
  exercise text,                        -- null for primary; aux exercise name otherwise
  set_number int not null check (set_number >= 1),
  weight_grams int not null check (weight_grams >= 0),
  reps_completed int not null check (reps_completed >= 0),
  rpe_actual numeric(3,1) check (rpe_actual is null or (rpe_actual >= 6 and rpe_actual <= 10)),
  actual_rest_seconds int check (actual_rest_seconds is null or actual_rest_seconds >= 0),
  exercise_type text,                   -- 'weighted' | 'bodyweight' | 'timed' etc. null for primary
  failed boolean not null default false,
  notes text,
  logged_at timestamptz not null default now(),
  corrected_by uuid references set_logs(id),

  -- Primary rows always have exercise=null, aux rows always have exercise set.
  constraint set_logs_exercise_matches_kind check (
    (kind = 'primary' and exercise is null)
    or (kind = 'auxiliary' and exercise is not null)
  )
);

-- Idempotent upsert key. NULLS NOT DISTINCT (pg15+) so primary rows
-- (exercise is null) dedupe correctly on (session_id, kind, set_number).
create unique index set_logs_unique_slot
  on set_logs (session_id, kind, exercise, set_number)
  nulls not distinct;

create index set_logs_session_id_idx on set_logs (session_id);
create index set_logs_user_logged_at_idx on set_logs (user_id, logged_at desc);

alter table set_logs enable row level security;

create policy "set_logs owner read" on set_logs
  for select using (auth.uid() = user_id);

create policy "set_logs owner insert" on set_logs
  for insert with check (auth.uid() = user_id);

-- No update/delete policy: append-only. Future corrections flow will write a
-- new row with corrected_by pointing to the superseded one.

-- First set on a planned session flips it to in_progress. Guarantees the
-- server status reflects reality without relying on a separate client call.
create function set_logs_mark_in_progress() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  update sessions
    set status = 'in_progress'
    where id = new.session_id
      and status = 'planned';
  return new;
end;
$$;

create trigger set_logs_mark_in_progress_trigger
  after insert on set_logs
  for each row
  execute function set_logs_mark_in_progress();

-- Tracks sessions finalised by abandonStaleInProgressSessions (user never
-- tapped End but set_logs rows existed). Used for telemetry and to suppress
-- achievement detection on auto-finalised summaries.
alter table session_logs
  add column auto_finalised boolean not null default false;
