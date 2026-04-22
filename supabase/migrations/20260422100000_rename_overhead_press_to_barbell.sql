-- Rename exercises in user auxiliary pools to match updated catalog names.
-- Old generic names are retired; explicit barbell/dumbbell variants replace them.

UPDATE "public"."auxiliary_exercises"
SET "exercise_name" = 'Barbell Overhead Press'
WHERE "exercise_name" = 'Overhead Press';

UPDATE "public"."auxiliary_exercises"
SET "exercise_name" = 'Dumbbell Romanian Deadlift'
WHERE "exercise_name" = 'Romanian Dumbbell Deadlift';

UPDATE "public"."auxiliary_exercises"
SET "exercise_name" = 'Barbell Box Squat'
WHERE "exercise_name" = 'Box Squat';

UPDATE "public"."auxiliary_exercises"
SET "exercise_name" = 'Barbell Front Squat'
WHERE "exercise_name" = 'Front Squat';

UPDATE "public"."auxiliary_exercises"
SET "exercise_name" = 'Seated Machine Row'
WHERE "exercise_name" = 'Seated machine row';
