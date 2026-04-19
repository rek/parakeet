// @spec docs/features/video-analysis/spec-pipeline.md
import { LANDMARK, type PoseFrame } from './pose-types';

/**
 * Landmarks we consider "core" for powerlifting. If these drift while the
 * face flickers (bar occlusion case on bench), the downstream metrics read
 * garbage. Twelve landmarks — six per side.
 */
const CORE_LANDMARK_INDICES = [
  LANDMARK.LEFT_SHOULDER,
  LANDMARK.RIGHT_SHOULDER,
  LANDMARK.LEFT_ELBOW,
  LANDMARK.RIGHT_ELBOW,
  LANDMARK.LEFT_WRIST,
  LANDMARK.RIGHT_WRIST,
  LANDMARK.LEFT_HIP,
  LANDMARK.RIGHT_HIP,
  LANDMARK.LEFT_KNEE,
  LANDMARK.RIGHT_KNEE,
  LANDMARK.LEFT_ANKLE,
  LANDMARK.RIGHT_ANKLE,
] as const;

/**
 * Landmarks that define the anchor for the torso-jump check. Shoulders
 * only, not hips: on squat/deadlift, the hips legitimately move 0.1+
 * normalized units between standing and bottom at 4fps — a hip jump
 * isn't implausible. Shoulders stay within a few percent of their
 * starting position across a whole squat rep, so a shoulder-midpoint
 * snap to a ceiling feature is the signature we're looking for.
 */
const TORSO_LANDMARK_INDICES = [
  LANDMARK.LEFT_SHOULDER,
  LANDMARK.RIGHT_SHOULDER,
] as const;

/**
 * Median visibility across `CORE_LANDMARK_INDICES` must be at least this
 * for a frame to survive. 0.3 is well below MediaPipe's own detection
 * threshold (0.5). The filter's job is to strip single-frame "whole-body
 * confidence collapses" during bench bar occlusion, not to reject clips
 * where half the landmarks are consistently moderate — the detector
 * handles steady moderate signal fine. Tuned against the 16-fixture
 * suite: 0.4 regressed `bench-45-5reps` by a rep; 0.3 passes all.
 */
const MIN_MEDIAN_VISIBILITY = 0.3;

/**
 * Torso landmarks that jump by more than this × the clip's own median
 * torso displacement are treated as pose-lost frames. Tuned against the
 * 16-fixture calibration suite: 8× catches the snap-to-bench-frame
 * drift while leaving legitimate lifter-motion edges (setup, walk-off)
 * alone. Stricter values (5×) regressed `bench-45-5reps` by one rep.
 */
const MAX_TORSO_JUMP_MULTIPLE = 8;

/**
 * Below this absolute jump, don't bother flagging. 0.08 ≈ 20cm for a
 * 170cm lifter filling 70% of frame — bigger than any credible 4fps
 * inter-frame torso displacement for someone doing a rep, smaller than
 * the `snap-to-ceiling` drifts we want to catch (≈ 0.25 observed).
 */
const MIN_TORSO_JUMP_FOR_REJECTION = 0.08;

export interface PlausibilityResult {
  /** Input frames with rejected ones replaced by EMPTY_FRAME. */
  frames: PoseFrame[];
  /** How many frames were rejected for low visibility. */
  lowVisibilityRejected: number;
  /** How many frames were rejected for implausible torso jumps. */
  torsoJumpRejected: number;
  /** Median per-frame torso displacement across the clip (diagnostic). */
  medianTorsoJump: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function isEmpty(frame: PoseFrame): boolean {
  return frame[0].visibility === 0 && frame[0].x === 0 && frame[0].y === 0;
}

function torsoCentroid(frame: PoseFrame): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const idx of TORSO_LANDMARK_INDICES) {
    sx += frame[idx].x;
    sy += frame[idx].y;
  }
  return {
    x: sx / TORSO_LANDMARK_INDICES.length,
    y: sy / TORSO_LANDMARK_INDICES.length,
  };
}

function medianCoreVisibility(frame: PoseFrame): number {
  const vs = CORE_LANDMARK_INDICES.map((i) => frame[i].visibility);
  return median(vs);
}

const EMPTY: PoseFrame = Array.from({ length: 33 }, () => ({
  x: 0,
  y: 0,
  z: 0,
  visibility: 0,
}));

/**
 * Reject frames whose pose has likely collapsed to background features.
 * Two independent checks — a frame is rejected if it trips either.
 *
 * Low-visibility check: median visibility across the 12 core landmarks
 * drops below `MIN_MEDIAN_VISIBILITY`. Catches the "face-occluded →
 * whole-body confidence tanks" case.
 *
 * Torso-jump check: torso centroid moves by more than
 * `MAX_TORSO_JUMP_MULTIPLE` × the clip's own median torso jump. Catches
 * the "skeleton floats away" case where MediaPipe snaps to a bench
 * edge or ceiling feature, then snaps back. Anchored to per-clip
 * median rather than a fixed threshold so the filter scales with the
 * lifter's own camera distance and movement.
 *
 * Rejected frames are replaced by `EMPTY_FRAME` so the downstream
 * `interpolateEmptyFrames` pass lerps through them from neighbouring
 * confident frames — same recovery mechanism that already handles
 * landmarker-null frames.
 *
 * Returns the counts separately so the dashboard can surface how many
 * frames each filter stripped ("plausibility rejection counter" in
 * the backlog #24 validation notes).
 */
export function filterImplausibleFrames({
  frames,
}: {
  frames: PoseFrame[];
}): PlausibilityResult {
  if (frames.length === 0) {
    return {
      frames,
      lowVisibilityRejected: 0,
      torsoJumpRejected: 0,
      medianTorsoJump: 0,
    };
  }

  // Pass 1: compute torso centroid per non-empty frame, then the
  // median inter-frame jump. Empty-in, empty-out — skip.
  const centroids: Array<{ x: number; y: number } | null> = frames.map((f) =>
    isEmpty(f) ? null : torsoCentroid(f)
  );

  const jumps: number[] = [];
  for (let i = 1; i < centroids.length; i++) {
    const prev = centroids[i - 1];
    const cur = centroids[i];
    if (!prev || !cur) continue;
    jumps.push(Math.hypot(cur.x - prev.x, cur.y - prev.y));
  }
  const medianJump = median(jumps);
  const jumpThreshold = Math.max(
    MIN_TORSO_JUMP_FOR_REJECTION,
    medianJump * MAX_TORSO_JUMP_MULTIPLE
  );

  // Pass 2: apply both checks. A frame rejected by torso-jump leaves
  // centroids[i] at null so the next frame's jump is measured against
  // the last confident centroid, not the rejected one.
  const result = frames.slice();
  let lowVisibilityRejected = 0;
  let torsoJumpRejected = 0;
  let lastConfidentCentroid: { x: number; y: number } | null = null;

  for (let i = 0; i < result.length; i++) {
    const frame = result[i];
    if (isEmpty(frame)) continue;

    if (medianCoreVisibility(frame) < MIN_MEDIAN_VISIBILITY) {
      result[i] = EMPTY;
      lowVisibilityRejected++;
      continue;
    }

    if (lastConfidentCentroid && centroids[i]) {
      const jump = Math.hypot(
        centroids[i]!.x - lastConfidentCentroid.x,
        centroids[i]!.y - lastConfidentCentroid.y
      );
      if (jump > jumpThreshold) {
        result[i] = EMPTY;
        torsoJumpRejected++;
        continue;
      }
    }

    lastConfidentCentroid = centroids[i];
  }

  return {
    frames: result,
    lowVisibilityRejected,
    torsoJumpRejected,
    medianTorsoJump: medianJump,
  };
}
