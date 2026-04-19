import { describe, expect, it } from 'vitest';

import { checkLiftMismatch } from '../check-lift-mismatch';
import { LANDMARK, type PoseFrame, type PoseLandmark } from '../pose-types';

function lm(x: number, y: number, visibility = 1): PoseLandmark {
  return { x, y, z: 0, visibility };
}

function emptyFrame(): PoseFrame {
  return Array.from({ length: 33 }, () => lm(0, 0, 0));
}

function buildFrame({
  shoulderY,
  hipY,
  wristY,
}: {
  shoulderY: number;
  hipY: number;
  wristY: number;
}): PoseFrame {
  const frame = emptyFrame();
  frame[LANDMARK.LEFT_SHOULDER] = lm(0.4, shoulderY);
  frame[LANDMARK.RIGHT_SHOULDER] = lm(0.6, shoulderY);
  frame[LANDMARK.LEFT_HIP] = lm(0.42, hipY);
  frame[LANDMARK.RIGHT_HIP] = lm(0.58, hipY);
  frame[LANDMARK.LEFT_WRIST] = lm(0.35, wristY);
  frame[LANDMARK.RIGHT_WRIST] = lm(0.65, wristY);
  return frame;
}

function repeatFrame(frame: PoseFrame, n: number): PoseFrame[] {
  return Array.from({ length: n }, () => frame);
}

const benchFrames = repeatFrame(
  buildFrame({ shoulderY: 0.5, hipY: 0.55, wristY: 0.2 }),
  30
);
const squatFrames = repeatFrame(
  buildFrame({ shoulderY: 0.3, hipY: 0.55, wristY: 0.3 }),
  30
);

describe('checkLiftMismatch', () => {
  it('returns null when classifier and user agree', () => {
    expect(checkLiftMismatch({ frames: benchFrames, declared: 'bench' })).toBeNull();
  });

  it('returns a mismatch object when classifier disagrees with high confidence', () => {
    const result = checkLiftMismatch({
      frames: benchFrames,
      declared: 'squat',
    });
    expect(result).not.toBeNull();
    expect(result!.detected).toBe('bench');
    expect(result!.declared).toBe('squat');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result!.reason).toMatch(/wrist/i);
  });

  it('returns null when detection is low-confidence even if it differs', () => {
    // Two or three frames — detectLift returns { lift: null, confidence: 0 }
    const sparse = [emptyFrame(), emptyFrame()];
    expect(checkLiftMismatch({ frames: sparse, declared: 'squat' })).toBeNull();
  });

  it('returns null for declared lifts outside squat/bench/deadlift', () => {
    // Classifier says bench, declared is an unsupported lift — do not warn.
    expect(
      checkLiftMismatch({ frames: benchFrames, declared: 'press' })
    ).toBeNull();
    expect(
      checkLiftMismatch({ frames: squatFrames, declared: 'row' })
    ).toBeNull();
  });
});
