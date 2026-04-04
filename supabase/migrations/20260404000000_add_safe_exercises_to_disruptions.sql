-- Add safe_exercises column to disruptions table (GH#166).
-- When an injury affects certain lifts, the user can specify which
-- auxiliary exercises they can still safely perform despite the injury.
-- The JIT engine uses this list to allow those exercises through the
-- injury filter in volume top-up selection.
ALTER TABLE "public"."disruptions"
  ADD COLUMN "safe_exercises" text[];
