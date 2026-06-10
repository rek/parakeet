/**
 * Thin adapter over engine exercise catalog functions.
 *
 * If the engine's exercise API changes, only this file needs updating.
 */
import { getCatalogEntry } from '@parakeet/training-engine';

import { formatExerciseName } from './string';

export {
  getAllExercises,
  getCatalogEntry,
  getDisplayNameForSlug,
  getExerciseType,
  getMusclesForExercise,
  prettifySlug,
  slugify,
} from '@parakeet/training-engine';
export type { ExerciseCatalogEntry } from '@parakeet/training-engine';

/** Returns the catalog subtitle for an exercise name, slug, or snake_case form. */
export function getExerciseSubtitle(nameOrSlug: string): string | undefined {
  return (
    getCatalogEntry(nameOrSlug)?.subtitle ??
    getCatalogEntry(formatExerciseName(nameOrSlug))?.subtitle
  );
}
