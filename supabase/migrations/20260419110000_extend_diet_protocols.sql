-- Extends the diet protocol catalog added in 20260419100000:
--   1. diet_protocols gains a description_md column (narrative prose
--      seeded from tools/data/<slug>.md).
--   2. diet_supplements table — structured supplement data seeded from
--      tools/data/<slug>_supplements.csv.
-- Both allow the app to read everything from DB without bundling markdown
-- as runtime assets.

alter table diet_protocols
  add column description_md text;

create table diet_supplements (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references diet_protocols(id) on delete cascade,
  slug text not null,
  name text not null,
  tier text not null check (tier in ('core', 'food_sourced', 'optional')),
  dose text,
  rationale text,
  evidence_grade text check (evidence_grade in ('A', 'B', 'C')),
  food_equivalent text,
  nepal_sourcing text check (nepal_sourcing in ('local', 'import', 'food', 'mixed')),
  notes text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  unique (protocol_id, slug)
);

create index diet_supplements_protocol_tier_idx
  on diet_supplements (protocol_id, tier, sort_order);

alter table diet_supplements enable row level security;

create policy "diet_supplements read" on diet_supplements for select using (true);
