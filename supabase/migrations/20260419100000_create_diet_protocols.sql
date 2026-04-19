-- Diet protocol reference catalog. Static-ish allowlists per protocol
-- (keto, rad, ...) used for research and later to classify user intake.
-- Seeded from tools/data/*.csv via tools/scripts/seed-diet-protocols.ts.

create table diet_protocols (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table diet_foods (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,  -- lowercase trimmed
  display_name text not null,
  category text not null,
  created_at timestamptz not null default now()
);

create index diet_foods_category_idx on diet_foods (category);

create table diet_protocol_foods (
  protocol_id uuid not null references diet_protocols(id) on delete cascade,
  food_id uuid not null references diet_foods(id) on delete cascade,
  status text not null check (status in ('yes', 'caution', 'no')),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (protocol_id, food_id)
);

create index diet_protocol_foods_status_idx
  on diet_protocol_foods (protocol_id, status);

-- Reference data, not user data. Enable RLS with read-all policy so the
-- app can query without the service key; writes go through seed script
-- (service key) or future admin UI.
alter table diet_protocols enable row level security;
alter table diet_foods enable row level security;
alter table diet_protocol_foods enable row level security;

create policy "diet_protocols read" on diet_protocols for select using (true);
create policy "diet_foods read" on diet_foods for select using (true);
create policy "diet_protocol_foods read" on diet_protocol_foods for select using (true);
