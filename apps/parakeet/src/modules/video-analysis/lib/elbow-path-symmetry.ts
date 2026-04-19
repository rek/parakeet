// @spec docs/features/video-analysis/spec-metrics.md
import { LANDMARK, type PoseFrame } from './pose-types';

const VIS_THRESHOLD = 0.5;

export interface ElbowPathSymmetry {
  /**
   * Left elbow offset divided by right elbow offset. 1.0 = perfectly
   * symmetric. < 0.8 or > 1.25 indicates one elbow flares further from
   * the torso than the other across the rep (single-side flare, which
   * single-frame flare sampling misses because it averages).
   */
  ratio: number;
  framesUsed: number;
}

/**
 * Average horizontal distance from each elbow to the shoulder midline,
 * returned as a left/right ratio.
 *
 * "Midline" is the shoulder midpoint's x-coordinate. "Offset" is
 * `|elbow.x − midline|`. Averaging over the window collapses per-frame
 * pose noise; the ratio is the load-bearing number for asymmetric-flare
 * detection.
 *
 * Meaningful only from the front. Returns `ratio: 1` + `framesUsed: 0`
 * when no usable frames — caller should treat that as "no signal, skip".
 */
export function computeElbowPathSymmetry({
  frames,
  startFrame,
  endFrame,
}: {
  frames: PoseFrame[];
  startFrame: number;
  endFrame: number;
}): ElbowPathSymmetry {
  let leftSum = 0;
  let rightSum = 0;
  let framesUsed = 0;

  const lo = Math.max(0, startFrame);
  const hi = Math.min(frames.length - 1, endFrame);

  for (let i = lo; i <= hi; i++) {
    const frame = frames[i];
    const ls = frame[LANDMARK.LEFT_SHOULDER];
    const rs = frame[LANDMARK.RIGHT_SHOULDER];
    const le = frame[LANDMARK.LEFT_ELBOW];
    const re = frame[LANDMARK.RIGHT_ELBOW];

    if (
      ls.visibility < VIS_THRESHOLD ||
      rs.visibility < VIS_THRESHOLD ||
      le.visibility < VIS_THRESHOLD ||
      re.visibility < VIS_THRESHOLD
    ) {
      continue;
    }

    const midlineX = (ls.x + rs.x) / 2;
    leftSum += Math.abs(le.x - midlineX);
    rightSum += Math.abs(re.x - midlineX);
    framesUsed++;
  }

  if (framesUsed === 0 || rightSum < 1e-6) {
    return { ratio: 1, framesUsed };
  }

  return {
    ratio: leftSum / rightSum,
    framesUsed,
  };
}
