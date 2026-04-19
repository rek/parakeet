-- Diet lifestyle components. Non-food, non-supplement prescribed practices
-- (compression garments, manual lymphatic drainage, movement, sleep, stress
-- management). Seeded from tools/data/<slug>_lifestyle.csv.

create table diet_lifestyle (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references diet_protocols(id) on delete cascade,
  slug text not null,
  name text not null,
  category text not null check (category in (
    'compression',
    'manual_therapy',
    'movement',
    'stress',
    'sleep',
    'other'
  )),
  frequency text not null check (frequency in ('daily', 'weekly', 'as_needed')),
  description text,
  rationale text,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  unique (protocol_id, slug)
);

create index diet_lifestyle_protocol_category_idx
  on diet_lifestyle (protocol_id, category, sort_order);

alter table diet_lifestyle enable row level security;

create policy "diet_lifestyle read" on diet_lifestyle for select using (true);
