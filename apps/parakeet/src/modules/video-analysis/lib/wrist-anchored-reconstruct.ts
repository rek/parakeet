// @spec docs/features/video-analysis/spec-pipeline.md
import { LANDMARK, type PoseFrame, type PoseLandmark } from './pose-types';

/** Mirror of the per-landmark gate used across the lib (rep-detector, metrics). */
const VIS_THRESHOLD = 0.5;

/**
 * Confidence multiplier applied to reconstructed landmarks. Keeps
 * downstream filters from treating a reconstructed frame with the same
 * trust as a freshly-detected one, but we floor the result at
 * `VIS_THRESHOLD` for landmarks that were already above threshold in
 * the anchor — otherwise `0.6 * 0.7 = 0.42` silently trips per-landmark
 * gates even though the anchor value is perfectly usable.
 */
const RECONSTRUCTED_VISIBILITY = 0.7;

function isEmpty(f: PoseFrame) {
  return f[0].visibility === 0 && f[0].x === 0 && f[0].y === 0;
}

/**
 * Find the confident frame nearest `rejectedIndex`. Ties break backward
 * — if frames at `i-1` and `i+1` are both confident, the prior frame
 * wins. Nearest-by-distance matters because a pure backward search biases
 * the held torso toward the previous rep phase; if the rejection lands
 * mid-concentric, the forward frame is usually a better anchor.
 */
function findAnchorFrame(
  frames: PoseFrame[],
  rejectedIndex: number
): PoseFrame | null {
  for (let offset = 1; offset < frames.length; offset++) {
    const before = rejectedIndex - offset;
    if (before >= 0 && !isEmpty(frames[before])) return frames[before];
    const after = rejectedIndex + offset;
    if (after < frames.length && !isEmpty(frames[after])) return frames[after];
  }
  return null;
}

function scaleVisibility(original: number): number {
  const scaled = original * RECONSTRUCTED_VISIBILITY;
  return original >= VIS_THRESHOLD ? Math.max(VIS_THRESHOLD, scaled) : scaled;
}

function midpoint(
  a: PoseLandmark,
  b: PoseLandmark,
  visibility: number
): PoseLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.max(VIS_THRESHOLD, visibility),
  };
}

/**
 * Rebuild a rejected bench frame from a confident anchor plus the
 * rejected frame's still-visible wrists.
 *
 * The physics of bench: the lifter is supine and still; only the arms
 * (and the bar they hold) move. So a rigid-arm reconstruction stays
 * surprisingly faithful even when the trunk / face pose is lost:
 *
 *   - Wrists: take the rejected frame's values verbatim (they were never
 *     in question — the bar stays visible even when the face doesn't).
 *   - Elbows: midpoint of shoulder → wrist. Crude rigid-arm bend but
 *     strictly better than the drifting MediaPipe estimate.
 *   - Shoulders / hips / knees / ankles / head: hold at anchor position.
 *
 * Visibility is scaled down on every landmark that was reconstructed
 * rather than observed (`RECONSTRUCTED_VISIBILITY`), so the plausibility
 * filter and downstream confidence-weighted metrics see the synthesis
 * honestly.
 *
 * Returns null if the rejected frame's wrists are not usable (in which
 * case the caller should fall back to empty-frame interpolation) or if
 * the anchor frame lacks visible shoulders (needed for elbow placement).
 */
export function reconstructBenchFrame({
  rejectedFrame,
  anchorFrame,
}: {
  rejectedFrame: PoseFrame;
  anchorFrame: PoseFrame;
}): PoseFrame | null {
  const lw = rejectedFrame[LANDMARK.LEFT_WRIST];
  const rw = rejectedFrame[LANDMARK.RIGHT_WRIST];
  if (lw.visibility < VIS_THRESHOLD || rw.visibility < VIS_THRESHOLD) {
    return null;
  }
  const ls = anchorFrame[LANDMARK.LEFT_SHOULDER];
  const rs = anchorFrame[LANDMARK.RIGHT_SHOULDER];
  if (ls.visibility < VIS_THRESHOLD || rs.visibility < VIS_THRESHOLD) {
    return null;
  }

  return anchorFrame.map((lm, i) => {
    if (i === LANDMARK.LEFT_WRIST) return { ...lw };
    if (i === LANDMARK.RIGHT_WRIST) return { ...rw };
    if (i === LANDMARK.LEFT_ELBOW) {
      return midpoint(ls, lw, RECONSTRUCTED_VISIBILITY);
    }
    if (i === LANDMARK.RIGHT_ELBOW) {
      return midpoint(rs, rw, RECONSTRUCTED_VISIBILITY);
    }
    return {
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: scaleVisibility(lm.visibility),
    };
  });
}

/**
 * Walk over rejected indices (frames marked `EMPTY_FRAME` by the
 * plausibility filter) and attempt to replace each with a wrist-anchored
 * reconstruction built from the original pre-filter frame and the
 * nearest confident neighbour. Bench-only — other lifts don't keep
 * wrists reliably visible through the compromised window.
 *
 * Mutates the `filteredFrames` array in place. Returns the number of
 * successful reconstructions so callers can surface the count for
 * telemetry / dashboard diagnostics.
 */
export function reconstructBenchRejections({
  originalFrames,
  filteredFrames,
}: {
  originalFrames: PoseFrame[];
  filteredFrames: PoseFrame[];
}): number {
  let count = 0;
  for (let i = 0; i < filteredFrames.length; i++) {
    if (!isEmpty(filteredFrames[i])) continue;
    if (isEmpty(originalFrames[i])) continue;
    const original = originalFrames[i];

    const anchor = findAnchorFrame(filteredFrames, i);
    if (!anchor) continue;

    const rebuilt = reconstructBenchFrame({
      rejectedFrame: original,
      anchorFrame: anchor,
    });
    if (rebuilt) {
      filteredFrames[i] = rebuilt;
      count++;
    }
  }
  return count;
}
