import { Lift } from '@parakeet/shared-types';
import { MuscleGroup } from '../types';

export type ExerciseType = 'weighted' | 'bodyweight' | 'timed';

export interface ExerciseCatalogEntry {
  name: string;
  /** Which main lift this exercise primarily develops. null = general / no single-lift affinity. */
  associatedLift: Lift | null;
  /** Muscle groups this exercise trains at the primary (1.0 contribution) level. */
  primaryMuscles: MuscleGroup[];
  type: ExerciseType;
}

/**
 * Authoritative exercise catalog. All known exercises with lift affinity,
 * muscle groups, and type. `DEFAULT_AUXILIARY_POOLS` is derived from this —
 * any exercise with a non-null associatedLift appears in that lift's default pool.
 *
 * Add new exercises here; do not edit DEFAULT_AUXILIARY_POOLS directly.
 */
export const EXERCISE_CATALOG: ExerciseCatalogEntry[] = [
  // ── Squat auxiliaries ─────────────────────────────────────────────────────
  {
    name: 'Barbell Box Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
  },
  {
    name: 'Dumbbell Step Up',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
  },
  {
    name: 'Dumbbell Lunge',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
  },
  {
    name: 'Front Barbell Box Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'upper_back'],
    type: 'weighted',
  },
  {
    name: 'Barbell Front Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'upper_back'],
    type: 'weighted',
  },

  // ── Bench auxiliaries ─────────────────────────────────────────────────────
  {
    name: 'Close-Grip Barbell Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
  },
  {
    name: 'Dumbbell Incline Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'shoulders'],
    type: 'weighted',
  },
  {
    name: 'Barbell Pause Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
  },
  {
    name: 'Decline Barbell Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
  },
  {
    name: 'Barbell Incline Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'shoulders'],
    type: 'weighted',
  },
  {
    name: 'Dumbbell Fly',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'weighted',
  },
  {
    name: 'Decline Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
  },
  {
    name: 'Diamond Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'bodyweight',
  },
  {
    name: 'Archer Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
  },
  {
    name: 'Pike Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['shoulders'],
    type: 'bodyweight',
  },
  {
    name: 'Standard Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
  },
  {
    name: 'Wide Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
  },
  {
    name: 'Close-Grip Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'bodyweight',
  },

  // ── Deadlift auxiliaries ──────────────────────────────────────────────────
  {
    name: 'Power Clean',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back', 'glutes'],
    type: 'weighted',
  },
  {
    name: 'Lat Pulldown',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
  },
  {
    name: 'Seated machine row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
  },
  {
    name: 'Rack Pull',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'upper_back'],
    type: 'weighted',
  },
  {
    name: 'Kettlebell Swing',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'weighted',
  },
  {
    name: 'Pendlay Row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
  },
  {
    name: 'Barbell Row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
  },
  {
    name: 'Romanian Dumbbell Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'weighted',
  },
  {
    name: 'Hexbar Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'quads'],
    type: 'weighted',
  },
  {
    name: 'Hexbar Deadlift Deficit',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'quads'],
    type: 'weighted',
  },
  {
    name: 'Dumbbell Row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
  },
  {
    name: 'Sumo Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'quads'],
    type: 'weighted',
  },
  {
    name: 'Deficit Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'lower_back'],
    type: 'weighted',
  },
  {
    name: 'Kettlebell Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'weighted',
  },

  // ── General — bodyweight (no single-lift affinity; available for manual add) ──
  {
    name: 'Chin Up (weighted)',
    associatedLift: null,
    primaryMuscles: ['upper_back'],
    type: 'weighted',
  },
  {
    name: 'Jump Squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Pistol Squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Box Jump',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Sumo Squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Curtsy Lunge',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Hip Thrust',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Glute Bridge',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Nordic Hamstring Curl',
    associatedLift: null,
    primaryMuscles: ['hamstrings'],
    type: 'bodyweight',
  },
  {
    name: 'Single-Leg RDL',
    associatedLift: null,
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Bodyweight Good Morning',
    associatedLift: null,
    primaryMuscles: ['hamstrings', 'lower_back'],
    type: 'bodyweight',
  },
  {
    name: 'Hyperextension',
    associatedLift: null,
    primaryMuscles: ['lower_back'],
    type: 'bodyweight',
  },
  {
    name: 'Single-Leg Glute Bridge',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Donkey Kick',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Glute Kickback',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Pull-ups',
    associatedLift: null,
    primaryMuscles: ['upper_back'],
    type: 'bodyweight',
  },
  {
    name: 'Chin-ups',
    associatedLift: null,
    primaryMuscles: ['upper_back', 'biceps'],
    type: 'bodyweight',
  },
  {
    name: 'Push-ups',
    associatedLift: null,
    primaryMuscles: ['chest'],
    type: 'bodyweight',
  },
  {
    name: 'Dips',
    associatedLift: null,
    primaryMuscles: ['chest', 'triceps'],
    type: 'bodyweight',
  },
  {
    name: 'Air Squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Lunge',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
  },
];

// ── Fast lookup ───────────────────────────────────────────────────────────────

const CATALOG_BY_NAME = new Map<string, ExerciseCatalogEntry>(
  EXERCISE_CATALOG.map((e) => [e.name, e])
);

// ── Derived default pools (lift-specific entries only, in catalog order) ──────

export const DEFAULT_AUXILIARY_POOLS: Record<Lift, string[]> = {
  squat: EXERCISE_CATALOG.filter((e) => e.associatedLift === 'squat').map(
    (e) => e.name
  ),
  bench: EXERCISE_CATALOG.filter((e) => e.associatedLift === 'bench').map(
    (e) => e.name
  ),
  deadlift: EXERCISE_CATALOG.filter((e) => e.associatedLift === 'deadlift').map(
    (e) => e.name
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Full catalog — use for manual add pickers. Excludes timed exercises. */
export function getAllExercises(): ExerciseCatalogEntry[] {
  return EXERCISE_CATALOG.filter((e) => e.type !== 'timed');
}

/** Primary muscles (contribution >= 1.0) for an exercise. Empty array if unknown. */
export function getPrimaryMusclesForExercise(name: string): MuscleGroup[] {
  return CATALOG_BY_NAME.get(name)?.primaryMuscles ?? [];
}

/** Which main lift this exercise is associated with. null if general or unknown. */
export function getLiftForExercise(name: string): Lift | null {
  return CATALOG_BY_NAME.get(name)?.associatedLift ?? null;
}
