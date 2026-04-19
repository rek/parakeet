import { describe, expect, it } from 'vitest';

import { LANDMARK, type PoseFrame, type PoseLandmark } from '../pose-types';
import {
  reconstructBenchFrame,
  reconstructBenchRejections,
} from '../wrist-anchored-reconstruct';

function makeLandmark(
  x: number,
  y: number,
  visibility = 1
): PoseLandmark {
  return { x, y, z: 0, visibility };
}

const EMPTY: PoseFrame = Array.from({ length: 33 }, () =>
  makeLandmark(0, 0, 0)
);

function makeConfidentFrame(opts?: {
  shoulderY?: number;
  wristY?: number;
}): PoseFrame {
  const shoulderY = opts?.shoulderY ?? 0.3;
  const wristY = opts?.wristY ?? 0.55;
  const frame: PoseFrame = Array.from({ length: 33 }, () =>
    makeLandmark(0.5, 0.5)
  );
  frame[LANDMARK.LEFT_SHOULDER] = makeLandmark(0.4, shoulderY);
  frame[LANDMARK.RIGHT_SHOULDER] = makeLandmark(0.6, shoulderY);
  frame[LANDMARK.LEFT_ELBOW] = makeLandmark(0.38, 0.45);
  frame[LANDMARK.RIGHT_ELBOW] = makeLandmark(0.62, 0.45);
  frame[LANDMARK.LEFT_WRIST] = makeLandmark(0.4, wristY);
  frame[LANDMARK.RIGHT_WRIST] = makeLandmark(0.6, wristY);
  frame[LANDMARK.LEFT_HIP] = makeLandmark(0.45, 0.6);
  frame[LANDMARK.RIGHT_HIP] = makeLandmark(0.55, 0.6);
  return frame;
}

describe('reconstructBenchFrame', () => {
  it('keeps the rejected frame wrists verbatim', () => {
    const anchor = makeConfidentFrame({ wristY: 0.3 }); // lockout
    const rejected = makeConfidentFrame({ wristY: 0.55 }); // chest touch
    const rebuilt = reconstructBenchFrame({
      rejectedFrame: rejected,
      anchorFrame: anchor,
    })!;
    expect(rebuilt[LANDMARK.LEFT_WRIST].y).toBeCloseTo(0.55, 3);
    expect(rebuilt[LANDMARK.RIGHT_WRIST].y).toBeCloseTo(0.55, 3);
  });

  it('holds shoulders at anchor position', () => {
    const anchor = makeConfidentFrame({ shoulderY: 0.3 });
    const rejected = makeConfidentFrame(); // would claim drifted shoulders
    rejected[LANDMARK.LEFT_SHOULDER] = makeLandmark(0.1, 0.9); // garbage
    rejected[LANDMARK.RIGHT_SHOULDER] = makeLandmark(0.9, 0.9); // garbage
    const rebuilt = reconstructBenchFrame({
      rejectedFrame: rejected,
      anchorFrame: anchor,
    })!;
    expect(rebuilt[LANDMARK.LEFT_SHOULDER].x).toBeCloseTo(0.4, 3);
    expect(rebuilt[LANDMARK.LEFT_SHOULDER].y).toBeCloseTo(0.3, 3);
    expect(rebuilt[LANDMARK.RIGHT_SHOULDER].x).toBeCloseTo(0.6, 3);
  });

  it('places elbows at midpoint of shoulder → wrist', () => {
    const anchor = makeConfidentFrame({ shoulderY: 0.3, wristY: 0.3 });
    const rejected = makeConfidentFrame({ wristY: 0.55 });
    const rebuilt = reconstructBenchFrame({
      rejectedFrame: rejected,
      anchorFrame: anchor,
    })!;
    // Shoulder at (0.4, 0.3), wrist at (0.4, 0.55) → elbow at (0.4, 0.425).
    expect(rebuilt[LANDMARK.LEFT_ELBOW].x).toBeCloseTo(0.4, 3);
    expect(rebuilt[LANDMARK.LEFT_ELBOW].y).toBeCloseTo(0.425, 3);
  });

  it('returns null when rejected frame wrists are not usable', () => {
    const anchor = makeConfidentFrame();
    const rejected = makeConfidentFrame();
    rejected[LANDMARK.LEFT_WRIST].visibility = 0.2;
    expect(
      reconstructBenchFrame({ rejectedFrame: rejected, anchorFrame: anchor })
    ).toBeNull();
  });

  it('returns null when anchor shoulders are not usable', () => {
    const anchor = makeConfidentFrame();
    anchor[LANDMARK.LEFT_SHOULDER].visibility = 0.2;
    const rejected = makeConfidentFrame();
    expect(
      reconstructBenchFrame({ rejectedFrame: rejected, anchorFrame: anchor })
    ).toBeNull();
  });

  it('scales non-observed landmark visibility down', () => {
    const anchor = makeConfidentFrame();
    const rejected = makeConfidentFrame();
    const rebuilt = reconstructBenchFrame({
      rejectedFrame: rejected,
      anchorFrame: anchor,
    })!;
    // Hips were held from anchor (visibility 1) then scaled to 0.7.
    expect(rebuilt[LANDMARK.LEFT_HIP].visibility).toBeCloseTo(0.7, 3);
    // Wrists were observed — verbatim visibility.
    expect(rebuilt[LANDMARK.LEFT_WRIST].visibility).toBe(1);
  });

  it('floors held-landmark visibility at VIS_THRESHOLD (0.5)', () => {
    // Anchor hip at 0.6 → naive 0.42 scaled would silently fail per-landmark
    // gates downstream. Floored at 0.5, the landmark stays usable.
    const anchor = makeConfidentFrame();
    anchor[LANDMARK.LEFT_HIP].visibility = 0.6;
    const rejected = makeConfidentFrame();
    const rebuilt = reconstructBenchFrame({
      rejectedFrame: rejected,
      anchorFrame: anchor,
    })!;
    expect(rebuilt[LANDMARK.LEFT_HIP].visibility).toBeCloseTo(0.5, 3);
  });

  it('prefers nearest-by-distance anchor (ties break backward)', () => {
    // Backward anchor at idx 0 (distance 3, shoulder Y = 0.30).
    // Forward anchor at idx 4 (distance 1, shoulder Y = 0.35).
    // Rejected wrist at Y = 0.40.
    //   Forward  → elbow Y = (0.35 + 0.40) / 2 = 0.375.
    //   Backward → elbow Y = (0.30 + 0.40) / 2 = 0.35.
    const originalFrames: PoseFrame[] = [
      makeConfidentFrame({ shoulderY: 0.3 }),
      Array.from({ length: 33 }, () => makeLandmark(0, 0, 0)),
      Array.from({ length: 33 }, () => makeLandmark(0, 0, 0)),
      makeConfidentFrame({ wristY: 0.4 }), // rejected slot — wrist visible
      makeConfidentFrame({ shoulderY: 0.35 }),
    ];
    const filteredFrames: PoseFrame[] = originalFrames.map((f) => f);
    filteredFrames[3] = Array.from({ length: 33 }, () => makeLandmark(0, 0, 0));
    const count = reconstructBenchRejections({ originalFrames, filteredFrames });
    expect(count).toBe(1);
    expect(filteredFrames[3][LANDMARK.LEFT_ELBOW].y).toBeCloseTo(0.375, 3);
  });
});

describe('reconstructBenchRejections', () => {
  it('rebuilds rejected frames when wrists are still visible', () => {
    const originalFrames: PoseFrame[] = [
      makeConfidentFrame({ wristY: 0.3 }),
      makeConfidentFrame({ wristY: 0.55 }), // this one is rejected
      makeConfidentFrame({ wristY: 0.3 }),
    ];
    const filteredFrames: PoseFrame[] = [
      originalFrames[0],
      EMPTY.map((lm) => ({ ...lm })),
      originalFrames[2],
    ];
    const count = reconstructBenchRejections({ originalFrames, filteredFrames });
    expect(count).toBe(1);
    expect(filteredFrames[1][LANDMARK.LEFT_WRIST].y).toBeCloseTo(0.55, 3);
  });

  it('leaves frames whose original wrists were also garbage', () => {
    const broken = makeConfidentFrame();
    broken[LANDMARK.LEFT_WRIST].visibility = 0;
    broken[LANDMARK.RIGHT_WRIST].visibility = 0;
    const originalFrames: PoseFrame[] = [makeConfidentFrame(), broken];
    const filteredFrames: PoseFrame[] = [
      originalFrames[0],
      EMPTY.map((lm) => ({ ...lm })),
    ];
    const count = reconstructBenchRejections({ originalFrames, filteredFrames });
    expect(count).toBe(0);
    expect(filteredFrames[1][0].visibility).toBe(0);
  });

  it('does not touch frames that were never rejected', () => {
    const originalFrames: PoseFrame[] = [
      makeConfidentFrame(),
      makeConfidentFrame(),
    ];
    const filteredFrames: PoseFrame[] = [
      originalFrames[0],
      originalFrames[1],
    ];
    const count = reconstructBenchRejections({ originalFrames, filteredFrames });
    expect(count).toBe(0);
  });

  it('ignores frames that were empty upstream (pre-plausibility)', () => {
    const originalFrames: PoseFrame[] = [
      makeConfidentFrame(),
      EMPTY.map((lm) => ({ ...lm })),
    ];
    const filteredFrames: PoseFrame[] = [
      originalFrames[0],
      EMPTY.map((lm) => ({ ...lm })),
    ];
    const count = reconstructBenchRejections({ originalFrames, filteredFrames });
    expect(count).toBe(0);
  });
});
