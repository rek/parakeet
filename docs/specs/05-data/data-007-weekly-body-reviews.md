# Spec: Weekly Body Reviews Data Layer

**Status**: Draft
**Domain**: Data

## What This Covers

Database table, migration, and Supabase wrapper functions for storing end-of-week body reviews. Consumed by the weekly body review screen and the cycle report assembler.

## Tasks

### Migration

**File: `supabase/migrations/20260308000000_add_weekly_body_reviews.sql`**

- [ ] Create `weekly_body_reviews` table:
  ```sql
  CREATE TABLE weekly_body_reviews (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id),
    program_id       UUID REFERENCES programs(id),
    week_number      INTEGER NOT NULL,
    felt_soreness    JSONB NOT NULL,
    predicted_fatigue JSONB NOT NULL,
    mismatches       JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  ALTER TABLE weekly_body_reviews ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can read own reviews"
    ON weekly_body_reviews FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert own reviews"
    ON weekly_body_reviews FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  ```

  Note: `program_id` references the `programs` table (not sessions). Nullable for unending mode reviews where no specific program week applies.

### Supabase Types Update

**File: `supabase/types.ts`**

- [ ] Add `weekly_body_reviews` table type matching the migration columns:
  - `id: string`
  - `user_id: string`
  - `program_id: string | null`
  - `week_number: number`
  - `felt_soreness: Json`
  - `predicted_fatigue: Json`
  - `mismatches: Json`
  - `notes: string | null`
  - `created_at: string`

  If local Supabase is not running, hand-edit to match. Re-run `npm run db:types` after `db:reset` when Supabase is available.

### Lib Functions

**File: `apps/parakeet/src/lib/weekly-body-reviews.ts`**

- [ ] `saveWeeklyBodyReview(userId, review)` — inserts a new review row:
  ```typescript
  export async function saveWeeklyBodyReview(
    userId: string,
    review: {
      programId: string | null
      weekNumber: number
      feltSoreness: Record<string, number>
      predictedFatigue: Record<string, { predictedSoreness: number; volumePct: number; volumeStatus: string }>
      mismatches: Array<{ muscle: string; felt: number; predicted: number; difference: number; direction: string }>
      notes?: string
    }
  ): Promise<void>
  ```

- [ ] `getWeeklyBodyReviews(userId, programId?)` — fetch all reviews for a user, optionally filtered to a program:
  ```typescript
  export async function getWeeklyBodyReviews(
    userId: string,
    programId?: string
  ): Promise<WeeklyBodyReview[]>
  ```
  Returns results ordered by `created_at` descending.

- [ ] `getLatestWeeklyReview(userId, programId, weekNumber)` — fetch the most recent review for a specific program week (used to pre-populate if the user revisits):
  ```typescript
  export async function getLatestWeeklyReview(
    userId: string,
    programId: string,
    weekNumber: number
  ): Promise<WeeklyBodyReview | null>
  ```

- [ ] Export `WeeklyBodyReview` interface matching the table shape with typed JSONB fields.

### Module Export

- [ ] Expose `saveWeeklyBodyReview`, `getWeeklyBodyReviews`, `getLatestWeeklyReview` from the session module or a dedicated `body-review` module. If it remains small, co-locate under `@modules/session`. Extract to `@modules/body-review` if it grows.

### Query Keys

**File: `apps/parakeet/src/platform/query.ts`**

- [ ] Add query key factories:
  ```typescript
  weeklyBodyReviews: (userId: string) =>
    ['weekly-body-reviews', userId] as const,
  weeklyBodyReview: (userId: string, programId: string, week: number) =>
    ['weekly-body-review', userId, programId, week] as const,
  ```

## Dependencies

- [infra-005-database-migrations.md](../01-infra/infra-005-database-migrations.md)
- [engine-029-fatigue-predictor.md](../04-engine/engine-029-fatigue-predictor.md) — `FatigueMismatch` shape stored in `mismatches` JSONB
- [mobile-036-weekly-body-review.md](../09-mobile/mobile-036-weekly-body-review.md) — primary consumer
