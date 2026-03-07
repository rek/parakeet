-- Add 'overhead_press' as a valid lift value in auxiliary_exercises and sessions

ALTER TABLE "public"."auxiliary_exercises"
  DROP CONSTRAINT "auxiliary_exercises_lift_check";

ALTER TABLE "public"."auxiliary_exercises"
  ADD CONSTRAINT "auxiliary_exercises_lift_check"
  CHECK (("lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text", 'overhead_press'::"text"])));

ALTER TABLE "public"."sessions"
  DROP CONSTRAINT "sessions_primary_lift_check";

ALTER TABLE "public"."sessions"
  ADD CONSTRAINT "sessions_primary_lift_check"
  CHECK (("primary_lift" = ANY (ARRAY['squat'::"text", 'bench'::"text", 'deadlift'::"text", 'overhead_press'::"text"])));
