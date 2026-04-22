/**
 * Thin adapter over engine exercise catalog functions.
 *
 * If the engine's exercise API changes, only this file needs updating.
 */
import { CATALOG_BY_NAME } from '@parakeet/training-engine';

import { formatExerciseName } from './string';

export {
  getAllExercises,
  getExerciseType,
  getMusclesForExercise,
} from '@parakeet/training-engine';
export type { ExerciseCatalogEntry } from '@parakeet/training-engine';

/** Returns the catalog subtitle for an exercise name (snake_case or Title Case). */
export function getExerciseSubtitle(name: string): string | undefined {
  return (
    CATALOG_BY_NAME.get(name)?.subtitle ??
    CATALOG_BY_NAME.get(formatExerciseName(name))?.subtitle
  );
}
