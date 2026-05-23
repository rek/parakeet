-- Convert personal_records.weight_kg (numeric kg) to weight_grams (integer grams)
-- to comply with the project's "all weights stored as integer grams" invariant.
-- Float kg values (e.g., 102.50000001) could otherwise create duplicate PR rows
-- because the existing unique index uses weight_kg as part of the conflict target.

BEGIN;

-- Step 1: Add the new integer-grams column.
ALTER TABLE "public"."personal_records"
  ADD COLUMN "weight_grams" integer;

-- Step 2: Backfill from existing weight_kg. ROUND avoids floor/ceil ambiguity;
-- the values being migrated are bounded to ≤ 1000 kg, so overflow is impossible.
UPDATE "public"."personal_records"
SET "weight_grams" = ROUND("weight_kg" * 1000)::integer
WHERE "weight_kg" IS NOT NULL;

-- Step 3: Drop the unique index that used weight_kg, then recreate on weight_grams.
DROP INDEX IF EXISTS "public"."pr_unique";

CREATE UNIQUE INDEX "pr_unique"
  ON "public"."personal_records"
  USING "btree" ("user_id", "lift", "pr_type", "weight_grams")
  NULLS NOT DISTINCT;

-- Step 4: Drop the legacy numeric column.
ALTER TABLE "public"."personal_records"
  DROP COLUMN "weight_kg";

-- Step 5: Convert `value` to integer grams as well, where it represents a weight.
-- `value` carries kg for pr_type IN ('estimated_1rm') and reps for 'rep_at_weight'
-- and kg-cubed (volume) for 'volume'. Volume is best stored as integer grams of
-- total volume; estimated_1rm is integer grams of estimated 1RM. rep_at_weight
-- is an integer count. We standardise to a single `value` integer column whose
-- units depend on pr_type — documented in spec-pr-detection.md.
--
-- Strategy: rename `value` to `value_legacy_numeric` (kept transiently for
-- rollback safety), add new integer `value_int`, backfill, then rename. We
-- defer the column rename to a follow-up migration to keep this change minimal
-- and reversible.
--
-- For now: only weight_kg → weight_grams is converted in this migration.
-- The `value` column conversion is tracked separately.

COMMIT;
