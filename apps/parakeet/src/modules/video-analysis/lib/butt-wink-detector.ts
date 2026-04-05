/**
 * Detect posterior pelvic tilt ("butt wink") at the bottom of a squat.
 *
 * Butt wink = the pelvis tucks under at the bottom of a squat, causing
 * lumbar flexion under load. Detected by a sharp drop in hip angle
 * (shoulder-hip-knee) during the last 30% of descent.
 *
 * Most meaningful from side views (high sagittal confidence).
 */

import { computeAngle } from './angle-calculator';
import { LANDMARK, type PoseFrame } from './pose-types';

/**
 * Average the shoulder-hip-knee angle across both sides for one frame.
 *
 * Both sides are averaged to reduce noise from minor landmark asymmetry
 * in the MediaPipe model.
 */
function computeHipFlexionAngle({ frame }: { frame: PoseFrame }) {
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

export function detectButtWink({
  frames,
  bottomFrame,
  fps,
}: {
  frames: PoseFrame[];
  bottomFrame: number;
  fps: number;
}) {
  // The window is the last 30% of descent leading into the bottom position.
  // Using bottomFrame as the full descent length means the window starts at
  // 70% of bottomFrame — small bottomFrame values will snap to 0, which is
  // fine (we just look at everything we have).
  const descentStart = bottomFrame - Math.floor(0.3 * bottomFrame);
  const clampedStart = Math.max(0, descentStart);
  const clampedBottom = Math.min(bottomFrame, frames.length - 1);

  if (clampedStart >= clampedBottom) {
    return { detected: false, magnitudeDeg: null, frameIndex: null };
  }

  let maxAngle = -Infinity;
  let maxAngleFrame = clampedStart;

  for (let i = clampedStart; i <= clampedBottom; i++) {
    const angle = computeHipFlexionAngle({ frame: frames[i] });
    if (angle > maxAngle) {
      maxAngle = angle;
      maxAngleFrame = i;
    }
  }

  const bottomAngle = computeHipFlexionAngle({ frame: frames[clampedBottom] });
  const magnitudeDeg = maxAngle - bottomAngle;

  // A "wink" requires both a meaningful angle drop AND that the drop happens
  // quickly — within 200ms. Slow hip flexion is just normal squat mechanics;
  // a rapid late collapse is the dangerous pattern we want to flag.
  const framesFor200ms = Math.ceil(fps * 0.2);
  const framesFromMaxToBottom = clampedBottom - maxAngleFrame;

  const detected = magnitudeDeg > 10 && framesFromMaxToBottom < framesFor200ms;

  return {
    detected,
    magnitudeDeg: detected ? magnitudeDeg : null,
    frameIndex: detected ? maxAngleFrame : null,
  };
}
