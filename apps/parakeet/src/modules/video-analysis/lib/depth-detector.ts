import { CM_PER_UNIT, LANDMARK, type PoseFrame } from './pose-types';

/**
 * Detect squat depth by comparing hip Y to knee Y.
 *
 * In MediaPipe, Y increases downward. When the lifter squats below parallel,
 * the hip crease drops below the knee, giving hipY > kneeY.
 *
 * depthCm is positive when below parallel (hip below knee) and negative when
 * above parallel (hip above knee). The magnitude is a rough physical estimate.
 */
export function detectSquatDepth({ frame }: { frame: PoseFrame }) {
  const lh = frame[LANDMARK.LEFT_HIP];
  const rh = frame[LANDMARK.RIGHT_HIP];
  const lk = frame[LANDMARK.LEFT_KNEE];
  const rk = frame[LANDMARK.RIGHT_KNEE];

  const hipY = (lh.y + rh.y) / 2;
  const kneeY = (lk.y + rk.y) / 2;

  const belowParallel = hipY > kneeY;
  // hipY - kneeY is positive when hip is lower than knee (below parallel)
  const depthCm = (hipY - kneeY) * CM_PER_UNIT;

  return { belowParallel, depthCm };
}
