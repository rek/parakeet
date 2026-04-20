# Spec: Prod push + feature-flag gate

**Status**: Implemented

**Domain**: Infra

## What this covers

Feature-flag gate (drawer + route), unified env-driven seed script,
migration push to prod, seeder hardening against CSV dual-category
rows. Prod-safe so the user can `db:push` + seed without risk of dead
data in prod.

## Tasks

**Feature-flag gate:**

- [x] `nutrition` entry in `FEATURE_REGISTRY`; category `health`;
      `defaultEnabled: false`.
  → `apps/parakeet/src/modules/feature-flags/model/features.ts`
- [x] `LeftDrawer` Nutrition entry gated by `useFeatureEnabled('nutrition')`.
  → `apps/parakeet/src/components/ui/LeftDrawer.tsx`
- [x] Nutrition route gated by `useFeatureEnabled('nutrition')`.
      Hooks-before-return rule satisfied (all hooks called before the
      conditional `return null`).
  → `apps/parakeet/src/app/(tabs)/nutrition.tsx`

**Unified seed path:**

- [x] `tools/scripts/seed-diet-protocols.sh` — auto-detect
      `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` in env → use them; else
      fall back to `supabase status` for local stack. Same
      `npm run db:seed:diet` works local and prod.
  → `tools/scripts/seed-diet-protocols.sh`
- [x] Seeder tsx script already env-driven; no script forked.
  → `tools/scripts/seed-diet-protocols.ts`

**Seeder hardening — dedupe (protocol_id, food_id):**

- [x] Prod seed first pass hit PG 21000 ("ON CONFLICT DO UPDATE
      command cannot affect row a second time") because CSVs list
      some foods in multiple categories (tempeh = proteins +
      fermented_foods; avocado = fats + fruits). Seeder now builds
      the junction upsert via `Map` keyed by `food_id`; first-seen
      wins; drift on status/notes logged as a warning; collapsed-
      duplicate count printed alongside the upsert count.
  → `tools/scripts/seed-diet-protocols.ts:main`

**Vitest include extended:**

- [x] `apps/parakeet/vitest.config.ts` — include
      `../../tools/scripts/**/*.test.ts` so parser tests run under
      `nx test parakeet` (tools/ has no project of its own).
  → `apps/parakeet/vitest.config.ts`

**Prod push procedure (user-action, documented in gh#199 + commit msgs):**

- [x] `npm run db:push` applied 3 diet migrations to prod.
- [x] `SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run db:seed:diet`
      seeded catalog.
- [x] User toggles the nutrition flag on in Settings → Features when
      ready to reveal the drawer entry.

## Dependencies

- [spec-data-layer.md](./spec-data-layer.md) — the seed script + the
  migrations.
- [spec-ui.md](./spec-ui.md) — the drawer entry + route that are gated.
