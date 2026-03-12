-- Add 'core' to muscle_volume_config allowed values
ALTER TABLE "public"."muscle_volume_config"
  DROP CONSTRAINT "muscle_volume_config_muscle_group_check";

ALTER TABLE "public"."muscle_volume_config"
  ADD CONSTRAINT "muscle_volume_config_muscle_group_check"
  CHECK (("muscle_group" = ANY (ARRAY[
    'quads'::"text", 'hamstrings'::"text", 'glutes'::"text",
    'lower_back'::"text", 'upper_back'::"text", 'chest'::"text",
    'triceps'::"text", 'shoulders'::"text", 'biceps'::"text",
    'core'::"text"
  ])));
