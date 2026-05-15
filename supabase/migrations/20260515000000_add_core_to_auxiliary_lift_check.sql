-- Add 'core' as a valid pool category in auxiliary_exercises so users can
-- customize the core-exercise pool that JIT pulls from for volume top-up.

ALTER TABLE "public"."auxiliary_exercises"
  DROP CONSTRAINT "auxiliary_exercises_lift_check";

ALTER TABLE "public"."auxiliary_exercises"
  ADD CONSTRAINT "auxiliary_exercises_lift_check"
  CHECK (("lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text", 'overhead_press'::"text", 'core'::"text"])));
