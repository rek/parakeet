import { EXERCISE_CATALOG } from './exercise-catalog';

export type { ExerciseType } from './exercise-catalog';

// Fast lookup: catalog name → type
const CATALOG_TYPE = new Map(EXERCISE_CATALOG.map((e) => [e.name, e.type]));

/**
 * Explicit overrides for exercises not in the catalog (user-added custom names
 * and common spelling variants).
 */
const EXERCISE_TYPES_FALLBACK: Record<
  string,
  'weighted' | 'bodyweight' | 'timed'
> = {
  'Pull Ups': 'bodyweight',
  Pullups: 'bodyweight',
  'Chin Ups': 'bodyweight',
  'Push Ups': 'bodyweight',
  'Step Up': 'bodyweight',
  'Bodyweight Squat': 'bodyweight',
};

/** Returns the exercise type; catalog first, then fallback map, then 'weighted'. */
export function getExerciseType(
  exerciseName: string
): 'weighted' | 'bodyweight' | 'timed' {
  return (
    CATALOG_TYPE.get(exerciseName) ??
    EXERCISE_TYPES_FALLBACK[exerciseName] ??
    'weighted'
  );
}
