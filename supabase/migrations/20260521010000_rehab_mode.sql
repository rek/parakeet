-- Rehab Mode: per-lift long-term capacity cap. See docs/features/rehab-mode/.
--
-- A `rehab_caps` row represents a lifter capping a single main lift at a
-- specified working weight for the duration of a rehab/injury block. Unlike
-- the `disruptions` table (transient, % weight reduction with a Mark Resolved
-- flow), a rehab cap is structural — the engine treats it as a hard ceiling
-- and suppresses auto-progression, PR detection, working-1RM updates, and
-- volume top-up while it's active.
--
-- The partial unique index `(user_id, lift) where ended_at is null` enforces
-- at most one active cap per lift per user. Ending a cap (setting
-- ended_at = now()) frees the slot so a future rehab block can be started
-- without losing the history of the previous one.
--
-- New columns on set_logs:
--   during_rehab — set server-side at write time if a rehab cap is active
--                  for the parent session's primary lift. Once stamped, never
--                  changes (the set was logged in a rehab context, period).
--   pain_limited — user toggled the "pain-limited" pill on the RPE picker
--                  for this set. Stored alongside rpe_actual but excluded
--                  from auto-progression / working-1RM / PR detection.
--
-- See GH#220.

create table public.rehab_caps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lift text not null check (lift in ('squat', 'bench', 'deadlift')),
  cap_kg numeric(6, 2) not null check (cap_kg > 0),
  note text,
  planned_end_date date,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index rehab_caps_one_active_per_lift_idx
  on public.rehab_caps (user_id, lift)
  where ended_at is null;

create index rehab_caps_user_lift_idx
  on public.rehab_caps (user_id, lift, ended_at);

-- updated_at bump on UPDATE
create function rehab_caps_touch_updated() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger rehab_caps_touch_updated_trigger
  before update on public.rehab_caps
  for each row
  execute function rehab_caps_touch_updated();

alter table public.rehab_caps enable row level security;

create policy "rehab_caps owner select" on public.rehab_caps
  for select using (auth.uid() = user_id);

create policy "rehab_caps owner insert" on public.rehab_caps
  for insert with check (auth.uid() = user_id);

create policy "rehab_caps owner update" on public.rehab_caps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "rehab_caps owner delete" on public.rehab_caps
  for delete using (auth.uid() = user_id);

-- Explicit Data API grants (Supabase default-deny lands 2026-10-30).
grant all on table public.rehab_caps to anon;
grant all on table public.rehab_caps to authenticated;
grant all on table public.rehab_caps to service_role;

-- Per-set flags. Default false; backfill is implicit via DEFAULT.
alter table public.set_logs
  add column during_rehab boolean not null default false,
  add column pain_limited boolean not null default false;

notify pgrst, 'reload schema';
