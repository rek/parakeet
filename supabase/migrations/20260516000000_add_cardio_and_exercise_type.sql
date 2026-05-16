-- Extend auxiliary_exercises to support a 'cardio' pool category and to
-- persist the exercise type (weighted | bodyweight | timed) per row.
--
-- Before this migration, custom user-added exercises silently fell back to
-- 'weighted' in the engine (getExerciseType -> 'weighted' default), so
-- adding "Running" got treated as a weighted lift. The new exercise_type
-- column lets the engine honour the user's chosen mechanic. Pre-existing
-- rows are left NULL so the catalog/fallback lookup still applies — only
-- new rows from the type-picker flow set it explicitly.

ALTER TABLE "public"."auxiliary_exercises"
  DROP CONSTRAINT "auxiliary_exercises_lift_check";

ALTER TABLE "public"."auxiliary_exercises"
  ADD CONSTRAINT "auxiliary_exercises_lift_check"
  CHECK (("lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text", 'overhead_press'::"text", 'core'::"text", 'cardio'::"text"])));

ALTER TABLE "public"."auxiliary_exercises"
  ADD COLUMN "exercise_type" "text"
  CHECK ("exercise_type" IS NULL OR "exercise_type" = ANY (ARRAY['weighted'::"text", 'bodyweight'::"text", 'timed'::"text"]));

NOTIFY pgrst, 'reload schema';
