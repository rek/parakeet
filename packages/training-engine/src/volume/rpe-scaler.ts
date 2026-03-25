/**
 * Converts a logged RPE value into an effective-set multiplier for MRV counting.
 *
 * Only "hard sets" (within 0-3 RIR, ~RPE 7+) count fully toward volume landmarks.
 * Sets far from failure contribute progressively less.
 *
 * Piecewise-linear curve with anchor points based on Refalo et al. 2023/2024
 * meta-regressions: the drop-off from RPE 10 to RPE 8 is small, but RPE 8
 * to RPE 6 is large. For strength specifically, proximity to failure has
 * negligible relationship with strength gains (Robinson/Refalo 2024), so
 * moderate-effort sets are more valuable than a pure step function suggests.
 *
 * Anchor points (interpolated linearly between):
 *   < 6     → 0.0   (too easy, not a hard set)
 *   6.0     → 0.15
 *   6.5     → 0.30  (conservative — still ~3.5 RIR)
 *   7.0     → 0.65
 *   8.0     → 0.85
 *   9.0–10  → 1.0
 *   unrecorded → 1.0 (conservative: assume hard)
 *
 * Example half-point values: 6.5 → 0.30, 7.5 → 0.75, 8.5 → 0.925
 *
 * See docs/domain/muscle-mapping.md for research basis.
 */

// Anchor points: [rpe, multiplier] — must be sorted by rpe ascending
const ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [6.0, 0.15],
  [6.5, 0.30],
  [7.0, 0.65],
  [8.0, 0.85],
  [9.0, 1.0],
];

export function rpeSetMultiplier(rpeActual: number | undefined): number {
  if (rpeActual === undefined) return 1.0;
  if (rpeActual < 6) return 0.0;
  if (rpeActual >= 9) return 1.0;

  // Find the two anchor points that bracket rpeActual and interpolate
  for (let i = 1; i < ANCHORS.length; i++) {
    const [upperRpe, upperMult] = ANCHORS[i];
    if (rpeActual <= upperRpe) {
      const [lowerRpe, lowerMult] = ANCHORS[i - 1];
      const t = (rpeActual - lowerRpe) / (upperRpe - lowerRpe);
      return lowerMult + t * (upperMult - lowerMult);
    }
  }

  return 1.0;
}
