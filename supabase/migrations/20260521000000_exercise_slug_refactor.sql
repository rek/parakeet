-- Stable slug IDs for exercise references (GH#215).
--
-- Adds an immutable `*_slug` column alongside every existing exercise display
-- name column. Slugs are kebab-case derived from the catalog entry name and
-- never change once assigned, so catalog renames (e.g. "Overhead Press" →
-- "Barbell Overhead Press") become a single TypeScript edit instead of an SQL
-- sweep across every referencing table.
--
-- Display name columns are kept (not dropped) so user-created custom exercise
-- names round-trip exactly, and so historical rows survive even if the catalog
-- later drops an entry. App code resolves display at the UI boundary:
--   getDisplayNameForSlug(slug, stored_display) → catalog name ?? stored ?? prettify(slug)
--
-- Tables updated: auxiliary_exercises, set_logs, workout_template_items,
-- auxiliary_assignments (exercise_1, exercise_2). The set_logs unique slot
-- index is rebuilt against slug so future renames cannot create duplicate
-- (session_id, kind, exercise, set_number) rows.

BEGIN;

-- Catalog name → slug map, plus historical aliases from the 20260422 rename
-- (auxiliary_exercises was swept then; set_logs append-only was not, so old
-- rows may still contain pre-rename names like "Overhead Press").
CREATE TEMP TABLE exercise_slug_map (name text PRIMARY KEY, slug text NOT NULL)
  ON COMMIT DROP;

INSERT INTO exercise_slug_map (name, slug) VALUES
  ('Barbell Box Squat', 'barbell-box-squat'),
  ('Dumbbell Step Up', 'dumbbell-step-up'),
  ('Dumbbell Lunge', 'dumbbell-lunge'),
  ('Front Barbell Box Squat', 'front-barbell-box-squat'),
  ('Barbell Front Squat', 'barbell-front-squat'),
  ('Pause Squat', 'pause-squat'),
  ('High-Bar Squat', 'high-bar-squat'),
  ('Bulgarian Split Squat', 'bulgarian-split-squat'),
  ('Leg Press', 'leg-press'),
  ('Hack Squat', 'hack-squat'),
  ('Barbell Thruster', 'barbell-thruster'),
  ('Close-Grip Barbell Bench Press', 'close-grip-barbell-bench-press'),
  ('Dumbbell Incline Bench Press', 'dumbbell-incline-bench-press'),
  ('Barbell Pause Bench Press', 'barbell-pause-bench-press'),
  ('Decline Barbell Bench Press', 'decline-barbell-bench-press'),
  ('Barbell Incline Bench Press', 'barbell-incline-bench-press'),
  ('Dumbbell Fly', 'dumbbell-fly'),
  ('Floor Press', 'floor-press'),
  ('Board Press', 'board-press'),
  ('Spoto Press', 'spoto-press'),
  ('1 Inch Pause Bench', '1-inch-pause-bench'),
  ('Barbell Block Bench Press', 'barbell-block-bench-press'),
  ('Barbell Push Press', 'barbell-push-press'),
  ('JM Press', 'jm-press'),
  ('Barbell Curl', 'barbell-curl'),
  ('Dumbbell Curl', 'dumbbell-curl'),
  ('Cable Curl', 'cable-curl'),
  ('EZ-Bar Curl', 'ez-bar-curl'),
  ('Decline Push-ups', 'decline-push-ups'),
  ('Diamond Push-ups', 'diamond-push-ups'),
  ('Archer Push-ups', 'archer-push-ups'),
  ('Pike Push-ups', 'pike-push-ups'),
  ('Standard Push-ups', 'standard-push-ups'),
  ('Wide Push-ups', 'wide-push-ups'),
  ('Close-Grip Push-ups', 'close-grip-push-ups'),
  ('Barbell Hang Clean', 'barbell-hang-clean'),
  ('Clean and Jerk', 'clean-and-jerk'),
  ('Power Clean', 'power-clean'),
  ('Lat Pulldown', 'lat-pulldown'),
  ('Seated Machine Row', 'seated-machine-row'),
  ('Rack Pull', 'rack-pull'),
  ('Rack Pull Below Knee', 'rack-pull-below-knee'),
  ('Kettlebell Swing', 'kettlebell-swing'),
  ('Pendlay Row', 'pendlay-row'),
  ('Barbell Row', 'barbell-row'),
  ('Dumbbell Romanian Deadlift', 'dumbbell-romanian-deadlift'),
  ('Hexbar Deadlift', 'hexbar-deadlift'),
  ('Hexbar Deadlift Deficit', 'hexbar-deadlift-deficit'),
  ('Dumbbell Row', 'dumbbell-row'),
  ('Sumo Deadlift', 'sumo-deadlift'),
  ('Deficit Deadlift', 'deficit-deadlift'),
  ('Kettlebell Deadlift', 'kettlebell-deadlift'),
  ('Good Mornings', 'good-mornings'),
  ('Block Pulls', 'block-pulls'),
  ('Stiff-Leg Deadlift', 'stiff-leg-deadlift'),
  ('Barbell Snatch', 'barbell-snatch'),
  ('Dumbbell Snatch', 'dumbbell-snatch'),
  ('Deadhang', 'deadhang'),
  ('Barbell Overhead Press', 'barbell-overhead-press'),
  ('Dumbbell Overhead Press', 'dumbbell-overhead-press'),
  ('Chin Up (weighted)', 'chin-up-weighted'),
  ('Jump Squat', 'jump-squat'),
  ('Pistol Squat', 'pistol-squat'),
  ('Box Jump', 'box-jump'),
  ('Sumo Squat', 'sumo-squat'),
  ('Curtsy Lunge', 'curtsy-lunge'),
  ('Hip Thrust', 'hip-thrust'),
  ('Glute Bridge', 'glute-bridge'),
  ('Nordic Hamstring Curl', 'nordic-hamstring-curl'),
  ('Single-Leg RDL', 'single-leg-rdl'),
  ('Bodyweight Good Morning', 'bodyweight-good-morning'),
  ('Hyperextension', 'hyperextension'),
  ('Single-Leg Glute Bridge', 'single-leg-glute-bridge'),
  ('Donkey Kick', 'donkey-kick'),
  ('Glute Kickback', 'glute-kickback'),
  ('Pull-ups', 'pull-ups'),
  ('Chin-ups', 'chin-ups'),
  ('Push-ups', 'push-ups'),
  ('Dips', 'dips'),
  ('Air Squat', 'air-squat'),
  ('Lunge', 'lunge'),
  ('Row Machine', 'row-machine'),
  ('Ski Erg', 'ski-erg'),
  ('Run - Treadmill', 'run-treadmill'),
  ('Run - Outside', 'run-outside'),
  ('Assault Bike', 'assault-bike'),
  ('Toes to Bar', 'toes-to-bar'),
  ('Plank', 'plank'),
  ('Ab Wheel Rollout', 'ab-wheel-rollout'),
  ('Hanging Leg Raise', 'hanging-leg-raise'),
  ('Dead Bug', 'dead-bug'),
  ('Cable Crunch', 'cable-crunch'),
  ('Pallof Press', 'pallof-press'),
  ('Bird Dog', 'bird-dog'),
  ('GHD Situp', 'ghd-situp'),
  ('Decline Situp', 'decline-situp'),
  ('Cable Woodchop', 'cable-woodchop'),
  ('Dragon Flag', 'dragon-flag'),
  ('Landmine Rotation', 'landmine-rotation'),
  ('Standing Plate Rotation', 'standing-plate-rotation'),
  -- Historical aliases (pre-20260422 rename, still present in set_logs)
  ('Overhead Press', 'barbell-overhead-press'),
  ('Romanian Dumbbell Deadlift', 'dumbbell-romanian-deadlift'),
  ('Box Squat', 'barbell-box-squat'),
  ('Front Squat', 'barbell-front-squat'),
  ('Seated machine row', 'seated-machine-row');

-- Orphan fallback: deterministic slugify in SQL, matching the slugify() helper
-- in packages/training-engine/src/auxiliary/exercise-catalog.ts.
-- Lowercase, replace runs of non-alphanumerics with '-', trim leading/trailing '-'.
CREATE OR REPLACE FUNCTION pg_temp.fallback_slug(input text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
    SELECT btrim(regexp_replace(lower(input), '[^a-z0-9]+', '-', 'g'), '-');
  $$;

-- ── auxiliary_exercises ───────────────────────────────────────────────────────
ALTER TABLE auxiliary_exercises
  ADD COLUMN IF NOT EXISTS exercise_slug text;

UPDATE auxiliary_exercises ae
  SET exercise_slug = m.slug
  FROM exercise_slug_map m
  WHERE ae.exercise_name = m.name
    AND ae.exercise_slug IS NULL;

UPDATE auxiliary_exercises
  SET exercise_slug = pg_temp.fallback_slug(exercise_name)
  WHERE exercise_slug IS NULL;

-- ── set_logs ─────────────────────────────────────────────────────────────────
-- Slug is NULL for primary-lift rows (where exercise is also NULL), matching
-- the existing exercise-column semantic.
ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS exercise_slug text;

UPDATE set_logs sl
  SET exercise_slug = m.slug
  FROM exercise_slug_map m
  WHERE sl.exercise = m.name
    AND sl.exercise_slug IS NULL;

UPDATE set_logs
  SET exercise_slug = pg_temp.fallback_slug(exercise)
  WHERE exercise_slug IS NULL
    AND exercise IS NOT NULL;

-- Match the original exercise-matches-kind constraint at the slug level too.
ALTER TABLE set_logs
  ADD CONSTRAINT set_logs_slug_matches_kind CHECK (
    (kind = 'primary' AND exercise_slug IS NULL)
    OR (kind = 'auxiliary' AND exercise_slug IS NOT NULL)
  );

-- Rebuild the idempotent-upsert unique index on slug. Renames now leave
-- (session_id, kind, slug, set_number) stable so dedup keeps working.
DROP INDEX IF EXISTS set_logs_unique_slot;
CREATE UNIQUE INDEX set_logs_unique_slot
  ON set_logs (session_id, kind, exercise_slug, set_number)
  NULLS NOT DISTINCT;

-- ── workout_template_items ───────────────────────────────────────────────────
ALTER TABLE workout_template_items
  ADD COLUMN IF NOT EXISTS exercise_slug text;

UPDATE workout_template_items wti
  SET exercise_slug = m.slug
  FROM exercise_slug_map m
  WHERE wti.exercise = m.name
    AND wti.exercise_slug IS NULL;

UPDATE workout_template_items
  SET exercise_slug = pg_temp.fallback_slug(exercise)
  WHERE exercise_slug IS NULL;

-- ── auxiliary_assignments (exercise_1, exercise_2) ───────────────────────────
ALTER TABLE auxiliary_assignments
  ADD COLUMN IF NOT EXISTS exercise_1_slug text,
  ADD COLUMN IF NOT EXISTS exercise_2_slug text;

UPDATE auxiliary_assignments aa
  SET exercise_1_slug = m.slug
  FROM exercise_slug_map m
  WHERE aa.exercise_1 = m.name
    AND aa.exercise_1_slug IS NULL;

UPDATE auxiliary_assignments aa
  SET exercise_2_slug = m.slug
  FROM exercise_slug_map m
  WHERE aa.exercise_2 = m.name
    AND aa.exercise_2_slug IS NULL;

UPDATE auxiliary_assignments
  SET exercise_1_slug = pg_temp.fallback_slug(exercise_1)
  WHERE exercise_1_slug IS NULL;

UPDATE auxiliary_assignments
  SET exercise_2_slug = pg_temp.fallback_slug(exercise_2)
  WHERE exercise_2_slug IS NULL;

-- All four slug columns are now fully populated (every existing display-name
-- row mapped via catalog or fallback). Lock in NOT NULL where the paired
-- display column is also NOT NULL so future writes can't forget the slug.
ALTER TABLE auxiliary_exercises
  ALTER COLUMN exercise_slug SET NOT NULL;
ALTER TABLE workout_template_items
  ALTER COLUMN exercise_slug SET NOT NULL;
ALTER TABLE auxiliary_assignments
  ALTER COLUMN exercise_1_slug SET NOT NULL,
  ALTER COLUMN exercise_2_slug SET NOT NULL;

DROP FUNCTION pg_temp.fallback_slug(text);

COMMIT;

NOTIFY pgrst, 'reload schema';
