import { LANDMARK, type PoseFrame } from './pose-types';

/**
 * Auto-detect whether a video was filmed from the side or front.
 *
 * In a side view, left and right shoulder landmarks overlap in X (one is
 * behind the other from the camera's perspective). In a front view, they
 * are clearly separated.
 *
 * Uses the average shoulder X-separation across the first N frames.
 * Threshold: if separation > 0.15 normalized units, it's a front view.
 * This corresponds to ~36cm at standard calibration — clearly separated.
 */
export function detectCameraAngle({
  frames,
}: {
  frames: PoseFrame[];
}) {
  const THRESHOLD = 0.15;
  const SAMPLE_COUNT = Math.min(frames.length, 10);

  if (SAMPLE_COUNT === 0) return 'side' as const;

  let totalSeparation = 0;
  let validFrames = 0;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const ls = frames[i][LANDMARK.LEFT_SHOULDER];
    const rs = frames[i][LANDMARK.RIGHT_SHOULDER];

    // Skip frames where landmarks aren't visible
    if (ls.visibility < 0.5 || rs.visibility < 0.5) continue;

    totalSeparation += Math.abs(ls.x - rs.x);
    validFrames++;
  }

  if (validFrames === 0) return 'side' as const;

  const avgSeparation = totalSeparation / validFrames;
  return avgSeparation > THRESHOLD ? ('front' as const) : ('side' as const);
}
