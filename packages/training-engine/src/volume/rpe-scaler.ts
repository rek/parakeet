/**
 * Converts a logged RPE value into an effective-set multiplier for MRV counting.
 *
 * Only "hard sets" (within 0-3 RIR, ~RPE 7+) count fully toward volume landmarks.
 * Sets far from failure contribute progressively less.
 *
 * Nonlinear curve based on Refalo et al. 2023/2024 meta-regressions:
 * the drop-off from RPE 10 to RPE 8 is small, but RPE 8 to RPE 6 is large.
 * For strength specifically, proximity to failure has negligible relationship
 * with strength gains (Robinson/Refalo 2024), so moderate-effort sets are
 * more valuable than a linear curve suggests.
 *
 * See docs/domain/muscle-mapping.md for research basis and known issues.
 *
 *   < 6   → 0.0  (too easy, not a hard set)
 *   6     → 0.15
 *   7     → 0.65
 *   8     → 0.85
 *   9–10  → 1.0
 *   unrecorded → 1.0 (conservative: assume hard)
 */
export function rpeSetMultiplier(rpeActual: number | undefined): number {
  if (rpeActual === undefined) return 1.0;
  if (rpeActual < 6) return 0.0;
  if (rpeActual < 7) return 0.15;
  if (rpeActual < 8) return 0.65;
  if (rpeActual < 9) return 0.85;
  return 1.0;
}
