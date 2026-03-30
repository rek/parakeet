import type { BarPathPoint } from '@parakeet/shared-types';

import { CM_PER_UNIT, LANDMARK, type PoseLandmark, type PoseFrame } from './pose-types';

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

/**
 * Detect knee valgus (cave) from a front-view frame.
 *
 * Measures the angle at the knee in the frontal plane (hip-knee-ankle).
 * In a front view, X-axis position reveals medial/lateral knee displacement.
 * Returns the valgus angle for each side — positive values indicate the
 * knee is medial to the hip-ankle line (caving in).
 *
 * Threshold from coaching literature: >10° valgus is a concern under load.
 */
export function computeKneeValgus({ frame }: { frame: PoseFrame }) {
  const lh = frame[LANDMARK.LEFT_HIP];
  const rh = frame[LANDMARK.RIGHT_HIP];
  const lk = frame[LANDMARK.LEFT_KNEE];
  const rk = frame[LANDMARK.RIGHT_KNEE];
  const la = frame[LANDMARK.LEFT_ANKLE];
  const ra = frame[LANDMARK.RIGHT_ANKLE];

  // Front-view knee angle (hip-knee-ankle in frontal plane)
  const leftAngle = computeAngle({ a: lh, b: lk, c: la });
  const rightAngle = computeAngle({ a: rh, b: rk, c: ra });

  // Left side: knee caves inward when knee X is medial to hip-ankle midpoint
  const leftMidX = (lh.x + la.x) / 2;
  const leftIsMedial = lk.x > leftMidX;

  // Right side: mirror logic
  const rightMidX = (rh.x + ra.x) / 2;
  const rightIsMedial = rk.x < rightMidX;

  return {
    leftAngleDeg: leftAngle,
    rightAngleDeg: rightAngle,
    leftIsValgus: leftIsMedial && leftAngle < 170,
    rightIsValgus: rightIsMedial && rightAngle < 170,
    avgAngleDeg: (leftAngle + rightAngle) / 2,
  };
}

/**
 * Compute elbow angle: vertex at elbow, rays toward shoulder and wrist.
 *
 * Averages left and right sides. Full extension = ~180°.
 * Used for bench press lockout detection (IPF requires full elbow extension).
 */
export function computeElbowAngle({ frame }: { frame: PoseFrame }) {
  const ls = frame[LANDMARK.LEFT_SHOULDER];
  const rs = frame[LANDMARK.RIGHT_SHOULDER];
  const le = frame[LANDMARK.LEFT_ELBOW];
  const re = frame[LANDMARK.RIGHT_ELBOW];
  const lw = frame[LANDMARK.LEFT_WRIST];
  const rw = frame[LANDMARK.RIGHT_WRIST];

  const leftAngle = computeAngle({ a: ls, b: le, c: lw });
  const rightAngle = computeAngle({ a: rs, b: re, c: rw });

  return (leftAngle + rightAngle) / 2;
}

/**
 * Compute frame-to-frame bar Y velocity from a bar path.
 *
 * Returns velocity in cm/s for each frame transition. Positive = bar moving
 * down (Y increases in MediaPipe), negative = bar moving up.
 * Used for bench pause detection (velocity ≈ 0 at chest).
 */
export function computeBarVelocity({
  barPath,
  fps,
}: {
  barPath: BarPathPoint[];
  fps: number;
}) {
  if (barPath.length < 2) return [];

  const dt = 1 / fps;
  return barPath.slice(1).map((point, i) => {
    const dy = (point.y - barPath[i].y) * CM_PER_UNIT;
    return dy / dt;
  });
}
