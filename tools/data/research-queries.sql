-- Research queries for diet protocol catalogs.
-- Run against local Supabase after seeding:
--   npx tsx tools/scripts/seed-diet-protocols.ts
-- Then paste into `npx supabase db psql` or the Supabase MCP execute_sql.

-- ---------------------------------------------------------------------------
-- 1. Cross-protocol disagreement: same food, different status.
--    Use to spot inconsistencies or document meaningful divergences.
-- ---------------------------------------------------------------------------
select f.display_name,
       f.category,
       max(case when p.slug = 'keto' then pf.status end) as keto,
       max(case when p.slug = 'rad'  then pf.status end) as rad,
       max(case when p.slug = 'keto' then pf.notes  end) as keto_notes,
       max(case when p.slug = 'rad'  then pf.notes  end) as rad_notes
from diet_protocol_foods pf
join diet_protocols p on p.id = pf.protocol_id
join diet_foods f     on f.id = pf.food_id
group by f.id, f.display_name, f.category
having count(distinct pf.status) > 1
order by f.category, f.display_name;

-- ---------------------------------------------------------------------------
-- 2. Single-protocol foods. Candidates for adding to the other protocol,
--    or confirmation that they're intentionally excluded.
-- ---------------------------------------------------------------------------
select f.display_name, f.category, p.slug as only_in, pf.status, pf.notes
from diet_foods f
join diet_protocol_foods pf on pf.food_id = f.id
join diet_protocols p       on p.id = pf.protocol_id
where not exists (
  select 1 from diet_protocol_foods pf2
  where pf2.food_id = f.id and pf2.protocol_id != pf.protocol_id
)
order by f.category, f.display_name;

-- ---------------------------------------------------------------------------
-- 3. Category coverage matrix. Scan for thin categories (missing staples).
-- ---------------------------------------------------------------------------
select p.slug, f.category, pf.status, count(*) as n
from diet_protocol_foods pf
join diet_protocols p on p.id = pf.protocol_id
join diet_foods f     on f.id = pf.food_id
group by p.slug, f.category, pf.status
order by p.slug, f.category, pf.status;

-- ---------------------------------------------------------------------------
-- 4. Caution rows missing notes. Should be empty — every caution needs a reason.
-- ---------------------------------------------------------------------------
select p.slug, f.category, f.display_name
from diet_protocol_foods pf
join diet_protocols p on p.id = pf.protocol_id
join diet_foods f     on f.id = pf.food_id
where pf.status = 'caution'
  and (pf.notes is null or length(trim(pf.notes)) = 0)
order by p.slug, f.category;

-- ---------------------------------------------------------------------------
-- 5. Supplement stack summary per protocol.
-- ---------------------------------------------------------------------------
select p.slug,
       s.tier,
       s.name,
       s.dose,
       s.evidence_grade,
       s.nepal_sourcing
from diet_supplements s
join diet_protocols p on p.id = s.protocol_id
order by p.slug, s.tier, s.sort_order;

-- ---------------------------------------------------------------------------
-- 6. Supplements missing rationale or dose (data quality check).
-- ---------------------------------------------------------------------------
select p.slug, s.name, s.tier
from diet_supplements s
join diet_protocols p on p.id = s.protocol_id
where coalesce(s.dose, '') = '' or coalesce(s.rationale, '') = ''
order by p.slug, s.tier, s.sort_order;

-- ---------------------------------------------------------------------------
-- 7. Lifestyle items per protocol by category.
-- ---------------------------------------------------------------------------
select p.slug,
       l.category,
       l.frequency,
       l.name
from diet_lifestyle l
join diet_protocols p on p.id = l.protocol_id
order by p.slug, l.category, l.sort_order;

-- ---------------------------------------------------------------------------
-- 8. Totals per protocol — sanity check seed completeness.
-- ---------------------------------------------------------------------------
select p.slug,
       count(*) filter (where pf.status = 'yes')     as yes_count,
       count(*) filter (where pf.status = 'caution') as caution_count,
       count(*) filter (where pf.status = 'no')      as no_count,
       count(*) as total
from diet_protocol_foods pf
join diet_protocols p on p.id = pf.protocol_id
group by p.slug
order by p.slug;
