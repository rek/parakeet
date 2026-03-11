import { Lift } from '@parakeet/shared-types';
import { MuscleContribution, MuscleGroup } from '../types';

export type ExerciseType = 'weighted' | 'bodyweight' | 'timed';

export interface BodyweightPoolEntry {
  lift: Lift;
  sex: 'male' | 'female';
}

export interface ExerciseCatalogEntry {
  name: string;
  /** Which main lift this exercise primarily develops. null = general / no single-lift affinity. */
  associatedLift: Lift | null;
  /** Muscle groups this exercise trains at the primary (1.0 contribution) level. */
  primaryMuscles: MuscleGroup[];
  type: ExerciseType;
  /** Detailed 1.0/0.5 muscle contributions. Falls back to primaryMuscles at 1.0. */
  muscleContributions?: MuscleContribution[];
  /** Weight as % of associated lift's 1RM for JIT load calculation. Default: 0.675. */
  weightPct?: number;
  /** Rep target override for JIT. Falls back to sex default (10M / 12F). */
  repTarget?: number;
  /** Bodyweight pool membership. Specifies which lift+sex JIT bodyweight pools include
   *  this exercise (used for no-equipment disruption fallback). */
  bodyweightPools?: BodyweightPoolEntry[];
}

/**
 * Authoritative exercise catalog. All known exercises with lift affinity,
 * muscle groups, type, JIT weight%, rep targets, and bodyweight pool membership.
 *
 * This is the single source of truth for all exercise data.
 * Add new exercises here — do not edit jit-session-generator or muscle-mapper.
 *
 * `DEFAULT_AUXILIARY_POOLS` is derived from this — any exercise with a non-null
 * associatedLift appears in that lift's default pool.
 */
export const EXERCISE_CATALOG: ExerciseCatalogEntry[] = [
  // ── Squat auxiliaries ─────────────────────────────────────────────────────
  {
    name: 'Barbell Box Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    weightPct: 0.7,
    repTarget: 4,
  },
  {
    name: 'Dumbbell Step Up',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    weightPct: 0.15,
    repTarget: 10,
  },
  {
    name: 'Dumbbell Lunge',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    weightPct: 0.15,
    repTarget: 10,
  },
  {
    name: 'Front Barbell Box Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'upper_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'upper_back', contribution: 0.5 },
      { muscle: 'lower_back', contribution: 0.5 },
    ],
    weightPct: 0.55,
    repTarget: 4,
  },
  {
    name: 'Barbell Front Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'upper_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'upper_back', contribution: 0.5 },
      { muscle: 'lower_back', contribution: 0.5 },
    ],
    weightPct: 0.65,
    repTarget: 4,
  },
  {
    name: 'Pause Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'glutes', contribution: 1.0 },
      { muscle: 'hamstrings', contribution: 0.5 },
      { muscle: 'lower_back', contribution: 0.5 },
    ],
    weightPct: 0.75,
    repTarget: 4,
  },
  {
    name: 'Box Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'glutes', contribution: 1.0 },
      { muscle: 'hamstrings', contribution: 0.5 },
      { muscle: 'lower_back', contribution: 0.5 },
    ],
    weightPct: 0.7,
    repTarget: 4,
  },
  {
    name: 'High-Bar Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'glutes', contribution: 1.0 },
      { muscle: 'hamstrings', contribution: 0.5 },
      { muscle: 'lower_back', contribution: 0.5 },
    ],
    weightPct: 0.9,
    repTarget: 4,
  },
  {
    name: 'Front Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'upper_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'upper_back', contribution: 0.5 },
      { muscle: 'lower_back', contribution: 0.5 },
    ],
    weightPct: 0.8,
    repTarget: 4,
  },
  {
    name: 'Bulgarian Split Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'glutes', contribution: 1.0 },
      { muscle: 'hamstrings', contribution: 0.5 },
    ],
    weightPct: 0.4,
    repTarget: 10,
  },
  {
    name: 'Leg Press',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.5 },
    ],
    weightPct: 0.9,
    repTarget: 12,
  },
  {
    name: 'Hack Squat',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.5 },
    ],
    weightPct: 0.7,
    repTarget: 10,
  },

  {
    name: 'Barbell Thruster',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes', 'shoulders'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'glutes', contribution: 1.0 },
      { muscle: 'shoulders', contribution: 0.5 },
    ],
    weightPct: 0.5,
    repTarget: 6,
  },

  // ── Bench auxiliaries ─────────────────────────────────────────────────────
  {
    name: 'Close-Grip Barbell Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'triceps', contribution: 1.0 },
      { muscle: 'chest', contribution: 0.5 },
      { muscle: 'shoulders', contribution: 0.5 },
    ],
    weightPct: 0.75,
    repTarget: 5,
  },
  {
    name: 'Dumbbell Incline Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'shoulders'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'chest', contribution: 1.0 },
      { muscle: 'shoulders', contribution: 1.0 },
      { muscle: 'triceps', contribution: 0.5 },
    ],
    weightPct: 0.3,
    repTarget: 10,
  },
  {
    name: 'Barbell Pause Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
    weightPct: 0.75,
    repTarget: 4,
  },
  {
    name: 'Decline Barbell Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
    weightPct: 0.75,
    repTarget: 5,
  },
  {
    name: 'Barbell Incline Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'shoulders'],
    type: 'weighted',
    weightPct: 0.65,
    repTarget: 8,
  },
  {
    name: 'Dumbbell Fly',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'weighted',
    weightPct: 0.12,
    repTarget: 12,
  },
  {
    name: 'Floor Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'chest', contribution: 1.0 },
      { muscle: 'triceps', contribution: 1.0 },
    ],
    weightPct: 0.8,
    repTarget: 5,
  },
  {
    name: 'Board Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'chest', contribution: 1.0 },
      { muscle: 'triceps', contribution: 0.5 },
    ],
    weightPct: 0.85,
    repTarget: 4,
  },
  {
    name: 'Spoto Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'chest', contribution: 1.0 },
      { muscle: 'triceps', contribution: 0.5 },
    ],
    weightPct: 0.8,
    repTarget: 5,
  },
  {
    name: '1 Inch Pause Bench',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'chest', contribution: 1.0 },
      { muscle: 'triceps', contribution: 0.5 },
      { muscle: 'shoulders', contribution: 0.5 },
    ],
    weightPct: 0.8,
    repTarget: 4,
  },
  {
    name: 'Barbell Block Bench Press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'chest', contribution: 1.0 },
      { muscle: 'triceps', contribution: 0.5 },
    ],
    weightPct: 0.85,
    repTarget: 4,
  },
  {
    name: 'Barbell Push Press',
    associatedLift: 'bench',
    primaryMuscles: ['shoulders', 'triceps'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'shoulders', contribution: 1.0 },
      { muscle: 'triceps', contribution: 1.0 },
      { muscle: 'upper_back', contribution: 0.5 },
    ],
    weightPct: 0.7,
    repTarget: 5,
  },
  {
    name: 'JM Press',
    associatedLift: 'bench',
    primaryMuscles: ['triceps'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'triceps', contribution: 1.0 },
      { muscle: 'chest', contribution: 0.5 },
    ],
    weightPct: 0.5,
    repTarget: 6,
  },
  {
    name: 'Barbell Curl',
    associatedLift: 'bench',
    primaryMuscles: ['biceps'],
    type: 'weighted',
    muscleContributions: [{ muscle: 'biceps', contribution: 1.0 }],
    weightPct: 0.2,
    repTarget: 10,
  },
  {
    name: 'Dumbbell Curl',
    associatedLift: 'bench',
    primaryMuscles: ['biceps'],
    type: 'weighted',
    muscleContributions: [{ muscle: 'biceps', contribution: 1.0 }],
    weightPct: 0.15,
    repTarget: 12,
  },
  {
    name: 'Cable Curl',
    associatedLift: 'bench',
    primaryMuscles: ['biceps'],
    type: 'weighted',
    muscleContributions: [{ muscle: 'biceps', contribution: 1.0 }],
    weightPct: 0.15,
    repTarget: 12,
  },
  {
    name: 'EZ-Bar Curl',
    associatedLift: 'bench',
    primaryMuscles: ['biceps'],
    type: 'weighted',
    muscleContributions: [{ muscle: 'biceps', contribution: 1.0 }],
    weightPct: 0.2,
    repTarget: 10,
  },
  {
    name: 'Decline Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'male' }],
  },
  {
    name: 'Diamond Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'male' }],
  },
  {
    name: 'Archer Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'male' }],
  },
  {
    name: 'Pike Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['shoulders'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'male' }],
  },
  {
    name: 'Standard Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'female' }],
  },
  {
    name: 'Wide Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'female' }],
  },
  {
    name: 'Close-Grip Push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'female' }],
  },

  // ── Deadlift auxiliaries ──────────────────────────────────────────────────
  {
    name: 'Power Clean',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back', 'glutes'],
    type: 'weighted',
    weightPct: 0.5,
    repTarget: 3,
  },
  {
    name: 'Lat Pulldown',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    weightPct: 0.55,
    repTarget: 10,
  },
  {
    name: 'Seated machine row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    weightPct: 0.55,
    repTarget: 10,
  },
  {
    name: 'Rack Pull',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back', 'lower_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'upper_back', contribution: 1.0 },
      { muscle: 'lower_back', contribution: 1.0 },
    ],
    weightPct: 0.8,
    repTarget: 4,
  },
  {
    name: 'Kettlebell Swing',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'weighted',
    weightPct: 0.15,
    repTarget: 12,
  },
  {
    name: 'Pendlay Row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    weightPct: 0.35,
    repTarget: 8,
  },
  {
    name: 'Barbell Row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    weightPct: 0.4,
    repTarget: 8,
  },
  {
    name: 'Romanian Dumbbell Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'hamstrings', contribution: 1.0 },
      { muscle: 'glutes', contribution: 1.0 },
      { muscle: 'lower_back', contribution: 0.5 },
    ],
    weightPct: 0.2,
    repTarget: 8,
  },
  {
    name: 'Hexbar Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'quads'],
    type: 'weighted',
    weightPct: 0.75,
    repTarget: 4,
  },
  {
    name: 'Hexbar Deadlift Deficit',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'quads'],
    type: 'weighted',
    weightPct: 0.65,
    repTarget: 4,
  },
  {
    name: 'Dumbbell Row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    weightPct: 0.2,
    repTarget: 10,
  },
  {
    name: 'Sumo Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'quads'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'glutes', contribution: 1.0 },
      { muscle: 'quads', contribution: 0.5 },
      { muscle: 'hamstrings', contribution: 0.5 },
    ],
    weightPct: 0.75,
    repTarget: 4,
  },
  {
    name: 'Deficit Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'lower_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'hamstrings', contribution: 1.0 },
      { muscle: 'glutes', contribution: 1.0 },
      { muscle: 'lower_back', contribution: 1.0 },
    ],
    weightPct: 0.7,
    repTarget: 4,
  },
  {
    name: 'Kettlebell Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'weighted',
    weightPct: 0.15,
    repTarget: 8,
  },
  {
    name: 'Good Mornings',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'lower_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'hamstrings', contribution: 1.0 },
      { muscle: 'lower_back', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.5 },
    ],
    weightPct: 0.35,
    repTarget: 10,
  },
  {
    name: 'Block Pulls',
    associatedLift: 'deadlift',
    primaryMuscles: ['lower_back', 'upper_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'lower_back', contribution: 1.0 },
      { muscle: 'hamstrings', contribution: 0.5 },
      { muscle: 'glutes', contribution: 0.5 },
      { muscle: 'upper_back', contribution: 0.5 },
    ],
    weightPct: 0.8,
    repTarget: 4,
  },
  {
    name: 'Stiff-Leg Deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'lower_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'hamstrings', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.5 },
      { muscle: 'lower_back', contribution: 0.5 },
    ],
    weightPct: 0.6,
    repTarget: 8,
  },
  {
    name: 'Dumbbell Snatch',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back', 'glutes'],
    type: 'weighted',
    weightPct: 0.3,
    repTarget: 5,
  },
  {
    name: 'Deadhang',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'timed',
    muscleContributions: [
      { muscle: 'upper_back', contribution: 1.0 },
      { muscle: 'shoulders', contribution: 0.5 },
    ],
  },

  // ── General — no single-lift affinity ─────────────────────────────────────
  {
    name: 'Overhead Press',
    associatedLift: null,
    primaryMuscles: ['shoulders', 'triceps'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'shoulders', contribution: 1.0 },
      { muscle: 'triceps', contribution: 1.0 },
      { muscle: 'upper_back', contribution: 0.5 },
    ],
    weightPct: 0.58,
    repTarget: 8,
  },
  {
    name: 'Chin Up (weighted)',
    associatedLift: null,
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'upper_back', contribution: 1.0 },
      { muscle: 'biceps', contribution: 0.5 },
    ],
    weightPct: 0.2,
    repTarget: 8,
  },
  {
    name: 'Jump Squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'male' }],
  },
  {
    name: 'Pistol Squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'male' }],
  },
  {
    name: 'Box Jump',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'male' }],
  },
  {
    name: 'Sumo Squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'female' }],
  },
  {
    name: 'Curtsy Lunge',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'female' }],
  },
  {
    name: 'Hip Thrust',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [
      { lift: 'squat', sex: 'female' },
      { lift: 'deadlift', sex: 'female' },
    ],
  },
  {
    name: 'Glute Bridge',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'female' }],
  },
  {
    name: 'Nordic Hamstring Curl',
    associatedLift: null,
    primaryMuscles: ['hamstrings'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'male' }],
  },
  {
    name: 'Single-Leg RDL',
    associatedLift: null,
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'male' }],
  },
  {
    name: 'Bodyweight Good Morning',
    associatedLift: null,
    primaryMuscles: ['hamstrings', 'lower_back'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'male' }],
  },
  {
    name: 'Hyperextension',
    associatedLift: null,
    primaryMuscles: ['lower_back'],
    type: 'bodyweight',
    muscleContributions: [
      { muscle: 'lower_back', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.5 },
      { muscle: 'hamstrings', contribution: 0.5 },
    ],
    repTarget: 15,
    bodyweightPools: [{ lift: 'deadlift', sex: 'male' }],
  },
  {
    name: 'Single-Leg Glute Bridge',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'female' }],
  },
  {
    name: 'Donkey Kick',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'female' }],
  },
  {
    name: 'Glute Kickback',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'female' }],
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
    muscleContributions: [
      { muscle: 'chest', contribution: 1.0 },
      { muscle: 'triceps', contribution: 1.0 },
      { muscle: 'shoulders', contribution: 0.5 },
    ],
    repTarget: 10,
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

export const CATALOG_BY_NAME = new Map<string, ExerciseCatalogEntry>(
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
  deadlift: EXERCISE_CATALOG.filter(
    (e) => e.associatedLift === 'deadlift'
  ).map((e) => e.name),
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

/** Weight % of associated lift 1RM for JIT load calculation. Default: 0.675. */
export function getWeightPct(name: string): number {
  return CATALOG_BY_NAME.get(name)?.weightPct ?? 0.675;
}

/** Rep target for JIT generation. Returns fallback if not specified in catalog. */
export function getRepTarget(name: string, fallback: number): number {
  return CATALOG_BY_NAME.get(name)?.repTarget ?? fallback;
}

/** Bodyweight exercise names for a given lift + sex (JIT no-equipment fallback). */
export function getBodyweightPool(lift: Lift, sex: 'male' | 'female'): string[] {
  return EXERCISE_CATALOG.filter(
    (e) =>
      e.bodyweightPools?.some((p) => p.lift === lift && p.sex === sex) ?? false
  ).map((e) => e.name);
}
