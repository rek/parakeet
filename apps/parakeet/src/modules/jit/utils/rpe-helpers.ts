// @spec docs/features/jit-pipeline/spec-generator.md
/**
 * Derive a human-readable RPE adjustment note.
 * Returns empty string when no adjustment is expected.
 */
export function computeRpeAdjustmentNote(
  rpeTarget: number | null | undefined,
  lastSessionRpe: number | null | undefined
): string {
  if (rpeTarget == null || lastSessionRpe == null) return '';
  if (lastSessionRpe - rpeTarget >= 1.0) return ' — load may adjust down';
  if (rpeTarget - lastSessionRpe >= 1.5) return ' — load may adjust up';
  return '';
}
