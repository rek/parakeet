# Spec: Rehab Mode Data Layer

**Status**: Planned
**Domain**: Data / User Config

## What This Covers

Database schema for storing rehab caps and the per-set flags that mark sets logged during a rehab period or with a pain-limited RPE input. Includes the Zod schemas in `@parakeet/shared-types` and the repository functions in `@modules/rehab-mode`.

## Tasks

**Migration: `supabase/migrations/20260521010000_rehab_mode.sql`**

- [x] Create `rehab_caps` table with partial unique index `(user_id, lift) where ended_at is null` for one active cap per lift per user.
  → `supabase/migrations/20260521010000_rehab_mode.sql`
- [x] Enable RLS, owner policies on SELECT/INSERT/UPDATE/DELETE.
  → `supabase/migrations/20260521010000_rehab_mode.sql`
- [x] Explicit Data API grants to `anon`, `authenticated`, `service_role` (per memory: every new public table needs explicit grants, deadline 2026-10-30).
  → `supabase/migrations/20260521010000_rehab_mode.sql`
- [x] Add columns to `set_logs`: `during_rehab boolean not null default false`, `pain_limited boolean not null default false`. Backfill defaults are `false`; existing rows unaffected.
  → `supabase/migrations/20260521010000_rehab_mode.sql`
- [x] `npm run db:types` regenerated and verified — both new columns appear on the `set_logs` DbRow and `rehab_caps` is fully typed.
  → `supabase/types.ts`

**Zod schemas: `packages/shared-types/src/rehab-cap.schema.ts`**

- [x] `RehabCapSchema`, `CreateRehabCapInputSchema`, `UpdateRehabCapInputSchema`, `RehabLiftSchema` and their inferred types.
  → `packages/shared-types/src/rehab-cap.schema.ts`
- [x] Re-export via `packages/shared-types/src/modules/rehab-cap/index.ts`, added to top-level `index.ts`.
  → `packages/shared-types/src/index.ts`
- [ ] **Deferred:** No standalone `set-log.schema.ts` exists in shared-types — `set_logs` rows are typed directly from `DbRow<'set_logs'>` via the generated DB types, which now include `during_rehab` and `pain_limited`. The JSON `ActualSetSchema` in `session-log.schema.ts` does not need the new fields yet (the engine consumes them from the `set_logs` table via `RecentSessionSummary`, not from the embedded JSON). Revisit if a path is found that reads the new flags out of the JSON snapshot instead of the table.

**Repository: `apps/parakeet/src/modules/rehab-mode/data/rehab-mode.repository.ts`**

- [x] `listActiveRehabCaps`, `getActiveCapForLift`, `getRehabCap`, `getRehabCapHistory`, `insertRehabCap`, `updateRehabCap`, `endRehabCap`. Unique-constraint violation (`23505`) is translated into a typed `ActiveRehabCapExistsError` the UI can catch.
  → `apps/parakeet/src/modules/rehab-mode/data/rehab-mode.repository.ts`
- [x] Public API exported from `@modules/rehab-mode`.
  → `apps/parakeet/src/modules/rehab-mode/index.ts`

**Unit tests: `apps/parakeet/src/modules/rehab-mode/data/rehab-mode.repository.test.ts`**

- [x] Listing filters by `user_id` and `ended_at is null`.
  → `apps/parakeet/src/modules/rehab-mode/data/rehab-mode.repository.test.ts`
- [x] `insertRehabCap` 23505 → `ActiveRehabCapExistsError`; other errors rethrown as-is.
  → `apps/parakeet/src/modules/rehab-mode/data/rehab-mode.repository.test.ts`
- [x] `updateRehabCap` only writes provided fields; passes `null` through for clearable nullable fields.
  → `apps/parakeet/src/modules/rehab-mode/data/rehab-mode.repository.test.ts`
- [x] `endRehabCap` sets `ended_at` to the supplied date in ISO format.
  → `apps/parakeet/src/modules/rehab-mode/data/rehab-mode.repository.test.ts`
- [ ] **Deferred to integration testing**: RLS cross-user empty reads + frees-the-unique-slot-after-end-then-re-insert. These exercise actual DB constraints; cover them with an integration test once the local fixture pattern is set up for this module.

## Dependencies

- Supabase migrations infrastructure (existing)
- `@parakeet/shared-types` (existing)
- Per-table grants policy (see auto-memory: `project_supabase_data_api_grants`)

## Domain References

- [domain/performance-analysis.md](../../domain/performance-analysis.md) — working-1RM, PR detection (consumers of `during_rehab` and `pain_limited` flags)
