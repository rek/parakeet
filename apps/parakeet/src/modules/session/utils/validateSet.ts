// @spec docs/features/session/spec-set-persistence.md
/**
 * Validates and normalizes a set for session completion.
 *
 * Throws on invalid data. Returns the set with is_completed coerced to boolean.
 */
export function validateSet<
  T extends {
    set_number: number;
    weight_grams: number;
    reps_completed: number;
    rpe_actual?: number;
    is_completed: boolean;
  },
>(set: T, label = 'set'): T & { is_completed: boolean } {
  if (!Number.isInteger(set.set_number) || set.set_number <= 0) {
    throw new Error(`Invalid ${label} number`);
  }
  if (!Number.isFinite(set.weight_grams) || set.weight_grams < 0) {
    throw new Error(`Invalid ${label} weight`);
  }
  if (!Number.isInteger(set.reps_completed) || set.reps_completed < 0) {
    throw new Error(`Invalid ${label} reps completed`);
  }
  if (
    set.rpe_actual !== undefined &&
    (!Number.isFinite(set.rpe_actual) ||
      set.rpe_actual < 1 ||
      set.rpe_actual > 10)
  ) {
    throw new Error(`Invalid ${label} RPE value`);
  }
  return { ...set, is_completed: set.is_completed === true };
}
