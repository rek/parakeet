// @spec docs/features/workout-templates/spec-management.md
import { CATALOG_BY_NAME } from '@parakeet/training-engine';

import type { WorkoutTemplateItemInput } from '../model/types';

/** Sensible starting prescription for a freshly-added template item. The user
 *  can edit any of these in the editor. */
export function defaultItemForExercise(
  exercise: string,
  position: number
): WorkoutTemplateItemInput {
  const catalog = CATALOG_BY_NAME.get(exercise);
  const isTimed = catalog?.type === 'timed';
  return {
    position,
    exercise,
    duration_seconds: isTimed ? 60 : null,
    reps: isTimed ? null : (catalog?.repTarget ?? 10),
    rest_after_seconds: 60,
  };
}
