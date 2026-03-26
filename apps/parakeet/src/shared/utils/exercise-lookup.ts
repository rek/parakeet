/**
 * Thin adapter over engine exercise catalog functions.
 *
 * If the engine's exercise API changes, only this file needs updating.
 */
export {
  getAllExercises,
  getExerciseType,
  getMusclesForExercise,
} from '@parakeet/training-engine';
