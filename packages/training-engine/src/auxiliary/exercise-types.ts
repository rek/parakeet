import { EXERCISE_CATALOG, type ExerciseType } from './exercise-catalog';

export type { ExerciseType } from './exercise-catalog';

/** User-supplied type overrides for custom exercises (keyed by exercise name).
 *  Used when a row in `auxiliary_exercises` has `exercise_type` set. */
export type CustomExerciseTypeMap = Readonly<Record<string, ExerciseType>>;

// Fast lookup: catalog name → type
const CATALOG_TYPE = new Map(EXERCISE_CATALOG.map((e) => [e.name, e.type]));

/**
 * Explicit overrides for exercises not in the catalog (user-added custom names
 * and common spelling variants).
 */
const EXERCISE_TYPES_FALLBACK: Record<string, ExerciseType> = {
  'Pull Ups': 'bodyweight',
  Pullups: 'bodyweight',
  'Chin Ups': 'bodyweight',
  'Push Ups': 'bodyweight',
  'Step Up': 'bodyweight',
  'Bodyweight Squat': 'bodyweight',
};

/** Returns the exercise type; catalog first, then fallback map, then 'weighted'.
 *  Use `createExerciseTyper` instead when a per-user custom type map is available. */
export function getExerciseType(exerciseName: string): ExerciseType {
  return (
    CATALOG_TYPE.get(exerciseName) ??
    EXERCISE_TYPES_FALLBACK[exerciseName] ??
    'weighted'
  );
}

/** Returns a name→type resolver that consults the catalog first, then the
 *  user's custom map (e.g. "Running" → 'timed'), then the fallback map, then
 *  defaults to 'weighted'. Catalog wins over custom map by design — the
 *  catalog is the source of truth and custom rows can't override it. */
export function createExerciseTyper(
  customTypeMap?: CustomExerciseTypeMap
): (exerciseName: string) => ExerciseType {
  return (exerciseName) =>
    CATALOG_TYPE.get(exerciseName) ??
    customTypeMap?.[exerciseName] ??
    EXERCISE_TYPES_FALLBACK[exerciseName] ??
    'weighted';
}
