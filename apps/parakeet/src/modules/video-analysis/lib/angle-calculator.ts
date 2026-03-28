import { LANDMARK, type PoseLandmark, type PoseFrame } from './pose-types';

/**
 * Compute the angle at vertex `b` formed by the ray b→a and the ray b→c.
 *
 * Uses atan2 rather than the dot-product formula to avoid numerical issues
 * near 0° and 180° and to handle degenerate (zero-length) vectors gracefully.
 * Returns degrees in [0, 180].
 */
export function computeAngle({ a, b, c }: { a: PoseLandmark; b: PoseLandmark; c: PoseLandmark }) {
  const ax = a.x - b.x;
  const ay = a.y - b.y;
  const cx = c.x - b.x;
  const cy = c.y - b.y;

  const dot = ax * cx + ay * cy;
  const cross = ax * cy - ay * cx;

  return Math.abs((Math.atan2(Math.abs(cross), dot) * 180) / Math.PI);
}

/**
 * Compute torso forward lean: angle of the shoulder-to-hip line from vertical.
 *
 * 0° = perfectly upright, 90° = horizontal (fully forward or backward lean).
 * In MediaPipe, Y increases downward, so a vertical torso has Δx ≈ 0 and
 * Δy > 0 when measured shoulder→hip. We use atan2(|Δx|, Δy) to get the
 * deviation from vertical regardless of camera-left vs camera-right orientation.
 */
export function computeForwardLean({ frame }: { frame: PoseFrame }) {
  const ls = frame[LANDMARK.LEFT_SHOULDER];
  const rs = frame[LANDMARK.RIGHT_SHOULDER];
  const lh = frame[LANDMARK.LEFT_HIP];
  const rh = frame[LANDMARK.RIGHT_HIP];

  const shoulderX = (ls.x + rs.x) / 2;
  const shoulderY = (ls.y + rs.y) / 2;
  const hipX = (lh.x + rh.x) / 2;
  const hipY = (lh.y + rh.y) / 2;

  const dx = Math.abs(hipX - shoulderX);
  // dy is positive when hip is below shoulder (normal standing/squatting position)
  const dy = hipY - shoulderY;

  return (Math.atan2(dx, Math.max(dy, 0)) * 180) / Math.PI;
}

/**
 * Compute the hip angle: vertex at hip, rays toward shoulder and knee.
 *
 * Averages left and right sides. A fully extended hip approaches 180°;
 * a deep squat or deadlift start will be much smaller.
 */
export function computeHipAngle({ frame }: { frame: PoseFrame }) {
  const ls = frame[LANDMARK.LEFT_SHOULDER];
  const rs = frame[LANDMARK.RIGHT_SHOULDER];
  const lh = frame[LANDMARK.LEFT_HIP];
  const rh = frame[LANDMARK.RIGHT_HIP];
  const lk = frame[LANDMARK.LEFT_KNEE];
  const rk = frame[LANDMARK.RIGHT_KNEE];

  const leftAngle = computeAngle({ a: ls, b: lh, c: lk });
  const rightAngle = computeAngle({ a: rs, b: rh, c: rk });

  return (leftAngle + rightAngle) / 2;
}

/**
 * Compute the knee angle: vertex at knee, rays toward hip and ankle.
 *
 * Averages left and right sides. Full extension = ~180°; deep squat = ~60-80°.
 */
export function computeKneeAngle({ frame }: { frame: PoseFrame }) {
  const lh = frame[LANDMARK.LEFT_HIP];
  const rh = frame[LANDMARK.RIGHT_HIP];
  const lk = frame[LANDMARK.LEFT_KNEE];
  const rk = frame[LANDMARK.RIGHT_KNEE];
  const la = frame[LANDMARK.LEFT_ANKLE];
  const ra = frame[LANDMARK.RIGHT_ANKLE];

  const leftAngle = computeAngle({ a: lh, b: lk, c: la });
  const rightAngle = computeAngle({ a: rh, b: rk, c: ra });

  return (leftAngle + rightAngle) / 2;
}
