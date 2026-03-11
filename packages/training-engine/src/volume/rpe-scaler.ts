/**
 * Converts a logged RPE value into an effective-set multiplier for MRV counting.
 *
 * Only "hard sets" (within 0-3 RIR, ~RPE 7+) count toward volume landmarks per
 * the RP Strength framework. Sets far from failure contribute progressively less.
 *
 * Scale (pending refinement via Refalo et al. 2022 and RP proximity-to-failure research
 * — see engine-026 spec):
 *   < 6   → 0.0  (too easy, not a hard set)
 *   6     → 0.25
 *   7     → 0.5
 *   8     → 0.75
 *   9–10  → 1.0
 *   unrecorded → 1.0 (conservative: assume hard)
 */
export function rpeSetMultiplier(rpeActual: number | undefined): number {
  if (rpeActual === undefined) return 1.0;
  if (rpeActual < 6) return 0.0;
  if (rpeActual < 7) return 0.25;
  if (rpeActual < 8) return 0.5;
  if (rpeActual < 9) return 0.75;
  return 1.0;
}
