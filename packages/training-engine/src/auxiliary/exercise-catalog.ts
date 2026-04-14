import { Lift } from '@parakeet/shared-types';

import {
  MuscleContribution,
  MuscleGroup,
  PULL_MUSCLES,
  PUSH_MUSCLES,
} from '../types';

export const LIFTS: readonly Lift[] = ['squat', 'bench', 'deadlift'] as const;

export type ExerciseType = 'weighted' | 'bodyweight' | 'timed';

// ---------------------------------------------------------------------------
// Exercise metadata types (used by exercise scorer for smart selection)
// ---------------------------------------------------------------------------

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'push'
  | 'pull'
  | 'carry'
  | 'core';
export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'none';
export type ComplexityTier = 'simple' | 'moderate' | 'complex';

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
  /** Movement pattern classification for scoring diversity. Auto-derived from associatedLift/muscles if omitted. */
  movementPattern?: MovementPattern;
  /** Equipment required. Auto-derived from exercise name prefix if omitted. */
  equipment?: Equipment;
  /** Multi-joint movement. Auto-derived from primaryMuscles count if omitted. */
  isCompound?: boolean;
  /** CNS demand tier. Default: 'moderate'. */
  complexityTier?: ComplexityTier;
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
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.75 },
    ],
    weightPct: 0.7,
    repTarget: 4,
  },
  {
    name: 'Dumbbell Step Up',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.75 },
    ],
    weightPct: 0.15,
    repTarget: 10,
  },
  {
    name: 'Dumbbell Lunge',
    associatedLift: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.75 },
    ],
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
    // Machine — no stabilizer recruitment; 0.9 was unrealistically high
    weightPct: 0.5,
    repTarget: 12,
    equipment: 'machine',
    complexityTier: 'simple',
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
    // Machine — no stabilizer recruitment; reduced from 0.7
    weightPct: 0.4,
    repTarget: 10,
    equipment: 'machine',
    complexityTier: 'simple',
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
    complexityTier: 'complex',
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
    weightPct: 0.28,
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
    isCompound: false,
    complexityTier: 'simple',
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
    complexityTier: 'complex',
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
    movementPattern: 'pull',
    complexityTier: 'simple',
  },
  {
    name: 'Dumbbell Curl',
    associatedLift: 'bench',
    primaryMuscles: ['biceps'],
    type: 'weighted',
    muscleContributions: [{ muscle: 'biceps', contribution: 1.0 }],
    weightPct: 0.15,
    repTarget: 12,
    movementPattern: 'pull',
    complexityTier: 'simple',
  },
  {
    name: 'Cable Curl',
    associatedLift: 'bench',
    primaryMuscles: ['biceps'],
    type: 'weighted',
    muscleContributions: [{ muscle: 'biceps', contribution: 1.0 }],
    weightPct: 0.15,
    repTarget: 12,
    movementPattern: 'pull',
    complexityTier: 'simple',
  },
  {
    name: 'EZ-Bar Curl',
    associatedLift: 'bench',
    primaryMuscles: ['biceps'],
    type: 'weighted',
    muscleContributions: [{ muscle: 'biceps', contribution: 1.0 }],
    weightPct: 0.2,
    repTarget: 10,
    movementPattern: 'pull',
    equipment: 'barbell',
    complexityTier: 'simple',
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
    name: 'Barbell Hang Clean',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'upper_back', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.5 },
      { muscle: 'hamstrings', contribution: 0.5 },
    ],
    weightPct: 0.5,
    repTarget: 3,
    complexityTier: 'complex',
  },
  {
    name: 'Clean and Jerk',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back', 'shoulders'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'upper_back', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.5 },
      { muscle: 'shoulders', contribution: 0.5 },
    ],
    // Jerk is the limiting factor — lighter than hang clean or power clean
    weightPct: 0.45,
    repTarget: 3,
    complexityTier: 'complex',
  },
  {
    name: 'Power Clean',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'upper_back', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.5 },
    ],
    // Full pull from floor — heaviest of the three clean variants
    weightPct: 0.55,
    repTarget: 3,
    complexityTier: 'complex',
  },
  {
    name: 'Lat Pulldown',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    // Prod data: users load ~28% of DL 1RM on cable machines (was 0.55 — 2x too high)
    weightPct: 0.28,
    repTarget: 10,
    movementPattern: 'pull',
    equipment: 'machine',
    isCompound: true,
    complexityTier: 'simple',
  },
  {
    name: 'Seated machine row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    // Prod data: users load ~28% of DL 1RM on machines (was 0.55 — 2x too high)
    weightPct: 0.28,
    repTarget: 10,
    movementPattern: 'pull',
    equipment: 'machine',
    isCompound: true,
    complexityTier: 'simple',
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
    weightPct: 0.2,
    repTarget: 12,
  },
  {
    name: 'Pendlay Row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    weightPct: 0.35,
    repTarget: 8,
    movementPattern: 'pull',
    isCompound: true,
  },
  {
    name: 'Barbell Row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    weightPct: 0.4,
    repTarget: 8,
    movementPattern: 'pull',
    isCompound: true,
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
    movementPattern: 'pull',
    complexityTier: 'simple',
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
    weightPct: 0.2,
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
    name: 'Barbell Snatch',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back', 'shoulders'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'upper_back', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.5 },
      { muscle: 'shoulders', contribution: 0.5 },
    ],
    weightPct: 0.45,
    repTarget: 3,
    complexityTier: 'complex',
  },
  {
    name: 'Dumbbell Snatch',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'upper_back', contribution: 1.0 },
      { muscle: 'glutes', contribution: 0.5 },
    ],
    weightPct: 0.21,
    repTarget: 5,
    complexityTier: 'complex',
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
    movementPattern: 'pull',
    complexityTier: 'simple',
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
    equipment: 'bodyweight',
    isCompound: true,
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
    complexityTier: 'simple',
  },
  {
    name: 'Glute Bridge',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'female' }],
    complexityTier: 'simple',
  },
  {
    name: 'Nordic Hamstring Curl',
    associatedLift: null,
    primaryMuscles: ['hamstrings'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'male' }],
    complexityTier: 'simple',
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
    complexityTier: 'simple',
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
    complexityTier: 'simple',
  },
  {
    name: 'Single-Leg Glute Bridge',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'female' }],
    complexityTier: 'simple',
  },
  {
    name: 'Donkey Kick',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'female' }],
    complexityTier: 'simple',
  },
  {
    name: 'Glute Kickback',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'female' }],
    complexityTier: 'simple',
  },
  {
    name: 'Pull-ups',
    associatedLift: null,
    primaryMuscles: ['upper_back'],
    type: 'bodyweight',
    isCompound: true,
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
  // ── Cardio / Core ─────────────────────────────────────────────────────────
  {
    name: 'Row Machine',
    associatedLift: null,
    primaryMuscles: ['upper_back', 'biceps'],
    type: 'timed',
    repTarget: 1,
  },
  {
    name: 'Ski Erg',
    associatedLift: null,
    primaryMuscles: ['upper_back', 'shoulders', 'triceps'],
    type: 'timed',
    repTarget: 1,
  },
  {
    name: 'Run - Treadmill',
    associatedLift: null,
    primaryMuscles: ['quads', 'hamstrings'],
    type: 'timed',
    repTarget: 1,
  },
  {
    name: 'Run - Outside',
    associatedLift: null,
    primaryMuscles: ['quads', 'hamstrings'],
    type: 'timed',
    repTarget: 1,
  },
  {
    name: 'Toes to Bar',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'bodyweight',
    repTarget: 10,
    movementPattern: 'core',
    equipment: 'bodyweight',
    complexityTier: 'moderate',
  },
  {
    name: 'Plank',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'timed',
    repTarget: 1,
    movementPattern: 'core',
    equipment: 'bodyweight',
    complexityTier: 'simple',
  },
  {
    name: 'Ab Wheel Rollout',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'bodyweight',
    repTarget: 8,
    movementPattern: 'core',
    equipment: 'bodyweight',
    complexityTier: 'moderate',
  },
  {
    name: 'Hanging Leg Raise',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'bodyweight',
    repTarget: 10,
    movementPattern: 'core',
    equipment: 'bodyweight',
    complexityTier: 'simple',
  },
  {
    name: 'Dead Bug',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'bodyweight',
    repTarget: 10,
    movementPattern: 'core',
    equipment: 'bodyweight',
    complexityTier: 'simple',
  },
  {
    name: 'Cable Crunch',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'weighted',
    weightPct: 0.15,
    repTarget: 12,
    movementPattern: 'core',
    equipment: 'cable',
    complexityTier: 'simple',
  },
  {
    name: 'Pallof Press',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'weighted',
    weightPct: 0.10,
    repTarget: 10,
    movementPattern: 'core',
    equipment: 'cable',
    complexityTier: 'simple',
  },
  {
    name: 'Bird Dog',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'bodyweight',
    repTarget: 10,
    movementPattern: 'core',
    equipment: 'bodyweight',
    complexityTier: 'simple',
  },
  {
    name: 'GHD Situp',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'bodyweight',
    repTarget: 15,
    movementPattern: 'core',
    equipment: 'machine',
    complexityTier: 'moderate',
  },
  {
    name: 'Decline Situp',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'bodyweight',
    repTarget: 15,
    movementPattern: 'core',
    equipment: 'bodyweight',
    complexityTier: 'simple',
  },
  {
    name: 'Cable Woodchop',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'weighted',
    weightPct: 0.10,
    repTarget: 12,
    movementPattern: 'core',
    equipment: 'cable',
    complexityTier: 'moderate',
  },
  {
    name: 'Dragon Flag',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'bodyweight',
    repTarget: 6,
    movementPattern: 'core',
    equipment: 'bodyweight',
    complexityTier: 'complex',
  },
  {
    name: 'Landmine Rotation',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'weighted',
    weightPct: 0.08,
    repTarget: 10,
    movementPattern: 'core',
    equipment: 'barbell',
    complexityTier: 'moderate',
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
  deadlift: EXERCISE_CATALOG.filter((e) => e.associatedLift === 'deadlift').map(
    (e) => e.name
  ),
};

/** Non-timed core exercises available for volume top-up selection. */
export const DEFAULT_CORE_POOL: string[] = EXERCISE_CATALOG.filter(
  (e) => e.primaryMuscles.includes('core') && e.type !== 'timed'
).map((e) => e.name);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Full catalog — use for manual add pickers. */
export function getAllExercises(): ExerciseCatalogEntry[] {
  return EXERCISE_CATALOG;
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

// ── Custom exercise registry ──────────────────────────────────────────────────
//
// User-defined exercises (not in EXERCISE_CATALOG) are registered here at
// app startup so getMusclesForExercise can return their muscles. Catalog
// exercises always take priority — the registry is only a fallback.

const customExerciseRegistry = new Map<string, MuscleGroup[]>();

/**
 * Register a user-defined exercise and its primary muscles.
 * Call this at JIT time after loading auxiliary pool data from the DB.
 * Safe to call multiple times — idempotent per name.
 */
export function registerCustomExercise(
  name: string,
  primaryMuscles: MuscleGroup[]
): void {
  customExerciseRegistry.set(name, primaryMuscles);
}

/**
 * Clear all registered custom exercises.
 * Call between tests to prevent bleed.
 */
export function clearCustomExerciseRegistry(): void {
  customExerciseRegistry.clear();
}

/** Internal: used by getMusclesForExercise to fall back to user-registered muscles. */
export function getCustomExerciseMuscles(
  name: string
): MuscleGroup[] | undefined {
  return customExerciseRegistry.get(name);
}

/** Bodyweight exercise names for a given lift + sex (JIT no-equipment fallback). */
export function getBodyweightPool(
  lift: Lift,
  sex: 'male' | 'female'
): string[] {
  return EXERCISE_CATALOG.filter(
    (e) =>
      e.bodyweightPools?.some((p) => p.lift === lift && p.sex === sex) ?? false
  ).map((e) => e.name);
}

// ---------------------------------------------------------------------------
// Metadata resolvers — derive defaults from existing catalog data
// ---------------------------------------------------------------------------

// Re-use canonical sets from types.ts (avoid duplication)
const PUSH_MUSCLE_IDS = PUSH_MUSCLES;
const PULL_MUSCLE_IDS = PULL_MUSCLES;

export function resolveEquipment(entry: ExerciseCatalogEntry): Equipment {
  if (entry.equipment) return entry.equipment;
  if (entry.type === 'bodyweight') return 'bodyweight';
  if (entry.type === 'timed') return 'none';
  if (entry.name.startsWith('Dumbbell')) return 'dumbbell';
  if (entry.name.startsWith('Kettlebell')) return 'kettlebell';
  if (entry.name.startsWith('Cable')) return 'cable';
  return 'barbell';
}

export function resolveMovementPattern(
  entry: ExerciseCatalogEntry
): MovementPattern {
  if (entry.movementPattern) return entry.movementPattern;
  if (entry.associatedLift === 'squat') return 'squat';
  if (entry.associatedLift === 'bench') return 'push';
  if (entry.associatedLift === 'deadlift') return 'hinge';
  // General exercises: infer from primary muscles
  const muscles = entry.primaryMuscles;
  if (muscles.includes('core')) return 'core';
  if (muscles.includes('quads')) return 'squat';
  if (
    muscles.includes('hamstrings') ||
    muscles.includes('lower_back') ||
    (muscles.includes('glutes') && !muscles.includes('quads'))
  )
    return 'hinge';
  if (muscles.some((m) => PULL_MUSCLE_IDS.has(m))) return 'pull';
  if (muscles.some((m) => PUSH_MUSCLE_IDS.has(m))) return 'push';
  return 'push';
}

export function resolveIsCompound(entry: ExerciseCatalogEntry): boolean {
  if (entry.isCompound != null) return entry.isCompound;
  if (entry.muscleContributions) {
    return (
      entry.muscleContributions.filter((m) => m.contribution >= 0.5).length >= 2
    );
  }
  return entry.primaryMuscles.length >= 2;
}

export function resolveComplexityTier(
  entry: ExerciseCatalogEntry
): ComplexityTier {
  if (entry.complexityTier) return entry.complexityTier;
  return 'moderate';
}

// ---------------------------------------------------------------------------
// Sqrt-scaled weight computation for unstable implements (engine-GH#84)
// ---------------------------------------------------------------------------

/**
 * Reference 1RMs at which the linear weightPct values were calibrated.
 * Used as the midpoint for sqrt scaling of dumbbell/kettlebell exercises.
 * At this exact 1RM, sqrt output equals linear output.
 */
const SQRT_REFERENCE_1RM: Record<Lift, { male: number; female: number }> = {
  squat: { male: 120, female: 70 },
  bench: { male: 80, female: 50 },
  deadlift: { male: 140, female: 80 },
};

/**
 * Compute auxiliary exercise working weight, applying sqrt scaling for
 * dumbbell/kettlebell exercises to correct for non-linear stabilization penalty.
 *
 * For barbell/machine/cable exercises: weight = oneRmKg × weightPct (linear, as before)
 * For dumbbell/kettlebell exercises: weight = weightPct × sqrt(referenceRm × oneRmKg)
 *   — At the reference 1RM, output equals the linear formula.
 *   — Above it, weight grows slower (stronger lifters get proportionally lighter DBs).
 */
export function computeAuxWeight({
  exercise,
  oneRmKg,
  lift,
  biologicalSex,
}: {
  exercise: string;
  oneRmKg: number;
  lift: Lift;
  biologicalSex?: 'female' | 'male';
}) {
  const pct = getWeightPct(exercise);
  const isUnstable =
    exercise.startsWith('Dumbbell') || exercise.startsWith('Kettlebell');

  if (!isUnstable) return oneRmKg * pct;

  const sex = biologicalSex ?? 'male';
  const ref =
    SQRT_REFERENCE_1RM[lift]?.[sex] ?? SQRT_REFERENCE_1RM[lift]?.male ?? 100;
  return pct * Math.sqrt(ref * oneRmKg);
}
