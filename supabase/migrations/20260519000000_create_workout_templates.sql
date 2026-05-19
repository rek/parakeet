-- Workout templates: globally-shared, user-editable workout bundles.
--
-- A template is a list of exercises (workout_template_items) repeated
-- for N rounds. Wiki-style: any authenticated user can create / edit /
-- delete. created_by + updated_by are tracked for accountability but
-- not used for access control. See GH#214.
--
-- Catalog references (workout_template_items.exercise) are free-text
-- display names matching EXERCISE_CATALOG entries in
-- packages/training-engine/src/auxiliary/exercise-catalog.ts. Catalog
-- renames must sweep this table the same way they sweep set_logs and
-- auxiliary_exercises. Stable-slug refactor deferred to GH#215.

create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  rounds int not null default 1 check (rounds >= 1),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workout_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workout_templates(id) on delete cascade,
  position int not null check (position >= 0),
  exercise text not null check (length(trim(exercise)) > 0),
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  reps int check (reps is null or reps >= 0),
  rest_after_seconds int not null check (rest_after_seconds >= 0),
  unique (template_id, position)
);

create index workout_template_items_template_id_idx
  on workout_template_items (template_id, position);

-- updated_at bump + updated_by reassignment on UPDATE
create function workout_templates_touch_updated() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger workout_templates_touch_updated_trigger
  before update on workout_templates
  for each row
  execute function workout_templates_touch_updated();

-- RLS — wiki-style: any authenticated user can do anything.
alter table workout_templates enable row level security;
alter table workout_template_items enable row level security;

create policy "workout_templates read" on workout_templates
  for select to authenticated using (true);
create policy "workout_templates insert" on workout_templates
  for insert to authenticated with check (true);
create policy "workout_templates update" on workout_templates
  for update to authenticated using (true) with check (true);
create policy "workout_templates delete" on workout_templates
  for delete to authenticated using (true);

create policy "workout_template_items read" on workout_template_items
  for select to authenticated using (true);
create policy "workout_template_items insert" on workout_template_items
  for insert to authenticated with check (true);
create policy "workout_template_items update" on workout_template_items
  for update to authenticated using (true) with check (true);
create policy "workout_template_items delete" on workout_template_items
  for delete to authenticated using (true);

-- Explicit Data API grants (Supabase default-deny lands 2026-10-30).
grant all on table public.workout_templates to anon;
grant all on table public.workout_templates to authenticated;
grant all on table public.workout_templates to service_role;

grant all on table public.workout_template_items to anon;
grant all on table public.workout_template_items to authenticated;
grant all on table public.workout_template_items to service_role;

notify pgrst, 'reload schema';
