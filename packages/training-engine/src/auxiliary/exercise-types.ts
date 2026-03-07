export type ExerciseType = 'weighted' | 'bodyweight' | 'timed'

/**
 * Explicit type overrides for exercises that are not loaded barbell/dumbbell movements.
 * Anything not in this map defaults to 'weighted'.
 */
export const EXERCISE_TYPES: Record<string, ExerciseType> = {
  // ── Timed / conditioning ────────────────────────────────────────────────────
  'Assault Bike 5 mins': 'timed',
  'Plank': 'timed',
  'Hanging': 'timed',
  '50kg Breifcase Carry': 'timed',

  // ── Bodyweight — squat pool ─────────────────────────────────────────────────
  'Plate Twist': 'bodyweight',

  // ── Bodyweight — BODYWEIGHT_POOLS (no-equipment disruption) ─────────────────
  'Jump Squat': 'bodyweight',
  'Pistol Squat': 'bodyweight',
  'Box Jump': 'bodyweight',
  'Sumo Squat': 'bodyweight',
  'Curtsy Lunge': 'bodyweight',
  'Hip Thrust': 'bodyweight',
  'Glute Bridge': 'bodyweight',
  'Decline Push-ups': 'bodyweight',
  'Diamond Push-ups': 'bodyweight',
  'Archer Push-ups': 'bodyweight',
  'Pike Push-ups': 'bodyweight',
  'Standard Push-ups': 'bodyweight',
  'Wide Push-ups': 'bodyweight',
  'Close-Grip Push-ups': 'bodyweight',
  'Nordic Hamstring Curl': 'bodyweight',
  'Single-Leg RDL': 'bodyweight',
  'Bodyweight Good Morning': 'bodyweight',
  'Hyperextension': 'bodyweight',
  'Single-Leg Glute Bridge': 'bodyweight',
  'Donkey Kick': 'bodyweight',
  'Glute Kickback': 'bodyweight',

  // ── Common user-added bodyweight exercises ───────────────────────────────────
  'Pull-ups': 'bodyweight',
  'Pull Ups': 'bodyweight',
  'Pullups': 'bodyweight',
  'Chin-ups': 'bodyweight',
  'Chin Ups': 'bodyweight',
  'Push-ups': 'bodyweight',
  'Push Ups': 'bodyweight',
  'Dips': 'bodyweight',
  'Bodyweight Squat': 'bodyweight',
  'Air Squat': 'bodyweight',
  'Lunge': 'bodyweight',
  'Step Up': 'bodyweight',
}

/** Returns the exercise type; defaults to 'weighted' for unknown exercises. */
export function getExerciseType(exerciseName: string): ExerciseType {
  return EXERCISE_TYPES[exerciseName] ?? 'weighted'
}
