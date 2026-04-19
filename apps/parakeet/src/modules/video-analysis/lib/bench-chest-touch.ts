// @spec docs/features/video-analysis/spec-metrics.md
import { LANDMARK, type PoseFrame } from './pose-types';
import { MIN_SAGITTAL_CONFIDENCE } from './view-confidence';

const VIS_THRESHOLD = 0.5;

/**
 * Fraction of the shoulder→hip segment used to approximate chest Y on
 * side view. One-fifth of the way from shoulders toward hips sits at
 * roughly mid-sternum — close enough for a chest-touch gate without a
 * dedicated sternum landmark. Backlog #26 design direction.
 */
const SIDE_VIEW_CHEST_FRACTION = 0.2;

export interface ChestTouchGap {
  /**
   * Closest vertical approach above the chest reference across the rep,
   * in units of torso length. Signed:
   *   gap > 0  → bar never reached chest (partial rep).
   *   gap = 0  → bar touched the reference line.
   *   gap < 0  → bar passed the reference line (normal competition touch).
   *
   * Callers gate `no_chest_touch` / `shallow_bench` on `gap > threshold`.
   */
  gap: number;
  /** Number of frames that contributed (all required landmarks visible). */
  framesUsed: number;
}

/**
 * Compute per-rep chest-touch gap for a bench press.
 *
 * Front view (`sagittalConfidence < MIN_SAGITTAL_CONFIDENCE`): the chest
 * reference line is the shoulder Y, and the bar Y is the wrist midpoint.
 * At chest touch the bar sits level with or below the shoulder line.
 *
 * Side view: chest Y is approximated as
 * `shoulderY + SIDE_VIEW_CHEST_FRACTION * (hipY − shoulderY)`.
 *
 * Per frame we compute `(refY − wristMidY) / torsoLen` — positive when
 * the bar is above the reference, negative when below. The per-rep
 * `gap` is the MIN of that signal across the window (the deepest point
 * of the rep). Scale-invariant by torso length.
 *
 * Returns `{ gap: 0, framesUsed: 0 }` when no frame had the required
 * landmarks — caller treats zero framesUsed as "no signal".
 */
export function computeChestTouchGap({
  frames,
  startFrame,
  endFrame,
  sagittalConfidence,
}: {
  frames: PoseFrame[];
  startFrame: number;
  endFrame: number;
  sagittalConfidence: number;
}): ChestTouchGap {
  const isFrontView = sagittalConfidence < MIN_SAGITTAL_CONFIDENCE;

  const lo = Math.max(0, startFrame);
  const hi = Math.min(frames.length - 1, endFrame);

  let minNormalized = Infinity;
  let framesUsed = 0;

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
      rs.visibility < VIS_THRESHOLD
    ) {
      continue;
    }
    // Hips required on side view (chest approximation) and for torso length.
    if (lh.visibility < VIS_THRESHOLD || rh.visibility < VIS_THRESHOLD) {
      continue;
    }

    const wristMidY = (lw.y + rw.y) / 2;
    const shoulderMidY = (ls.y + rs.y) / 2;
    const hipMidY = (lh.y + rh.y) / 2;

    const torsoLen = Math.abs(hipMidY - shoulderMidY);
    if (torsoLen < 0.01) continue;

    const refY = isFrontView
      ? shoulderMidY
      : shoulderMidY + SIDE_VIEW_CHEST_FRACTION * (hipMidY - shoulderMidY);

    const normalized = (refY - wristMidY) / torsoLen;
    if (normalized < minNormalized) minNormalized = normalized;
    framesUsed++;
  }

  if (framesUsed === 0) {
    return { gap: 0, framesUsed: 0 };
  }

  return { gap: minNormalized, framesUsed };
}
