import { describe, expect, it } from 'vitest';

import { computePressAsymmetry } from '../press-asymmetry';
import { LANDMARK, type PoseFrame, type PoseLandmark } from '../pose-types';

function makeLandmark(
  x: number,
  y: number,
  visibility = 1
): PoseLandmark {
  return { x, y, z: 0, visibility };
}

/**
 * Synthetic front-on bench frame. Shoulders at y=0.3, hips at y=0.6 →
 * torso length 0.3 (normalised). Wrists are placed above shoulders and
 * the caller chooses their y values to simulate symmetry / asymmetry.
 */
function makeFrame({
  leftWristY,
  rightWristY,
}: {
  leftWristY: number;
  rightWristY: number;
}): PoseFrame {
  const frame: PoseFrame = Array.from({ length: 33 }, () =>
    makeLandmark(0.5, 0.5)
  );
  frame[LANDMARK.LEFT_SHOULDER] = makeLandmark(0.4, 0.3);
  frame[LANDMARK.RIGHT_SHOULDER] = makeLandmark(0.6, 0.3);
  frame[LANDMARK.LEFT_HIP] = makeLandmark(0.4, 0.6);
  frame[LANDMARK.RIGHT_HIP] = makeLandmark(0.6, 0.6);
  frame[LANDMARK.LEFT_WRIST] = makeLandmark(0.4, leftWristY);
  frame[LANDMARK.RIGHT_WRIST] = makeLandmark(0.6, rightWristY);
  return frame;
}

describe('computePressAsymmetry', () => {
  it('returns 0 for perfectly level wrists', () => {
    const frames: PoseFrame[] = Array.from({ length: 5 }, () =>
      makeFrame({ leftWristY: 0.2, rightWristY: 0.2 })
    );
    const result = computePressAsymmetry({
      frames,
      startFrame: 0,
      endFrame: 4,
    });
    expect(result.ratio).toBe(0);
    expect(result.framesUsed).toBe(5);
  });

  it('returns peak asymmetry across the window, not mean', () => {
    // Torso length is 0.3; a 0.03 vertical wrist delta → ratio 0.1.
    const frames: PoseFrame[] = [
      makeFrame({ leftWristY: 0.2, rightWristY: 0.2 }),
      makeFrame({ leftWristY: 0.2, rightWristY: 0.2 }),
      makeFrame({ leftWristY: 0.2, rightWristY: 0.23 }), // peak
      makeFrame({ leftWristY: 0.2, rightWristY: 0.2 }),
    ];
    const result = computePressAsymmetry({
      frames,
      startFrame: 0,
      endFrame: 3,
    });
    expect(result.ratio).toBeCloseTo(0.1, 2);
    expect(result.framesUsed).toBe(4);
  });

  it('skips frames missing required landmarks', () => {
    const frames: PoseFrame[] = [
      makeFrame({ leftWristY: 0.2, rightWristY: 0.2 }),
      makeFrame({ leftWristY: 0.2, rightWristY: 0.2 }),
    ];
    frames[0][LANDMARK.LEFT_WRIST].visibility = 0.2; // below threshold
    const result = computePressAsymmetry({
      frames,
      startFrame: 0,
      endFrame: 1,
    });
    expect(result.framesUsed).toBe(1);
  });

  it('is scale-invariant — doubling torso doubles tolerance', () => {
    const tight: PoseFrame = makeFrame({ leftWristY: 0.2, rightWristY: 0.23 });
    // Big lifter: torso 0.6 instead of 0.3 → same 0.03 delta reads at half the ratio.
    const big: PoseFrame = Array.from({ length: 33 }, () =>
      makeLandmark(0.5, 0.5)
    );
    big[LANDMARK.LEFT_SHOULDER] = makeLandmark(0.4, 0.2);
    big[LANDMARK.RIGHT_SHOULDER] = makeLandmark(0.6, 0.2);
    big[LANDMARK.LEFT_HIP] = makeLandmark(0.4, 0.8);
    big[LANDMARK.RIGHT_HIP] = makeLandmark(0.6, 0.8);
    big[LANDMARK.LEFT_WRIST] = makeLandmark(0.4, 0.1);
    big[LANDMARK.RIGHT_WRIST] = makeLandmark(0.6, 0.13);
    const tightResult = computePressAsymmetry({
      frames: [tight],
      startFrame: 0,
      endFrame: 0,
    });
    const bigResult = computePressAsymmetry({
      frames: [big],
      startFrame: 0,
      endFrame: 0,
    });
    expect(tightResult.ratio).toBeCloseTo(0.1, 2);
    expect(bigResult.ratio).toBeCloseTo(0.05, 2);
  });
});
