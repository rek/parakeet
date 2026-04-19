// @spec docs/features/video-analysis/spec-lift-label.md
import { detectLift, WARN_CONFIDENCE, type DetectableLift } from './detect-lift';
import type { PoseFrame } from './pose-types';
import { isSupportedLift } from './supported-lifts';

export interface LiftMismatch {
  detected: DetectableLift;
  declared: DetectableLift;
  confidence: number;
  reason: string;
}

/**
 * Decide whether to warn the user that their recorded video looks like a
 * different lift than the one they declared. Returns `null` when:
 *
 *   - the pose classifier is not confident enough (`< WARN_CONFIDENCE`),
 *   - the classifier has too little data (`lift === null`),
 *   - the detected lift matches the declared lift, or
 *   - the declared lift is not one of the three supported competition lifts.
 *
 * Only call sites that intend to surface a user-facing warning should
 * consume this result. The underlying analysis pipeline keeps running
 * regardless — this is a nudge, not a gate.
 */
export function checkLiftMismatch({
  frames,
  declared,
}: {
  frames: PoseFrame[];
  declared: string;
}): LiftMismatch | null {
  if (!isSupportedLift(declared)) return null;

  const detection = detectLift({ frames });
  if (!detection.lift) return null;
  if (detection.confidence < WARN_CONFIDENCE) return null;
  if (detection.lift === declared) return null;

  return {
    detected: detection.lift,
    declared: declared as DetectableLift,
    confidence: detection.confidence,
    reason: detection.reason,
  };
}
