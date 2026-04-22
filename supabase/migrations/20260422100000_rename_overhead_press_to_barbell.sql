-- Rename generic "Overhead Press" to "Barbell Overhead Press" in user pools.
-- Catalog now has explicit barbell + dumbbell variants; old name is retired.

UPDATE "public"."auxiliary_exercises"
SET "exercise_name" = 'Barbell Overhead Press'
WHERE "exercise_name" = 'Overhead Press';
