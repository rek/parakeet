-- Per-food macro + micro data, keyed on diet_foods.
--
-- Separate table (vs widening diet_foods) because:
--   * nutrition is slower to author than the allowlist
--   * allows future per-serving variants (cup vs 100g) via extra rows
--   * sourcing metadata (USDA_SR vs IFCT_2017 vs manual) lives cleanly
--     alongside the numbers
--
-- Seeded from tools/data/food_nutrition.csv. RLS read-all (reference
-- data, same shape as diet_foods / diet_supplements / diet_lifestyle).

create table if not exists public.diet_food_nutrition (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.diet_foods(id) on delete cascade,
  serving_g integer not null default 100,
  kcal numeric(6, 1) not null,
  protein_g numeric(6, 2) not null,
  fat_g numeric(6, 2) not null,
  carb_g numeric(6, 2) not null,
  fiber_g numeric(6, 2),
  source text not null,
  source_id text,
  updated_at timestamptz not null default now(),

  constraint diet_food_nutrition_source_check
    check (source in ('USDA_SR', 'USDA_Foundation', 'USDA_FNDDS', 'IFCT_2017', 'manual')),
  constraint diet_food_nutrition_unique_per_food unique (food_id, serving_g)
);

create index if not exists diet_food_nutrition_food_id_idx
  on public.diet_food_nutrition (food_id);

alter table public.diet_food_nutrition enable row level security;

drop policy if exists "diet_food_nutrition readable by all"
  on public.diet_food_nutrition;
create policy "diet_food_nutrition readable by all"
  on public.diet_food_nutrition
  for select
  using (true);

comment on table public.diet_food_nutrition is
  'Macro + fiber data per food. Seeded from tools/data/food_nutrition.csv (USDA FDC + IFCT 2017 + manual). 100g default serving.';
comment on column public.diet_food_nutrition.source is
  'Provenance: USDA_SR (SR Legacy), USDA_Foundation, USDA_FNDDS, IFCT_2017 (Indian Food Composition Tables), or manual.';
comment on column public.diet_food_nutrition.source_id is
  'USDA FDC id or IFCT row id. Null for manual entries.';
