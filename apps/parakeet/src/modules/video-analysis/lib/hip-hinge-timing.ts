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

  // Count frames where hips extend faster than knees in the first third.
  // A single noisy frame shouldn't trigger — only flag when hips dominate
  // the majority of the initial pull phase.
  const firstThirdEnd = Math.min(
    startFrame + Math.max(3, Math.ceil(repLength / 3)),
    endFrame,
  );
  let hipDominantFrames = 0;
  let totalComparisons = 0;

  for (let i = startFrame; i < firstThirdEnd && i + 1 < frames.length; i++) {
    const hipDelta = computeHipAngle({ frame: frames[i + 1] }) - computeHipAngle({ frame: frames[i] });
    const kneeDelta = computeKneeAngle({ frame: frames[i + 1] }) - computeKneeAngle({ frame: frames[i] });
    totalComparisons++;
    if (hipDelta > kneeDelta) hipDominantFrames++;
  }

  if (totalComparisons === 0) {
    return { crossoverPct: 50, isEarlyHipShoot: false };
  }

  // Hip shoot = hips faster than knees on >60% of initial frames
  const hipDominantRatio = hipDominantFrames / totalComparisons;
  const crossoverPct = Math.round((1 - hipDominantRatio) * 100);
  const isEarlyHipShoot = hipDominantRatio > 0.6;

  return { crossoverPct, isEarlyHipShoot };
}
