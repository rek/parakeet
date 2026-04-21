-- Symptom + measurement tracking for lipedema users.
--
-- One row per user per day. Measurements are stored per-limb (L/R) at
-- five standard landmarks: thigh mid-point, calf max circumference,
-- ankle, upper arm, wrist. All circumferences are integer millimetres
-- (consistent with parakeet's "integers at boundaries" convention;
-- lift weights are stored in grams, bodyweight in kg — millimetres
-- avoid float drift on subtraction across weekly deltas).
--
-- Pain and swelling are global 0-10 scores (0.5 step permitted via
-- numeric(3,1)). Notes and photo_url optional. Photo storage path is
-- a Supabase Storage reference — upload pipeline handled by the
-- module, not this migration.
--
-- All fields except user_id + recorded_date are nullable so a partial
-- entry (e.g. only pain today, no tape-measure) can still save.

create table if not exists public.lipedema_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_date date not null default current_date,

  -- Limb circumferences (millimetres). NULL = not measured this entry.
  thigh_mid_l_mm integer,
  thigh_mid_r_mm integer,
  calf_max_l_mm integer,
  calf_max_r_mm integer,
  ankle_l_mm integer,
  ankle_r_mm integer,
  upper_arm_l_mm integer,
  upper_arm_r_mm integer,
  wrist_l_mm integer,
  wrist_r_mm integer,

  pain_0_10 numeric(3, 1),
  swelling_0_10 numeric(3, 1),

  notes text,
  photo_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lipedema_measurements_unique_per_day unique (user_id, recorded_date),
  constraint lipedema_measurements_pain_range
    check (pain_0_10 is null or (pain_0_10 >= 0 and pain_0_10 <= 10)),
  constraint lipedema_measurements_swelling_range
    check (swelling_0_10 is null or (swelling_0_10 >= 0 and swelling_0_10 <= 10))
);

create index if not exists lipedema_measurements_user_date_idx
  on public.lipedema_measurements (user_id, recorded_date desc);

alter table public.lipedema_measurements enable row level security;

drop policy if exists "lipedema_measurements owner select"
  on public.lipedema_measurements;
create policy "lipedema_measurements owner select"
  on public.lipedema_measurements
  for select
  using (auth.uid() = user_id);

drop policy if exists "lipedema_measurements owner insert"
  on public.lipedema_measurements;
create policy "lipedema_measurements owner insert"
  on public.lipedema_measurements
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "lipedema_measurements owner update"
  on public.lipedema_measurements;
create policy "lipedema_measurements owner update"
  on public.lipedema_measurements
  for update
  using (auth.uid() = user_id);

drop policy if exists "lipedema_measurements owner delete"
  on public.lipedema_measurements;
create policy "lipedema_measurements owner delete"
  on public.lipedema_measurements
  for delete
  using (auth.uid() = user_id);

comment on table public.lipedema_measurements is
  'Weekly symptom + circumference tracking for lipedema users. One row per user per recorded_date. Drives trend views and (later) training-correlation insights on top of session data.';
