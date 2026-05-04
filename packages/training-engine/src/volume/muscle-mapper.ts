import { Lift } from '@parakeet/shared-types';

import { CATALOG_BY_NAME } from '../auxiliary/exercise-catalog';
import { MuscleContribution, MuscleGroup, MuscleMapper } from '../types';

// Primary lift → muscle contributions
// Calibrated against EMG systematic reviews — see docs/domain/muscle-mapping.md
// for research ranges and design rationale per factor
const LIFT_MUSCLES: Record<string, MuscleContribution[]> = {
  squat: [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'glutes', contribution: 0.55 },
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
    { muscle: 'upper_back', contribution: 0.7 },
  ],
};

/**
 * Per-user muscle map for exercises the lifter has registered themselves
 * (e.g. "Pec Deck", "Cable Fly") that don't appear in EXERCISE_CATALOG.
 * Each entry's muscles are credited at contribution 1.0.
 */
export type CustomMuscleMap = Readonly<
  Record<string, readonly MuscleGroup[]>
>;

/**
 * Build a {@link MuscleMapper} closed over a user-specific custom muscle map.
 * Catalog entries always take priority; the custom map is consulted only when
 * the catalog has no entry. When neither resolves, falls back to the lift's
 * muscle contributions, or `[]` for ad-hoc sessions (lift = null).
 */
export function createMuscleMapper(
  customMuscleMap?: CustomMuscleMap
): MuscleMapper {
  return (lift, exercise) => {
    if (exercise) {
      const entry = CATALOG_BY_NAME.get(exercise);
      if (entry?.muscleContributions) return entry.muscleContributions;
      if (entry?.primaryMuscles.length) {
        return entry.primaryMuscles.map((muscle) => ({
          muscle,
          contribution: 1.0 as const,
        }));
      }
      const custom = customMuscleMap?.[exercise];
      if (custom?.length) {
        return custom.map((muscle) => ({
          muscle,
          contribution: 1.0 as const,
        }));
      }
    }
    if (!lift) return [];
    return LIFT_MUSCLES[lift] ?? [];
  };
}

/**
 * Catalog-only mapper. Use when the caller has no user context — e.g. internal
 * engine helpers that only ever query primary lifts. App entry points with
 * access to the user's aux muscle map should build their own via
 * {@link createMuscleMapper}.
 */
export const defaultMuscleMapper: MuscleMapper = createMuscleMapper();

/** Catalog-only lift→muscles lookup. Equivalent to `defaultMuscleMapper`. */
export const getMusclesForLift: MuscleMapper = defaultMuscleMapper;

/** Catalog-only exercise→muscles lookup. Returns `[]` for unknown names. */
export function getMusclesForExercise(
  exerciseName: string
): MuscleContribution[] {
  return defaultMuscleMapper(null, exerciseName);
}

// Re-export the type for convenience — callers building mappers shouldn't need
// to know it lives in types.ts.
export type { Lift, MuscleMapper };
