import { describe, expect, it } from 'vitest';

import { computeBarTiltSeries } from '../bar-tilt';
import { LANDMARK, type PoseFrame, type PoseLandmark } from '../pose-types';

function makeLandmark(
  x: number,
  y: number,
  visibility = 1
): PoseLandmark {
  return { x, y, z: 0, visibility };
}

function makeFrame({
  leftWrist,
  rightWrist,
}: {
  leftWrist: PoseLandmark;
  rightWrist: PoseLandmark;
}): PoseFrame {
  const frame: PoseFrame = Array.from({ length: 33 }, () =>
    makeLandmark(0.5, 0.5)
  );
  frame[LANDMARK.LEFT_WRIST] = leftWrist;
  frame[LANDMARK.RIGHT_WRIST] = rightWrist;
  return frame;
}

describe('computeBarTiltSeries', () => {
  it('returns 0° when bar is level across the rep', () => {
    const frames: PoseFrame[] = Array.from({ length: 10 }, () =>
      makeFrame({
        leftWrist: makeLandmark(0.4, 0.5),
        rightWrist: makeLandmark(0.6, 0.5),
      })
    );
    const result = computeBarTiltSeries({
      frames,
      startFrame: 0,
      endFrame: frames.length - 1,
    });
    expect(result.maxDeg).toBeCloseTo(0, 3);
    expect(result.meanDeg).toBeCloseTo(0, 3);
    expect(result.framesUsed).toBe(10);
  });

  it('reports a 45° tilt when right wrist sits one unit below left', () => {
    // Δx = 0.2, Δy = 0.2 → atan2(0.2, 0.2) = 45°
    const frames: PoseFrame[] = [
      makeFrame({
        leftWrist: makeLandmark(0.4, 0.5),
        rightWrist: makeLandmark(0.6, 0.7),
      }),
    ];
    const result = computeBarTiltSeries({
      frames,
      startFrame: 0,
      endFrame: 0,
    });
    expect(result.maxDeg).toBeCloseTo(45, 1);
    expect(result.meanDeg).toBeCloseTo(45, 1);
    expect(result.framesUsed).toBe(1);
  });

  it('absolute-values tilt — direction does not matter', () => {
    // One frame tilted +10° (right low), one frame tilted −10° (left low).
    // Max should still be 10°, mean should be 10° (not 0°).
    const frames: PoseFrame[] = [
      makeFrame({
        leftWrist: makeLandmark(0.4, 0.5),
        rightWrist: makeLandmark(0.6, 0.5 + 0.2 * Math.tan((10 * Math.PI) / 180)),
      }),
      makeFrame({
        leftWrist: makeLandmark(0.4, 0.5 + 0.2 * Math.tan((10 * Math.PI) / 180)),
        rightWrist: makeLandmark(0.6, 0.5),
      }),
    ];
    const result = computeBarTiltSeries({
      frames,
      startFrame: 0,
      endFrame: 1,
    });
    expect(result.maxDeg).toBeCloseTo(10, 1);
    expect(result.meanDeg).toBeCloseTo(10, 1);
    expect(result.framesUsed).toBe(2);
  });

  it('skips frames with invisible wrists', () => {
    const frames: PoseFrame[] = [
      makeFrame({
        leftWrist: makeLandmark(0.4, 0.5, 0.1), // below threshold
        rightWrist: makeLandmark(0.6, 0.7),
      }),
      makeFrame({
        leftWrist: makeLandmark(0.4, 0.5),
        rightWrist: makeLandmark(0.6, 0.5),
      }),
    ];
    const result = computeBarTiltSeries({
      frames,
      startFrame: 0,
      endFrame: 1,
    });
    expect(result.framesUsed).toBe(1);
    expect(result.maxDeg).toBeCloseTo(0, 3);
  });

  it('returns zeros when no frames have both wrists visible', () => {
    const frames: PoseFrame[] = [
      makeFrame({
        leftWrist: makeLandmark(0.4, 0.5, 0),
        rightWrist: makeLandmark(0.6, 0.5, 0),
      }),
    ];
    const result = computeBarTiltSeries({
      frames,
      startFrame: 0,
      endFrame: 0,
    });
    expect(result).toEqual({ maxDeg: 0, meanDeg: 0, framesUsed: 0 });
  });

  it('clamps out-of-range frame window indices', () => {
    const frames: PoseFrame[] = [
      makeFrame({
        leftWrist: makeLandmark(0.4, 0.5),
        rightWrist: makeLandmark(0.6, 0.5),
      }),
    ];
    const result = computeBarTiltSeries({
      frames,
      startFrame: -5,
      endFrame: 100,
    });
    expect(result.framesUsed).toBe(1);
  });
});
