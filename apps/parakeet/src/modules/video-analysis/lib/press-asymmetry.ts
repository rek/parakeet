// @spec docs/features/video-analysis/spec-metrics.md
import { LANDMARK, type PoseFrame } from './pose-types';

const VIS_THRESHOLD = 0.5;

export interface PressAsymmetry {
  /**
   * Peak `|leftWristY − rightWristY|` across the window, normalised by
   * torso length. 0 = perfectly level; 0.1 ≈ one hand a tenth of a torso
   * below the other at its worst.
   */
  ratio: number;
  framesUsed: number;
}

/**
 * Compute the worst-case wrist-height asymmetry across a bench concentric.
 *
 * Weak-side pressing shows up as one wrist travelling slower than the
 * other: the peak vertical delta between the wrists during the press is
 * a direct witness. Normalising by torso length keeps the metric
 * scale-invariant (camera distance and lifter height drop out).
 *
 * Meaningful only from the front (`sagittalConfidence < 0.5`). From the
 * side, L/R wrists project to essentially the same image point.
 */
export function computePressAsymmetry({
  frames,
  startFrame,
  endFrame,
}: {
  frames: PoseFrame[];
  startFrame: number;
  endFrame: number;
}): PressAsymmetry {
  let maxRatio = 0;
  let framesUsed = 0;

  const lo = Math.max(0, startFrame);
  const hi = Math.min(frames.length - 1, endFrame);

  for (let i = lo; i <= hi; i++) {
    const frame = frames[i];
    const lw = frame[LANDMARK.LEFT_WRIST];
    const rw = frame[LANDMARK.RIGHT_WRIST];
    const ls = frame[LANDMARK.LEFT_SHOULDER];
    const rs = frame[LANDMARK.RIGHT_SHOULDER];
    const lh = frame[LANDMARK.LEFT_HIP];
    const rh = frame[LANDMARK.RIGHT_HIP];

    if (
      lw.visibility < VIS_THRESHOLD ||
      rw.visibility < VIS_THRESHOLD ||
      ls.visibility < VIS_THRESHOLD ||
      rs.visibility < VIS_THRESHOLD ||
      lh.visibility < VIS_THRESHOLD ||
      rh.visibility < VIS_THRESHOLD
    ) {
      continue;
    }

    const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const hipMid = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    const torsoLen = Math.hypot(
      shoulderMid.x - hipMid.x,
      shoulderMid.y - hipMid.y
    );
    if (torsoLen < 0.01) continue;

    const absDeltaY = Math.abs(lw.y - rw.y);
    const ratio = absDeltaY / torsoLen;
    if (ratio > maxRatio) maxRatio = ratio;
    framesUsed++;
  }

  return { ratio: maxRatio, framesUsed };
}
