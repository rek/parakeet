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
  /** Stable kebab-case identifier. Never changes once assigned. Catalog renames
   *  edit `name` but leave `slug` untouched, so stored DB references survive. */
  slug: string;
  /** Short variant descriptor shown below the name in UI (e.g. 'Above the knee'). */
  subtitle?: string;
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
    slug: 'barbell-box-squat',
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
    slug: 'dumbbell-step-up',
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
    slug: 'dumbbell-lunge',
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
    slug: 'front-barbell-box-squat',
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
    slug: 'barbell-front-squat',
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
    slug: 'pause-squat',
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
    name: 'High-Bar Squat',
    slug: 'high-bar-squat',
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
    name: 'Bulgarian Split Squat',
    slug: 'bulgarian-split-squat',
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
    slug: 'leg-press',
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
    slug: 'hack-squat',
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
    slug: 'barbell-thruster',
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
    slug: 'close-grip-barbell-bench-press',
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
    slug: 'dumbbell-incline-bench-press',
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
    slug: 'barbell-pause-bench-press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
    weightPct: 0.75,
    repTarget: 4,
  },
  {
    name: 'Decline Barbell Bench Press',
    slug: 'decline-barbell-bench-press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'weighted',
    weightPct: 0.75,
    repTarget: 5,
  },
  {
    name: 'Barbell Incline Bench Press',
    slug: 'barbell-incline-bench-press',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'shoulders'],
    type: 'weighted',
    weightPct: 0.65,
    repTarget: 8,
  },
  {
    name: 'Dumbbell Fly',
    slug: 'dumbbell-fly',
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
    slug: 'floor-press',
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
    slug: 'board-press',
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
    slug: 'spoto-press',
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
    slug: '1-inch-pause-bench',
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
    slug: 'barbell-block-bench-press',
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
    slug: 'barbell-push-press',
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
    slug: 'jm-press',
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
    slug: 'barbell-curl',
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
    slug: 'dumbbell-curl',
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
    slug: 'cable-curl',
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
    slug: 'ez-bar-curl',
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
    slug: 'decline-push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'male' }],
  },
  {
    name: 'Diamond Push-ups',
    slug: 'diamond-push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'male' }],
  },
  {
    name: 'Archer Push-ups',
    slug: 'archer-push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'male' }],
  },
  {
    name: 'Pike Push-ups',
    slug: 'pike-push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['shoulders'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'male' }],
  },
  {
    name: 'Standard Push-ups',
    slug: 'standard-push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'female' }],
  },
  {
    name: 'Wide Push-ups',
    slug: 'wide-push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'female' }],
  },
  {
    name: 'Close-Grip Push-ups',
    slug: 'close-grip-push-ups',
    associatedLift: 'bench',
    primaryMuscles: ['chest', 'triceps'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'bench', sex: 'female' }],
  },

  // ── Deadlift auxiliaries ──────────────────────────────────────────────────
  {
    name: 'Barbell Hang Clean',
    slug: 'barbell-hang-clean',
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
    slug: 'clean-and-jerk',
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
    slug: 'power-clean',
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
    slug: 'lat-pulldown',
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
    name: 'Seated Machine Row',
    slug: 'seated-machine-row',
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
    slug: 'rack-pull',
    subtitle: 'Above the knee',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back', 'lower_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'upper_back', contribution: 1.0 },
      { muscle: 'lower_back', contribution: 1.0 },
    ],
    // Very short ROM from above-knee pins — supramax overload is the whole point.
    // 105% of DL 1RM at 4 reps; engine has no 1.0 cap on weightPct.
    weightPct: 1.05,
    repTarget: 4,
  },
  {
    name: 'Rack Pull Below Knee',
    slug: 'rack-pull-below-knee',
    subtitle: 'Below the knee',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back', 'lower_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'upper_back', contribution: 1.0 },
      { muscle: 'lower_back', contribution: 1.0 },
    ],
    // Skips floor-to-knee (hardest portion) but meaningful ROM — same load as block pulls.
    weightPct: 0.95,
    repTarget: 4,
  },
  {
    name: 'Kettlebell Swing',
    slug: 'kettlebell-swing',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'weighted',
    weightPct: 0.2,
    repTarget: 12,
  },
  {
    name: 'Pendlay Row',
    slug: 'pendlay-row',
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
    slug: 'barbell-row',
    associatedLift: 'deadlift',
    primaryMuscles: ['upper_back'],
    type: 'weighted',
    weightPct: 0.4,
    repTarget: 8,
    movementPattern: 'pull',
    isCompound: true,
  },
  {
    name: 'Dumbbell Romanian Deadlift',
    slug: 'dumbbell-romanian-deadlift',
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
    slug: 'hexbar-deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'quads'],
    type: 'weighted',
    weightPct: 0.75,
    repTarget: 4,
  },
  {
    name: 'Hexbar Deadlift Deficit',
    slug: 'hexbar-deadlift-deficit',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes', 'quads'],
    type: 'weighted',
    weightPct: 0.65,
    repTarget: 4,
  },
  {
    name: 'Dumbbell Row',
    slug: 'dumbbell-row',
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
    slug: 'sumo-deadlift',
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
    slug: 'deficit-deadlift',
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
    slug: 'kettlebell-deadlift',
    associatedLift: 'deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'weighted',
    weightPct: 0.2,
    repTarget: 8,
  },
  {
    name: 'Good Mornings',
    slug: 'good-mornings',
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
    slug: 'block-pulls',
    associatedLift: 'deadlift',
    primaryMuscles: ['lower_back', 'upper_back'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'lower_back', contribution: 1.0 },
      { muscle: 'hamstrings', contribution: 0.5 },
      { muscle: 'glutes', contribution: 0.5 },
      { muscle: 'upper_back', contribution: 0.5 },
    ],
    // 2" blocks — near-full ROM, still mild overload. 95% of DL 1RM at 4 reps.
    weightPct: 0.95,
    repTarget: 4,
  },
  {
    name: 'Stiff-Leg Deadlift',
    slug: 'stiff-leg-deadlift',
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
    slug: 'barbell-snatch',
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
    slug: 'dumbbell-snatch',
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
    slug: 'deadhang',
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

  {
    name: 'Barbell Overhead Press',
    slug: 'barbell-overhead-press',
    associatedLift: 'bench',
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
    name: 'Dumbbell Overhead Press',
    slug: 'dumbbell-overhead-press',
    associatedLift: 'bench',
    primaryMuscles: ['shoulders', 'triceps'],
    type: 'weighted',
    muscleContributions: [
      { muscle: 'shoulders', contribution: 1.0 },
      { muscle: 'triceps', contribution: 1.0 },
      { muscle: 'upper_back', contribution: 0.5 },
    ],
    weightPct: 0.25,
    repTarget: 10,
  },

  // ── General — no single-lift affinity ─────────────────────────────────────
  {
    name: 'Chin Up (weighted)',
    slug: 'chin-up-weighted',
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
    slug: 'jump-squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'male' }],
  },
  {
    name: 'Pistol Squat',
    slug: 'pistol-squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'male' }],
  },
  {
    name: 'Box Jump',
    slug: 'box-jump',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'male' }],
  },
  {
    name: 'Sumo Squat',
    slug: 'sumo-squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'female' }],
  },
  {
    name: 'Curtsy Lunge',
    slug: 'curtsy-lunge',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'female' }],
  },
  {
    name: 'Hip Thrust',
    slug: 'hip-thrust',
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
    slug: 'glute-bridge',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'squat', sex: 'female' }],
    complexityTier: 'simple',
  },
  {
    name: 'Nordic Hamstring Curl',
    slug: 'nordic-hamstring-curl',
    associatedLift: null,
    primaryMuscles: ['hamstrings'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'male' }],
    complexityTier: 'simple',
  },
  {
    name: 'Single-Leg RDL',
    slug: 'single-leg-rdl',
    associatedLift: null,
    primaryMuscles: ['hamstrings', 'glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'male' }],
  },
  {
    name: 'Bodyweight Good Morning',
    slug: 'bodyweight-good-morning',
    associatedLift: null,
    primaryMuscles: ['hamstrings', 'lower_back'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'male' }],
    complexityTier: 'simple',
  },
  {
    name: 'Hyperextension',
    slug: 'hyperextension',
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
    slug: 'single-leg-glute-bridge',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'female' }],
    complexityTier: 'simple',
  },
  {
    name: 'Donkey Kick',
    slug: 'donkey-kick',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'female' }],
    complexityTier: 'simple',
  },
  {
    name: 'Glute Kickback',
    slug: 'glute-kickback',
    associatedLift: null,
    primaryMuscles: ['glutes'],
    type: 'bodyweight',
    bodyweightPools: [{ lift: 'deadlift', sex: 'female' }],
    complexityTier: 'simple',
  },
  {
    name: 'Pull-ups',
    slug: 'pull-ups',
    associatedLift: null,
    primaryMuscles: ['upper_back'],
    type: 'bodyweight',
    isCompound: true,
  },
  {
    name: 'Chin-ups',
    slug: 'chin-ups',
    associatedLift: null,
    primaryMuscles: ['upper_back', 'biceps'],
    type: 'bodyweight',
  },
  {
    name: 'Push-ups',
    slug: 'push-ups',
    associatedLift: null,
    primaryMuscles: ['chest'],
    type: 'bodyweight',
  },
  {
    name: 'Dips',
    slug: 'dips',
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
    slug: 'air-squat',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
  },
  {
    name: 'Lunge',
    slug: 'lunge',
    associatedLift: null,
    primaryMuscles: ['quads', 'glutes'],
    type: 'bodyweight',
  },
  {
    // Full-body conditioning movement: squat → plank → push-up → jump. No
    // external load, so it tracks reps only (weight/RPE suppressed by type).
    name: 'Burpees',
    slug: 'burpees',
    associatedLift: null,
    primaryMuscles: ['quads', 'chest'],
    type: 'bodyweight',
    muscleContributions: [
      { muscle: 'quads', contribution: 1.0 },
      { muscle: 'chest', contribution: 0.75 },
      { muscle: 'shoulders', contribution: 0.5 },
      { muscle: 'triceps', contribution: 0.5 },
      { muscle: 'glutes', contribution: 0.5 },
    ],
    repTarget: 12,
    movementPattern: 'squat',
    equipment: 'bodyweight',
    isCompound: true,
    complexityTier: 'moderate',
  },
  // ── Cardio / Core ─────────────────────────────────────────────────────────
  {
    name: 'Row Machine',
    slug: 'row-machine',
    associatedLift: null,
    primaryMuscles: ['upper_back', 'biceps'],
    type: 'timed',
    repTarget: 1,
  },
  {
    name: 'Ski Erg',
    slug: 'ski-erg',
    associatedLift: null,
    primaryMuscles: ['upper_back', 'shoulders', 'triceps'],
    type: 'timed',
    repTarget: 1,
  },
  {
    name: 'Run - Treadmill',
    slug: 'run-treadmill',
    associatedLift: null,
    primaryMuscles: ['quads', 'hamstrings'],
    type: 'timed',
    repTarget: 1,
  },
  {
    name: 'Run - Outside',
    slug: 'run-outside',
    associatedLift: null,
    primaryMuscles: ['quads', 'hamstrings'],
    type: 'timed',
    repTarget: 1,
  },
  {
    name: 'Assault Bike',
    slug: 'assault-bike',
    associatedLift: null,
    primaryMuscles: ['quads', 'hamstrings', 'shoulders'],
    type: 'timed',
    repTarget: 1,
  },
  {
    name: 'Toes to Bar',
    slug: 'toes-to-bar',
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
    slug: 'plank',
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
    slug: 'ab-wheel-rollout',
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
    slug: 'hanging-leg-raise',
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
    slug: 'dead-bug',
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
    slug: 'cable-crunch',
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
    slug: 'pallof-press',
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
    slug: 'bird-dog',
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
    slug: 'ghd-situp',
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
    slug: 'decline-situp',
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
    slug: 'cable-woodchop',
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
    slug: 'dragon-flag',
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
    slug: 'landmine-rotation',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'weighted',
    weightPct: 0.08,
    repTarget: 10,
    movementPattern: 'core',
    equipment: 'barbell',
    complexityTier: 'moderate',
  },
  {
    name: 'Standing Plate Rotation',
    slug: 'standing-plate-rotation',
    associatedLift: null,
    primaryMuscles: ['core'],
    type: 'weighted',
    weightPct: 0.125,
    repTarget: 12,
    movementPattern: 'core',
    equipment: 'barbell',
    complexityTier: 'simple',
  },
];

// ── Fast lookup ───────────────────────────────────────────────────────────────

export const CATALOG_BY_NAME = new Map<string, ExerciseCatalogEntry>(
  EXERCISE_CATALOG.map((e) => [e.name, e])
);

/** Slug-keyed lookup. Slugs are stable across catalog renames, so this is the
 *  preferred map when resolving stored DB references. */
export const CATALOG_BY_SLUG = new Map<string, ExerciseCatalogEntry>(
  EXERCISE_CATALOG.map((e) => [e.slug, e])
);

/** Catalog entry lookup that accepts either a display name OR a slug.
 *  Prefer this in code paths that may receive either (legacy stored names
 *  vs new slug-keyed reads). */
export function getCatalogEntry(
  nameOrSlug: string
): ExerciseCatalogEntry | undefined {
  return CATALOG_BY_SLUG.get(nameOrSlug) ?? CATALOG_BY_NAME.get(nameOrSlug);
}

// ── Slug helpers ──────────────────────────────────────────────────────────────

/** Deterministic kebab-case slug for a user-typed custom exercise name.
 *  Pure: same input always produces the same output. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Title-case a kebab slug for display fallback. Used when a stored slug has
 *  no catalog entry (user custom with deleted pool entry, orphaned set_logs row). */
export function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Resolve a slug to its display name. Catalog wins, then stored display
 *  fallback, then prettify. Use this at the UI boundary for any exercise label. */
export function getDisplayNameForSlug(
  slug: string,
  storedDisplay?: string | null
): string {
  return (
    CATALOG_BY_SLUG.get(slug)?.name ?? storedDisplay ?? prettifySlug(slug)
  );
}

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

/** Timed general-purpose cardio/conditioning exercises (running, rowing, etc.).
 *  No `associatedLift` and not core — purely a UX pool so users can curate
 *  which conditioning options surface in pickers. Never picked by volume
 *  top-up (timed exercises are filtered out before selection). */
export const DEFAULT_CARDIO_POOL: string[] = EXERCISE_CATALOG.filter(
  (e) =>
    e.type === 'timed' &&
    e.associatedLift === null &&
    !e.primaryMuscles.includes('core')
).map((e) => e.name);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Full catalog — use for manual add pickers. */
export function getAllExercises(): ExerciseCatalogEntry[] {
  return EXERCISE_CATALOG;
}

/** Primary muscles (contribution >= 1.0) for an exercise. Empty array if unknown.
 *  Accepts a display name or a slug. */
export function getPrimaryMusclesForExercise(
  nameOrSlug: string
): MuscleGroup[] {
  return getCatalogEntry(nameOrSlug)?.primaryMuscles ?? [];
}

/** Which main lift this exercise is associated with. null if general or unknown. */
export function getLiftForExercise(nameOrSlug: string): Lift | null {
  return getCatalogEntry(nameOrSlug)?.associatedLift ?? null;
}

/** Weight % of associated lift 1RM for JIT load calculation. Default: 0.675. */
export function getWeightPct(nameOrSlug: string): number {
  return getCatalogEntry(nameOrSlug)?.weightPct ?? 0.675;
}

/** Rep target for JIT generation. Returns fallback if not specified in catalog. */
export function getRepTarget(nameOrSlug: string, fallback: number): number {
  return getCatalogEntry(nameOrSlug)?.repTarget ?? fallback;
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
 * Compute auxiliary exercise working weight.
 *
 * Precedence:
 *   1. If `anchorKg` is provided (history-anchored prescription — GH#221),
 *      return it directly. The caller has already computed an anchor that
 *      overrides the formula. The catalog `weightPct` is no longer load-
 *      bearing once the lifter has real history on this exercise.
 *   2. Otherwise, fall back to the formula:
 *      - barbell/machine/cable: weight = oneRmKg × weightPct (linear)
 *      - dumbbell/kettlebell:   weight = weightPct × sqrt(referenceRm × oneRmKg)
 *        At the reference 1RM, output equals the linear formula. Above it,
 *        weight grows slower (stronger lifters get proportionally lighter DBs).
 */
export function computeAuxWeight({
  exercise,
  oneRmKg,
  lift,
  biologicalSex,
  anchorKg,
}: {
  exercise: string;
  oneRmKg: number;
  lift: Lift;
  biologicalSex?: 'female' | 'male';
  /** History-anchored weight (GH#221). When provided, overrides the
   *  formula entirely. Caller is responsible for plate rounding. */
  anchorKg?: number;
}) {
  if (anchorKg != null && anchorKg > 0) return anchorKg;

  const pct = getWeightPct(exercise);
  const entry = getCatalogEntry(exercise);
  const isUnstable = entry
    ? entry.name.startsWith('Dumbbell') || entry.name.startsWith('Kettlebell')
    : exercise.startsWith('Dumbbell') || exercise.startsWith('Kettlebell');

  if (!isUnstable) return oneRmKg * pct;

  const sex = biologicalSex ?? 'male';
  const ref =
    SQRT_REFERENCE_1RM[lift]?.[sex] ?? SQRT_REFERENCE_1RM[lift]?.male ?? 100;
  return pct * Math.sqrt(ref * oneRmKg);
}
