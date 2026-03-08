import { Lift } from '@parakeet/shared-types';
import { MuscleContribution } from '../types';
import { getPrimaryMusclesForExercise } from '../auxiliary/exercise-catalog';

// Primary lift → muscle contributions
// 1.0 = primary mover, 0.5 = significant secondary
// Calibrated to RP Strength volume landmark values (see docs/design/volume-mrv-methodology.md)
const LIFT_MUSCLES: Record<string, MuscleContribution[]> = {
  squat: [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'glutes', contribution: 1.0 },
    { muscle: 'hamstrings', contribution: 0.5 },
    { muscle: 'lower_back', contribution: 0.5 },
  ],
  bench: [
    { muscle: 'chest', contribution: 1.0 },
    { muscle: 'triceps', contribution: 0.5 },
    { muscle: 'shoulders', contribution: 0.5 },
  ],
  deadlift: [
    { muscle: 'hamstrings', contribution: 1.0 },
    { muscle: 'glutes', contribution: 1.0 },
    { muscle: 'lower_back', contribution: 1.0 },
    { muscle: 'upper_back', contribution: 0.5 },
  ],
};

// Per-exercise muscle contributions with full 1.0/0.5 detail.
// Catalog exercises not listed here fall back to catalog primaryMuscles (all at 1.0).
//
// NOTE: Contribution weights here use a simple 1.0 / 0.5 model consistent with
// RP Strength's set-counting framework. EMG studies could provide finer-grained
// values (e.g. 0.75, 0.25) for exercises where secondary muscle involvement
// differs significantly from the typical compound pattern. Tracked in
// docs/design/volume-mrv-methodology.md for future refinement.
const EXERCISE_MUSCLES: Record<string, MuscleContribution[]> = {
  // ── Squat auxiliaries ────────────────────────────────────────────────────
  'Pause Squat': [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'glutes', contribution: 1.0 },
    { muscle: 'hamstrings', contribution: 0.5 },
    { muscle: 'lower_back', contribution: 0.5 },
  ],
  'Box Squat': [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'glutes', contribution: 1.0 },
    { muscle: 'hamstrings', contribution: 0.5 },
    { muscle: 'lower_back', contribution: 0.5 },
  ],
  'Bulgarian Split Squat': [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'glutes', contribution: 1.0 },
    { muscle: 'hamstrings', contribution: 0.5 },
  ],
  'Leg Press': [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'glutes', contribution: 0.5 },
  ],
  'High-Bar Squat': [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'glutes', contribution: 1.0 },
    { muscle: 'hamstrings', contribution: 0.5 },
    { muscle: 'lower_back', contribution: 0.5 },
  ],
  'Hack Squat': [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'glutes', contribution: 0.5 },
  ],
  'Front Squat': [
    { muscle: 'quads', contribution: 1.0 },
    { muscle: 'upper_back', contribution: 0.5 },
    { muscle: 'lower_back', contribution: 0.5 },
  ],
  // ── Bench auxiliaries ────────────────────────────────────────────────────
  'Close-Grip Bench': [
    { muscle: 'triceps', contribution: 1.0 },
    { muscle: 'chest', contribution: 0.5 },
    { muscle: 'shoulders', contribution: 0.5 },
  ],
  'Incline DB Press': [
    { muscle: 'chest', contribution: 1.0 },
    { muscle: 'shoulders', contribution: 1.0 },
    { muscle: 'triceps', contribution: 0.5 },
  ],
  Dips: [
    { muscle: 'chest', contribution: 1.0 },
    { muscle: 'triceps', contribution: 1.0 },
    { muscle: 'shoulders', contribution: 0.5 },
  ],
  'Floor Press': [
    { muscle: 'triceps', contribution: 1.0 },
    { muscle: 'chest', contribution: 1.0 },
  ],
  'Overhead Press': [
    { muscle: 'shoulders', contribution: 1.0 },
    { muscle: 'triceps', contribution: 1.0 },
    { muscle: 'upper_back', contribution: 0.5 },
  ],
  'JM Press': [
    { muscle: 'triceps', contribution: 1.0 },
    { muscle: 'chest', contribution: 0.5 },
  ],
  'Board Press': [
    { muscle: 'chest', contribution: 1.0 },
    { muscle: 'triceps', contribution: 0.5 },
  ],
  'Spoto Press': [
    { muscle: 'chest', contribution: 1.0 },
    { muscle: 'triceps', contribution: 0.5 },
  ],
  '1 Inch Pause Bench': [
    { muscle: 'chest', contribution: 1.0 },
    { muscle: 'triceps', contribution: 0.5 },
    { muscle: 'shoulders', contribution: 0.5 },
  ],
  'Barbell Curl': [{ muscle: 'biceps', contribution: 1.0 }],
  'Dumbbell Curl': [{ muscle: 'biceps', contribution: 1.0 }],
  'Cable Curl': [{ muscle: 'biceps', contribution: 1.0 }],
  'EZ-Bar Curl': [{ muscle: 'biceps', contribution: 1.0 }],
  // ── Deadlift auxiliaries ─────────────────────────────────────────────────
  'Romanian DL': [
    { muscle: 'hamstrings', contribution: 1.0 },
    { muscle: 'glutes', contribution: 1.0 },
    { muscle: 'lower_back', contribution: 0.5 },
  ],
  'Block Pulls': [
    { muscle: 'lower_back', contribution: 1.0 },
    { muscle: 'hamstrings', contribution: 0.5 },
    { muscle: 'glutes', contribution: 0.5 },
    { muscle: 'upper_back', contribution: 0.5 },
  ],
  'Deficit DL': [
    { muscle: 'hamstrings', contribution: 1.0 },
    { muscle: 'glutes', contribution: 1.0 },
    { muscle: 'lower_back', contribution: 1.0 },
  ],
  'Good Mornings': [
    { muscle: 'hamstrings', contribution: 1.0 },
    { muscle: 'lower_back', contribution: 1.0 },
    { muscle: 'glutes', contribution: 0.5 },
  ],
  'Stiff-Leg DL': [
    { muscle: 'hamstrings', contribution: 1.0 },
    { muscle: 'glutes', contribution: 0.5 },
    { muscle: 'lower_back', contribution: 0.5 },
  ],
  'Sumo DL': [
    { muscle: 'glutes', contribution: 1.0 },
    { muscle: 'quads', contribution: 0.5 },
    { muscle: 'hamstrings', contribution: 0.5 },
  ],
  'Rack Pulls': [
    { muscle: 'upper_back', contribution: 1.0 },
    { muscle: 'lower_back', contribution: 1.0 },
  ],
  Hyperextensions: [
    { muscle: 'lower_back', contribution: 1.0 },
    { muscle: 'glutes', contribution: 0.5 },
    { muscle: 'hamstrings', contribution: 0.5 },
  ],
};

export function getMusclesForLift(
  lift: Lift,
  exercise?: string
): MuscleContribution[] {
  if (exercise) {
    const mapped = EXERCISE_MUSCLES[exercise];
    if (mapped) return mapped;
  }
  return LIFT_MUSCLES[lift] ?? [];
}

export function getMusclesForExercise(
  exerciseName: string
): MuscleContribution[] {
  // Prefer the detailed EXERCISE_MUSCLES map (has 1.0/0.5 breakdown).
  if (EXERCISE_MUSCLES[exerciseName]) return EXERCISE_MUSCLES[exerciseName];
  // Fall back to catalog primary muscles (all at 1.0 contribution).
  const catalogMuscles = getPrimaryMusclesForExercise(exerciseName);
  if (catalogMuscles.length > 0) {
    return catalogMuscles.map((muscle) => ({ muscle, contribution: 1.0 }));
  }
  return [];
}
