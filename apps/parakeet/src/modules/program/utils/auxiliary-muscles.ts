import { getMusclesForExercise } from '@modules/session';

/** Returns primary muscle names (contribution >= 1.0) for a given exercise. Returns [] for unknown exercises. */
export function getPrimaryMuscles(exerciseName: string): string[] {
  return getMusclesForExercise(exerciseName)
    .filter((c) => c.contribution >= 1.0)
    .map((c) => c.muscle);
}
