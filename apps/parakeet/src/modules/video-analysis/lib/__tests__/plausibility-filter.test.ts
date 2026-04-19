import { describe, expect, it } from 'vitest';

import { filterImplausibleFrames } from '../plausibility-filter';
import { LANDMARK, type PoseFrame, type PoseLandmark } from '../pose-types';

function makeLandmark(
  x: number,
  y: number,
  visibility = 1
): PoseLandmark {
  return { x, y, z: 0, visibility };
}

function makeConfidentFrame(opts?: {
  shoulderX?: number;
  shoulderY?: number;
  hipY?: number;
  coreVisibility?: number;
}): PoseFrame {
  const shoulderX = opts?.shoulderX ?? 0.5;
  const shoulderY = opts?.shoulderY ?? 0.3;
  const hipY = opts?.hipY ?? 0.6;
  const v = opts?.coreVisibility ?? 1;
  const frame: PoseFrame = Array.from({ length: 33 }, () =>
    makeLandmark(0.5, 0.5)
  );
  frame[LANDMARK.LEFT_SHOULDER] = makeLandmark(shoulderX - 0.05, shoulderY, v);
  frame[LANDMARK.RIGHT_SHOULDER] = makeLandmark(shoulderX + 0.05, shoulderY, v);
  frame[LANDMARK.LEFT_ELBOW] = makeLandmark(shoulderX - 0.08, 0.45, v);
  frame[LANDMARK.RIGHT_ELBOW] = makeLandmark(shoulderX + 0.08, 0.45, v);
  frame[LANDMARK.LEFT_WRIST] = makeLandmark(shoulderX - 0.1, 0.55, v);
  frame[LANDMARK.RIGHT_WRIST] = makeLandmark(shoulderX + 0.1, 0.55, v);
  frame[LANDMARK.LEFT_HIP] = makeLandmark(shoulderX - 0.05, hipY, v);
  frame[LANDMARK.RIGHT_HIP] = makeLandmark(shoulderX + 0.05, hipY, v);
  frame[LANDMARK.LEFT_KNEE] = makeLandmark(shoulderX - 0.05, 0.75, v);
  frame[LANDMARK.RIGHT_KNEE] = makeLandmark(shoulderX + 0.05, 0.75, v);
  frame[LANDMARK.LEFT_ANKLE] = makeLandmark(shoulderX - 0.05, 0.9, v);
  frame[LANDMARK.RIGHT_ANKLE] = makeLandmark(shoulderX + 0.05, 0.9, v);
  return frame;
}

function isEmptyFrame(f: PoseFrame) {
  return f[0].visibility === 0 && f[0].x === 0 && f[0].y === 0;
}

describe('filterImplausibleFrames', () => {
  it('passes a clean clip through untouched', () => {
    const frames = Array.from({ length: 10 }, () => makeConfidentFrame());
    const result = filterImplausibleFrames({ frames });
    expect(result.lowVisibilityRejected).toBe(0);
    expect(result.torsoJumpRejected).toBe(0);
    expect(result.frames.every((f) => !isEmptyFrame(f))).toBe(true);
  });

  it('rejects a single face-occluded frame (low median visibility)', () => {
    const frames = Array.from({ length: 10 }, () => makeConfidentFrame());
    frames[5] = makeConfidentFrame({ coreVisibility: 0.15 }); // below 0.3 threshold
    const result = filterImplausibleFrames({ frames });
    expect(result.lowVisibilityRejected).toBe(1);
    expect(isEmptyFrame(result.frames[5])).toBe(true);
    expect(isEmptyFrame(result.frames[4])).toBe(false);
    expect(isEmptyFrame(result.frames[6])).toBe(false);
  });

  it('rejects a torso jump that exceeds 5× the clip median', () => {
    // Base clip: shoulders drift slowly (jump ~0.005 per frame).
    const frames: PoseFrame[] = [];
    for (let i = 0; i < 20; i++) {
      frames.push(makeConfidentFrame({ shoulderX: 0.5 + i * 0.005 }));
    }
    // Frame 10: skeleton "snaps" to a feature 0.25 units away (huge jump).
    frames[10] = makeConfidentFrame({ shoulderX: 0.5 + 10 * 0.005 + 0.25 });
    const result = filterImplausibleFrames({ frames });
    expect(result.torsoJumpRejected).toBeGreaterThanOrEqual(1);
    expect(isEmptyFrame(result.frames[10])).toBe(true);
  });

  it('does not reject natural bench motion (lockout ↔ chest touch)', () => {
    // Alternate between two "real" positions that differ by 0.05 — typical of
    // wrists moving between lockout and chest. Shoulders stay still.
    const frames: PoseFrame[] = [];
    for (let i = 0; i < 20; i++) {
      frames.push(makeConfidentFrame({ shoulderY: 0.3 + (i % 2) * 0.05 }));
    }
    const result = filterImplausibleFrames({ frames });
    expect(result.torsoJumpRejected).toBe(0);
  });

  it('ignores empty frames — empty-in, empty-out', () => {
    const frames = Array.from({ length: 5 }, () => makeConfidentFrame());
    frames[2] = Array.from({ length: 33 }, () =>
      makeLandmark(0, 0, 0)
    ) as PoseFrame;
    const result = filterImplausibleFrames({ frames });
    expect(result.lowVisibilityRejected).toBe(0);
    expect(result.torsoJumpRejected).toBe(0);
    expect(isEmptyFrame(result.frames[2])).toBe(true);
  });

  it('handles empty input', () => {
    const result = filterImplausibleFrames({ frames: [] });
    expect(result).toEqual({
      frames: [],
      lowVisibilityRejected: 0,
      torsoJumpRejected: 0,
      medianTorsoJump: 0,
    });
  });

  it('measures jump against last confident frame, not the rejected one', () => {
    // Three frames in a row get a huge torso jump. Without the "last
    // confident" anchor, frame 2's jump back would also read as implausible.
    // With the anchor, only frame 1 is rejected; frames 2 onward return to
    // the confident baseline.
    const frames: PoseFrame[] = [];
    for (let i = 0; i < 20; i++) {
      frames.push(makeConfidentFrame({ shoulderX: 0.5 }));
    }
    frames[10] = makeConfidentFrame({ shoulderX: 0.9 }); // snap away
    frames[11] = makeConfidentFrame({ shoulderX: 0.5 }); // snap back — legal
    const result = filterImplausibleFrames({ frames });
    expect(result.torsoJumpRejected).toBe(1);
    expect(isEmptyFrame(result.frames[10])).toBe(true);
    expect(isEmptyFrame(result.frames[11])).toBe(false);
  });
});
