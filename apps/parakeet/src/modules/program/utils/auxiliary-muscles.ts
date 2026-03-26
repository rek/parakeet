import { PRIMARY_CONTRIBUTION_THRESHOLD } from '@shared/constants/training';
import { getMusclesForExercise } from '@shared/utils/exercise-lookup';

/** Returns primary muscle names for a given exercise. Returns [] for unknown exercises. */
export function getPrimaryMuscles(exerciseName: string): string[] {
  return getMusclesForExercise(exerciseName)
    .filter((c) => c.contribution >= PRIMARY_CONTRIBUTION_THRESHOLD)
    .map((c) => c.muscle);
}
