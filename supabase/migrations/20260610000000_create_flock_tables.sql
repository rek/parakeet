-- Flock: a closed, opt-in motivational feed for a friends-and-family instance.
--
-- `flock_highlights` is a SANITIZED PROJECTION, not a view onto training data.
-- Every lifter publishes their own single current row (PR / Wilks / streak /
-- "trained" headline). Friends read all rows. The columns here ARE the privacy
-- contract: there is deliberately NO session_logs / bodyweight / cycle /
-- lipedema data. Adding such a column is a design decision, not a schema tweak.
-- See docs/features/flock/.
--
-- `flock_config` holds the per-user "share my highlights" opt-in (default off).

create table flock_highlights (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  headline text not null,
  headline_kind text not null
    check (headline_kind in ('pr', 'wilks', 'streak', 'trained')),
  -- Populated only when headline_kind = 'pr'. Weight in integer GRAMS (KG-only
  -- app stores grams; 142.5kg = 142500).
  latest_pr_lift text,
  latest_pr_weight_g integer check (latest_pr_weight_g is null or latest_pr_weight_g >= 0),
  latest_pr_reps integer check (latest_pr_reps is null or latest_pr_reps >= 0),
  wilks integer,
  wilks_delta integer,
  streak_weeks integer check (streak_weeks is null or streak_weeks >= 0),
  published_at timestamptz not null default now()
);

create index flock_highlights_published_at_idx
  on flock_highlights (published_at desc);

create table flock_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sharing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- RLS — highlights: everyone in the closed instance reads all sharer rows;
-- only the owner may write their own row (keeps the projection honest).
alter table flock_highlights enable row level security;

create policy "flock_highlights read" on flock_highlights
  for select to authenticated using (true);
create policy "flock_highlights insert own" on flock_highlights
  for insert to authenticated with check (auth.uid() = user_id);
create policy "flock_highlights update own" on flock_highlights
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "flock_highlights delete own" on flock_highlights
  for delete to authenticated using (auth.uid() = user_id);

-- RLS — config: fully private to the owner.
alter table flock_config enable row level security;

create policy "flock_config owner all" on flock_config
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Explicit Data API grants (Supabase default-deny lands 2026-10-30).
grant all on table public.flock_highlights to anon;
grant all on table public.flock_highlights to authenticated;
grant all on table public.flock_highlights to service_role;

grant all on table public.flock_config to anon;
grant all on table public.flock_config to authenticated;
grant all on table public.flock_config to service_role;

notify pgrst, 'reload schema';
