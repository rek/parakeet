import { LANDMARK, type PoseFrame } from './pose-types';
import { computeAngle } from './angle-calculator';

/**
 * Compute elbow flare angle at a given frame.
 *
 * Measures the angle between upper arm (shoulder→elbow) and torso
 * (shoulder→hip) at a single frame. Side view: compute on visible side.
 * Ideal range for bench: 45-75° depending on grip width.
 */
export function computeElbowFlare({ frame }: { frame: PoseFrame }) {
  const ls = frame[LANDMARK.LEFT_SHOULDER];
  const le = frame[LANDMARK.LEFT_ELBOW];
  const lh = frame[LANDMARK.LEFT_HIP];

  const rs = frame[LANDMARK.RIGHT_SHOULDER];
  const re = frame[LANDMARK.RIGHT_ELBOW];
  const rh = frame[LANDMARK.RIGHT_HIP];

  // Vertex is shoulder; ray a = elbow, ray c = hip
  const leftFlare = computeAngle({ a: le, b: ls, c: lh });
  const rightFlare = computeAngle({ a: re, b: rs, c: rh });

  return (leftFlare + rightFlare) / 2;
}
