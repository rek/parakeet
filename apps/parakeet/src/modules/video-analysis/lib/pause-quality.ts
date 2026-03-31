import type { BarPathPoint } from '@parakeet/shared-types';

import { CM_PER_UNIT } from './pose-types';

/**
 * Velocity below which the bar is considered stationary (cm/s).
 * At this threshold a properly paused rep is clearly distinguished from
 * a slow touch-and-go — chosen to match IPF pause judging tolerance.
 */
const PAUSE_VELOCITY_THRESHOLD = 5;

/**
 * Assess pause quality at the bottom of a bench press rep.
 *
 * Finds the bottom frame (max Y in bar path), measures how long the bar
 * stays near the bottom (velocity < threshold), and checks if the bar
 * continues sinking after the initial "bottom" (sinking vs settled).
 */
export function assessPauseQuality({
  repPath,
  fps,
}: {
  repPath: BarPathPoint[];
  fps: number;
}) {
  if (repPath.length < 3) {
    return { pauseDurationSec: 0, isSinking: false };
  }

  // Find the bottom frame index (max Y = lowest bar position in MediaPipe)
  let bottomIdx = 0;
  let bottomY = repPath[0].y;
  for (let i = 1; i < repPath.length; i++) {
    if (repPath[i].y > bottomY) {
      bottomY = repPath[i].y;
      bottomIdx = i;
    }
  }

  const dt = 1 / fps;

  // Walk backward from bottom while absolute Y velocity is below threshold
  let pauseStart = bottomIdx;
  while (pauseStart > 0) {
    const dy = Math.abs(repPath[pauseStart].y - repPath[pauseStart - 1].y) * CM_PER_UNIT;
    const velocity = dy / dt;
    if (velocity >= PAUSE_VELOCITY_THRESHOLD) break;
    pauseStart--;
  }

  // Walk forward from bottom while absolute Y velocity is below threshold
  let pauseEnd = bottomIdx;
  while (pauseEnd < repPath.length - 1) {
    const dy = Math.abs(repPath[pauseEnd + 1].y - repPath[pauseEnd].y) * CM_PER_UNIT;
    const velocity = dy / dt;
    if (velocity >= PAUSE_VELOCITY_THRESHOLD) break;
    pauseEnd++;
  }

  const pauseFrameCount = pauseEnd - pauseStart;
  const pauseDurationSec = pauseFrameCount / fps;

  // Sinking: does the bar continue descending 2 frames after the low-velocity zone starts?
  // pauseStart is the entry to the pause window; if Y keeps rising past that point the
  // lifter has not truly settled (chest/arch continuing to compress under the bar).
  const isSinking =
    pauseStart + 2 < repPath.length && repPath[pauseStart + 2].y > repPath[pauseStart].y;

  return { pauseDurationSec, isSinking };
}
