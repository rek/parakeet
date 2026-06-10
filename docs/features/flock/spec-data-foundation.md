# Spec: Flock Data Foundation

**Status**: Implemented (10 Jun 2026)

**Domain**: Infra / Data

> Phase 1 of 3. See [spec-publish.md](./spec-publish.md) (Phase 2) and
> [spec-ui.md](./spec-ui.md) (Phase 3).
>
> **As built:** migration `supabase/migrations/20260610000000_create_flock_tables.sql`;
> module data layer in `apps/parakeet/src/modules/flock/{data,model}`.
> The streak column shipped as **`streak_weeks`** (the achievements streak is in
> weeks, not days) — see note below.

## What This Covers

The read model and persistence for Flock: a sanitized `flock_highlights` projection that
every lifter can read but only its owner can write, plus a `flock_config` table holding the
per-user "share my highlights" opt-in. The projection's columns **are** the privacy contract
— if a field isn't here, no friend can ever read it through this feature. No `session_logs`,
no health/medical/bodyweight columns. Mirrors the migration style of
`supabase/migrations/20260519000000_create_workout_templates.sql` (public read) and
`...20260421110000_create_lipedema_measurements.sql` (owner-only write).

## Tasks

**`supabase/migrations/<ts>_create_flock_tables.sql`:**

- [ ] `flock_highlights` table — one current row per lifter, rewritten on each publish:
  - `user_id uuid primary key references auth.users(id) on delete cascade`
  - `display_name text not null`
  - `headline text not null` — pre-rendered line, e.g. "Squat PR — 142.5kg × 3"
  - `headline_kind text not null check (headline_kind in ('pr','wilks','streak','trained'))`
  - `latest_pr_lift text` / `latest_pr_weight_g integer` / `latest_pr_reps integer` — populated only when kind = `pr`. **Grams** (KG-only app stores integer grams; 142.5kg = 142500).
  - `wilks integer` / `wilks_delta integer` / `streak_weeks integer`
    (weeks — matches `@modules/achievements` `getStreakData().currentStreak`)
  - `published_at timestamptz not null default now()`
  - **No** bodyweight, cycle, lipedema, raw-set columns (design decisions #3, #4).
- [ ] `flock_config` table — per-user opt-in:
  - `user_id uuid primary key references auth.users(id) on delete cascade`
  - `sharing_enabled boolean not null default false`
  - `updated_at timestamptz not null default now()`
- [ ] RLS on `flock_highlights`:
  - SELECT `to authenticated using (true)` — everyone in the closed instance reads all sharer rows.
  - INSERT/UPDATE/DELETE `using (auth.uid() = user_id)` — owner-only writes. This is what keeps the projection honest.
- [ ] RLS on `flock_config`: all ops owner-only (`auth.uid() = user_id`).
- [ ] GRANTs (required or the Data API can't see the tables):
  - `grant all on table public.flock_highlights to anon, authenticated, service_role;`
  - `grant all on table public.flock_config to anon, authenticated, service_role;`
  - (RLS still governs rows; grants are the table-level gate.)
- [ ] `notify pgrst, 'reload schema';` at end of migration.

**`supabase/types.ts`:**

- [ ] Run `npm run db:types` immediately after pushing the migration — do not hand-write row types (workflow §5). Verify `flock_highlights` / `flock_config` appear.

**`apps/parakeet/src/modules/flock/data/flock.repository.ts`:**

- [ ] `fetchFlockHighlights(currentUserId: string)` → all rows where `user_id <> currentUserId`, ordered `published_at desc`. Returns typed rows from `supabase/types.ts`.
- [ ] `upsertFlockHighlight(row)` → upsert on `user_id` (owner writes own card).
- [ ] `deleteFlockHighlight(userId)` → used when sharing is turned off.
- [ ] `getFlockConfig(userId)` → `{ sharing_enabled }`, defaulting to `false` when no row.
- [ ] `setFlockSharing(userId, enabled)` → upsert `flock_config`.

**`apps/parakeet/src/modules/flock/data/flock.queries.ts`:**

- [ ] `queryOptions` factory for the highlights list and for the config (per app data-layer convention; key + queryFn co-located).

**`apps/parakeet/src/modules/flock/model/flock.types.ts`:**

- [ ] `FlockCard` view-model type derived from the row (kg conversions done here, grams → kg).
- [ ] `HeadlineKind = 'pr' | 'wilks' | 'streak' | 'trained'`.

**`apps/parakeet/src/modules/flock/index.ts`:**

- [ ] Public API barrel — re-export hooks/types only (no deep imports across modules).

## Dependencies

- None (foundation). Phase 2 and 3 depend on this.

## Notes

- Grep `flock_highlights` / `flock_config` across the codebase before edits (workflow §5 DB rule).
- `// @spec docs/features/flock/spec-data-foundation.md` at the top of each new non-trivial file.
