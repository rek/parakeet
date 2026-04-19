import { describe, expect, it } from 'vitest';

import type { PoseFrame, PoseLandmark } from '../pose-types';
import { lerpPoseFrame } from '../skeleton-lerp';

function lm(x: number, y: number, visibility = 1): PoseLandmark {
  return { x, y, z: 0, visibility };
}

function mkFrame(xBase: number): PoseFrame {
  // 33-landmark frame where each landmark sits at (xBase + i/100, i/100).
  return Array.from({ length: 33 }, (_, i) => lm(xBase + i / 100, i / 100));
}

describe('lerpPoseFrame', () => {
  const frames: PoseFrame[] = [mkFrame(0), mkFrame(1), mkFrame(2)];
  const fps = 4;

  it('returns null for empty frames', () => {
    expect(lerpPoseFrame({ frames: [], fps, currentTime: 0 })).toBeNull();
  });

  it('returns null when fps is non-positive', () => {
    expect(lerpPoseFrame({ frames, fps: 0, currentTime: 0 })).toBeNull();
  });

  it('clamps to the first frame when currentTime is before the clip', () => {
    const out = lerpPoseFrame({ frames, fps, currentTime: -1 });
    expect(out?.[0].x).toBe(0);
  });

  it('clamps to the last frame when currentTime is past the clip', () => {
    const out = lerpPoseFrame({ frames, fps, currentTime: 999 });
    expect(out?.[0].x).toBe(2); // last frame's xBase
  });

  it('returns the floor frame exactly when time lands on a stored frame', () => {
    // fps=4 → frame 1 is at t=0.25
    const out = lerpPoseFrame({ frames, fps, currentTime: 0.25 });
    expect(out?.[0].x).toBe(1);
  });

  it('lerps halfway between two stored frames', () => {
    // t=0.375 → frameIdxFloat=1.5 → midpoint of frame 1 (x=1) and frame 2 (x=2)
    const out = lerpPoseFrame({ frames, fps, currentTime: 0.375 });
    expect(out?.[0].x).toBeCloseTo(1.5, 6);
  });

  it('does not lerp visibility — uses the floor frame value', () => {
    const a = Array.from({ length: 2 }, () => lm(0, 0, 0.2)) as PoseFrame;
    const b = Array.from({ length: 2 }, () => lm(1, 1, 1.0)) as PoseFrame;
    const out = lerpPoseFrame({
      frames: [a, b],
      fps: 1,
      currentTime: 0.5,
    });
    // x/y lerped, visibility pinned to floor frame (0.2)
    expect(out?.[0].x).toBeCloseTo(0.5);
    expect(out?.[0].visibility).toBe(0.2);
  });
});
