/**
 * Detect lateral hip shift during a squat.
 *
 * Tracks the difference in hip Y positions (left vs right) to detect
 * asymmetric loading. Most meaningful from front views (low sagittal confidence).
 */

import { CM_PER_UNIT, LANDMARK, type PoseFrame } from './pose-types';

export function computeHipShift({
  frames,
  startFrame,
  endFrame,
}: {
  frames: PoseFrame[];
  startFrame: number;
  endFrame: number;
}) {
  const clampedStart = Math.max(0, startFrame);
  const clampedEnd = Math.min(endFrame, frames.length - 1);

  let maxAbsShift = 0;
  // Signed shift: positive = left hip dropped (leftHip.y > rightHip.y in
  // MediaPipe where Y increases downward). A dropped hip indicates that side
  // is bearing more eccentric load.
  let shiftAtMax = 0;

  for (let i = clampedStart; i <= clampedEnd; i++) {
    const lh = frames[i][LANDMARK.LEFT_HIP];
    const rh = frames[i][LANDMARK.RIGHT_HIP];

    const shiftCm = (lh.y - rh.y) * CM_PER_UNIT;
    const absShift = Math.abs(shiftCm);

    if (absShift > maxAbsShift) {
      maxAbsShift = absShift;
      shiftAtMax = shiftCm;
    }
  }

  // 1cm threshold filters out landmark noise — sub-centimetre asymmetry is
  // within MediaPipe's detection variance and not clinically meaningful.
  if (maxAbsShift <= 1) {
    return { maxShiftCm: maxAbsShift, direction: 'none' as const };
  }

  const direction = shiftAtMax > 0 ? ('left' as const) : ('right' as const);
  return { maxShiftCm: maxAbsShift, direction };
}
