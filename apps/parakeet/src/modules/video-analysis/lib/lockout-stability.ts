/**
 * Compute lockout stability as the coefficient of variation of hip angle
 * during the last 10% of rep frames.
 *
 * Low CV = stable lockout. High CV = wobbling or not fully locked out.
 * Applicable to all three lifts.
 */

import { computeHipAngle } from './angle-calculator';
import type { PoseFrame } from './pose-types';

export function computeLockoutStability({
  frames,
  startFrame,
  endFrame,
}: {
  frames: PoseFrame[];
  startFrame: number;
  endFrame: number;
}) {
  const lockoutStart =
    endFrame - Math.max(1, Math.floor((endFrame - startFrame) * 0.1));

  const angles: number[] = [];
  for (let i = lockoutStart; i <= endFrame; i++) {
    angles.push(computeHipAngle({ frame: frames[i] }));
  }

  // Fewer than 2 data points cannot produce a meaningful spread
  if (angles.length < 2) {
    return 0;
  }

  const mean = angles.reduce((sum, a) => sum + a, 0) / angles.length;

  // Guard against a mean of zero to avoid division by zero
  if (mean === 0) {
    return 0;
  }

  const variance =
    angles.reduce((sum, a) => sum + (a - mean) ** 2, 0) / angles.length;
  const stdDev = Math.sqrt(variance);

  return (stdDev / mean) * 100;
}
