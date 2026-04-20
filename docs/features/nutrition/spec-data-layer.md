# Spec: Nutrition data layer

**Status**: Implemented

**Domain**: Data / User Config

## What this covers

CSV/MD authoring layer under `tools/data/`, three Postgres migrations,
an idempotent seed pipeline, and the CSV parsers with tests. Research
lives in git-versioned CSV/MD (diffable, no DB lock-in); DB is a
queryable mirror; the app reads through React Query repositories.

## Tasks

**`tools/data/`:**

- [x] `keto.csv`, `rad.csv` — food allowlists, schema
      `category,food,status(yes|caution|no),notes`
  → `tools/data/keto.csv`, `tools/data/rad.csv`
- [x] `keto.md`, `rad.md` — per-protocol prose (goal, mechanism,
      macros, evidence, Nepal adaptations, sources)
  → `tools/data/keto.md`, `tools/data/rad.md`
- [x] `keto_supplements.csv`, `rad_supplements.csv` — structured
      supplement rows with dose / tier / grade / sourcing / notes
  → `tools/data/keto_supplements.csv`, `tools/data/rad_supplements.csv`
- [x] `keto_lifestyle.csv`, `rad_lifestyle.csv` — movement / sleep /
      stress / compression / manual-therapy rows by frequency
  → `tools/data/keto_lifestyle.csv`, `tools/data/rad_lifestyle.csv`
- [x] `supplements.md` — cross-protocol supplement reference with
      contraindications and pregnancy notes
  → `tools/data/supplements.md`
- [x] `labs.md` — biomarker monitoring (baseline + follow-up cadence)
  → `tools/data/labs.md`
- [x] `research-queries.sql` — canned SQL for protocol diff /
      disagreement / coverage queries
  → `tools/data/research-queries.sql`
- [x] `README.md` — schema rules + research workflow
  → `tools/data/README.md`

**`supabase/migrations/`:**

- [x] `20260419100000_create_diet_protocols.sql` — `diet_protocols`,
      `diet_foods`, `diet_protocol_foods`; RLS read-all
  → `supabase/migrations/20260419100000_create_diet_protocols.sql`
- [x] `20260419110000_extend_diet_protocols.sql` — adds
      `diet_protocols.description_md` + `diet_supplements` table
  → `supabase/migrations/20260419110000_extend_diet_protocols.sql`
- [x] `20260419120000_create_diet_lifestyle.sql` — `diet_lifestyle`
      with category + frequency check constraints
  → `supabase/migrations/20260419120000_create_diet_lifestyle.sql`

**`tools/scripts/lib/parse-diet-csv.ts`:**

- [x] `parseFoodCsv(text: string): FoodRow[]` — split-based parser
      (notes rejoin across commas), status validation
  → `tools/scripts/lib/parse-diet-csv.ts:parseFoodCsv`
- [x] `parseQuotedCsv(text: string): string[][]` — double-quote-aware
      CSV parser for structured files with comma-containing fields
  → `tools/scripts/lib/parse-diet-csv.ts:parseQuotedCsv`
- [x] `parseSupplementCsv(text: string): SupplementRow[]` — tier /
      grade / sourcing validation, null-out of empty optionals
  → `tools/scripts/lib/parse-diet-csv.ts:parseSupplementCsv`
- [x] `parseLifestyleCsv(text: string): LifestyleRow[]` — category /
      frequency enum checks
  → `tools/scripts/lib/parse-diet-csv.ts:parseLifestyleCsv`
- [x] Unit tests (20): quoted commas, embedded quotes, blank-line
      skipping, CRLF, header mismatch, enum validation
  → `tools/scripts/lib/__tests__/parse-diet-csv.test.ts`

**`tools/scripts/seed-diet-protocols.ts`:**

- [x] Idempotent upsert + prune for foods, supplements, lifestyle
      across both protocols
  → `tools/scripts/seed-diet-protocols.ts:main`
- [x] Dedupe `(protocol_id, food_id)` before junction upsert — CSVs
      can list the same food in multiple categories (tempeh =
      proteins + fermented_foods). First-seen wins; drift logged.
  → `tools/scripts/seed-diet-protocols.ts:main`
- [x] Env-driven: uses `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` from
      process.env — same script for local and remote.
  → `tools/scripts/seed-diet-protocols.ts:main`

**`tools/scripts/seed-diet-protocols.sh`:**

- [x] Auto-detect env vars or fall back to `supabase status` for
      local dev. One command for local + prod.
  → `tools/scripts/seed-diet-protocols.sh`

**`apps/parakeet/src/modules/nutrition/data/`:**

- [x] `nutrition.repository.ts` — `fetchProtocols()`,
      `fetchProtocolBundle(slug)` with Promise.all for
      foods/supplements/lifestyle
  → `apps/parakeet/src/modules/nutrition/data/nutrition.repository.ts`
- [x] `nutrition.queries.ts` — queryOptions factories with
      `skipToken` when slug empty
  → `apps/parakeet/src/modules/nutrition/data/nutrition.queries.ts`
