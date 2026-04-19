import { describe, expect, it } from 'vitest';

import { computeElbowPathSymmetry } from '../elbow-path-symmetry';
import { LANDMARK, type PoseFrame, type PoseLandmark } from '../pose-types';

function makeLandmark(
  x: number,
  y: number,
  visibility = 1
): PoseLandmark {
  return { x, y, z: 0, visibility };
}

function makeFrame({
  leftElbowX,
  rightElbowX,
}: {
  leftElbowX: number;
  rightElbowX: number;
}): PoseFrame {
  const frame: PoseFrame = Array.from({ length: 33 }, () =>
    makeLandmark(0.5, 0.5)
  );
  frame[LANDMARK.LEFT_SHOULDER] = makeLandmark(0.4, 0.3);
  frame[LANDMARK.RIGHT_SHOULDER] = makeLandmark(0.6, 0.3);
  frame[LANDMARK.LEFT_ELBOW] = makeLandmark(leftElbowX, 0.45);
  frame[LANDMARK.RIGHT_ELBOW] = makeLandmark(rightElbowX, 0.45);
  return frame;
}

describe('computeElbowPathSymmetry', () => {
  it('returns 1.0 when both elbows are equidistant from the midline', () => {
    // Midline = 0.5. Each elbow offset by 0.1 → ratio = 0.1 / 0.1 = 1.
    const frames: PoseFrame[] = Array.from({ length: 5 }, () =>
      makeFrame({ leftElbowX: 0.4, rightElbowX: 0.6 })
    );
    const result = computeElbowPathSymmetry({
      frames,
      startFrame: 0,
      endFrame: 4,
    });
    expect(result.ratio).toBeCloseTo(1, 3);
    expect(result.framesUsed).toBe(5);
  });

  it('returns 2.0 when left elbow is twice as far from midline', () => {
    // Left 0.2 from midline, right 0.1. Ratio = 0.2 / 0.1 = 2.
    const frames: PoseFrame[] = [
      makeFrame({ leftElbowX: 0.3, rightElbowX: 0.6 }),
    ];
    const result = computeElbowPathSymmetry({
      frames,
      startFrame: 0,
      endFrame: 0,
    });
    expect(result.ratio).toBeCloseTo(2, 3);
    expect(result.framesUsed).toBe(1);
  });

  it('returns 0.5 when right elbow flares further', () => {
    // Left 0.1 from midline, right 0.2. Ratio = 0.5.
    const frames: PoseFrame[] = [
      makeFrame({ leftElbowX: 0.4, rightElbowX: 0.7 }),
    ];
    const result = computeElbowPathSymmetry({
      frames,
      startFrame: 0,
      endFrame: 0,
    });
    expect(result.ratio).toBeCloseTo(0.5, 3);
  });

  it('averages offsets across the window before taking ratio', () => {
    // First frame: L 0.1, R 0.1. Second frame: L 0.3, R 0.1.
    // Averages: L 0.2, R 0.1. Ratio = 2.0.
    const frames: PoseFrame[] = [
      makeFrame({ leftElbowX: 0.4, rightElbowX: 0.6 }),
      makeFrame({ leftElbowX: 0.2, rightElbowX: 0.6 }),
    ];
    const result = computeElbowPathSymmetry({
      frames,
      startFrame: 0,
      endFrame: 1,
    });
    expect(result.ratio).toBeCloseTo(2, 3);
    expect(result.framesUsed).toBe(2);
  });

  it('skips frames missing required landmarks', () => {
    const frames: PoseFrame[] = [
      makeFrame({ leftElbowX: 0.3, rightElbowX: 0.6 }), // ratio 2
      makeFrame({ leftElbowX: 0.4, rightElbowX: 0.6 }), // ratio 1
    ];
    frames[0][LANDMARK.LEFT_ELBOW].visibility = 0;
    const result = computeElbowPathSymmetry({
      frames,
      startFrame: 0,
      endFrame: 1,
    });
    expect(result.framesUsed).toBe(1);
    expect(result.ratio).toBeCloseTo(1, 3);
  });

  it('returns neutral 1.0 when no frames are usable', () => {
    const frames: PoseFrame[] = [
      makeFrame({ leftElbowX: 0.3, rightElbowX: 0.6 }),
    ];
    frames[0][LANDMARK.LEFT_ELBOW].visibility = 0;
    const result = computeElbowPathSymmetry({
      frames,
      startFrame: 0,
      endFrame: 0,
    });
    expect(result).toEqual({ ratio: 1, framesUsed: 0 });
  });
});
