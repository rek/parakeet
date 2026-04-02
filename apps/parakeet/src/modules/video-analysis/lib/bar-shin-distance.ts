/**
 * Compute average bar-to-shin distance during the first third of a deadlift pull.
 *
 * Uses the horizontal distance between wrist midpoint and knee midpoint
 * as a proxy for bar-shin proximity. Should be near zero for conventional,
 * slightly positive for sumo.
 */

import { CM_PER_UNIT, LANDMARK, type PoseFrame } from './pose-types';

export function computeBarToShinDistance({
  frames,
  startFrame,
  endFrame,
}: {
  frames: PoseFrame[];
  startFrame: number;
  endFrame: number;
}) {
  const thirdEnd = startFrame + Math.floor((endFrame - startFrame) / 3);

  // Need at least 2 frames to produce a meaningful average
  if (thirdEnd - startFrame < 1) {
    return 0;
  }

  let total = 0;
  let count = 0;

  for (let i = startFrame; i <= thirdEnd; i++) {
    const frame = frames[i];
    const wristMidX =
      (frame[LANDMARK.LEFT_WRIST].x + frame[LANDMARK.RIGHT_WRIST].x) / 2;
    const kneeMidX =
      (frame[LANDMARK.LEFT_KNEE].x + frame[LANDMARK.RIGHT_KNEE].x) / 2;
    total += (wristMidX - kneeMidX) * CM_PER_UNIT;
    count++;
  }

  return count > 0 ? total / count : 0;
}
