/**
 * Analyze hip hinge timing during a deadlift concentric phase.
 *
 * Compares knee extension velocity vs hip extension velocity to detect
 * "hips shooting up" — when hips extend faster than knees early in the pull,
 * converting the lift into a stiff-leg deadlift.
 */

import { computeHipAngle, computeKneeAngle } from './angle-calculator';
import type { PoseFrame } from './pose-types';

export function analyzeHipHingeTiming({
  frames,
  startFrame,
  endFrame,
  fps,
}: {
  frames: PoseFrame[];
  startFrame: number;
  endFrame: number;
  fps: number;
}) {
  const repLength = endFrame - startFrame;

  // Insufficient data: return neutral defaults
  if (repLength < 3) {
    return { crossoverPct: 50, isEarlyHipShoot: false };
  }

  // Scan consecutive frame pairs across the concentric phase
  for (let i = startFrame; i < endFrame; i++) {
    const hipVelocity = (computeHipAngle({ frame: frames[i + 1] }) - computeHipAngle({ frame: frames[i] })) * fps;
    const kneeVelocity = (computeKneeAngle({ frame: frames[i + 1] }) - computeKneeAngle({ frame: frames[i] })) * fps;

    if (hipVelocity > kneeVelocity) {
      const crossoverPct = ((i - startFrame) / repLength) * 100;
      const isEarlyHipShoot = crossoverPct < 30;
      return { crossoverPct, isEarlyHipShoot };
    }
  }

  // Knee velocity never fell behind hip velocity — clean mechanics
  return { crossoverPct: 100, isEarlyHipShoot: false };
}
