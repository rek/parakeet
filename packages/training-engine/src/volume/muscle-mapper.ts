import { Lift } from '@parakeet/shared-types';
import { CATALOG_BY_NAME } from '../auxiliary/exercise-catalog';
import { MuscleContribution } from '../types';

// Primary lift → muscle contributions
// 1.0 = primary mover, 0.5 = significant secondary
// Calibrated to RP Strength volume landmark values (see docs/design/volume-mrv-methodology.md)
const LIFT_MUSCLES: Record<string, MuscleContribution[]> = {
  squat: [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'glutes', contribution: 0.75 },
    { muscle: 'hamstrings', contribution: 0.5 },
    { muscle: 'lower_back', contribution: 0.5 },
  ],
  bench: [
    { muscle: 'chest', contribution: 1.0 },
    { muscle: 'triceps', contribution: 0.4 },
    { muscle: 'shoulders', contribution: 0.4 },
  ],
  deadlift: [
    { muscle: 'hamstrings', contribution: 1.0 },
    { muscle: 'glutes', contribution: 0.75 },
    { muscle: 'lower_back', contribution: 1.0 },
    { muscle: 'upper_back', contribution: 0.5 },
  ],
};

export function getMusclesForLift(
  lift: Lift,
  exercise?: string
): MuscleContribution[] {
  if (exercise) {
    const entry = CATALOG_BY_NAME.get(exercise);
    if (entry?.muscleContributions) return entry.muscleContributions;
    if (entry?.primaryMuscles.length) {
      return entry.primaryMuscles.map((muscle) => ({
        muscle,
        contribution: 1.0 as const,
      }));
    }
  }
  return LIFT_MUSCLES[lift] ?? [];
}

export function getMusclesForExercise(
  exerciseName: string
): MuscleContribution[] {
  const entry = CATALOG_BY_NAME.get(exerciseName);
  if (entry?.muscleContributions) return entry.muscleContributions;
  if (entry?.primaryMuscles.length) {
    return entry.primaryMuscles.map((muscle) => ({
      muscle,
      contribution: 1.0 as const,
    }));
  }
  return [];
}
