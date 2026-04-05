/**
 * Compute stance width from ankle-to-ankle distance.
 *
 * Most meaningful from front views (low sagittal confidence); side view
 * gives compressed projection. Computed at standing frame (first or last frame of rep).
 */

import { CM_PER_UNIT, LANDMARK, type PoseFrame } from './pose-types';

export function computeStanceWidth({ frame }: { frame: PoseFrame }) {
  const leftAnkle = frame[LANDMARK.LEFT_ANKLE];
  const rightAnkle = frame[LANDMARK.RIGHT_ANKLE];

  // Horizontal separation only — Y difference is height, not width.
  return Math.abs(leftAnkle.x - rightAnkle.x) * CM_PER_UNIT;
}
