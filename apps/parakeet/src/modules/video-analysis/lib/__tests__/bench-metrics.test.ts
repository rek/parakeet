import type { BarPathPoint } from '@parakeet/shared-types';
import { describe, expect, it } from 'vitest';

import { computeElbowFlare } from '../elbow-flare';
import { assessPauseQuality } from '../pause-quality';
import { LANDMARK } from '../pose-types';
import type { PoseFrame, PoseLandmark } from '../pose-types';

function makeLandmark(x: number, y: number): PoseLandmark {
  return { x, y, z: 0, visibility: 1 };
}

function makeFrame(overrides: Record<number, PoseLandmark>): PoseFrame {
  const frame: PoseFrame = Array.from({ length: 33 }, () =>
    makeLandmark(0.5, 0.5)
  );
  for (const [idx, lm] of Object.entries(overrides)) {
    frame[Number(idx)] = lm;
  }
  return frame;
}

// ---------------------------------------------------------------------------
// Geometry helpers
//
// computeElbowFlare places the vertex at the shoulder and measures the angle
// between the shoulder→elbow ray and the shoulder→hip ray.
//
// For all cases below both sides are symmetric so the average equals each side.
// Shoulder at (0.5, 0.3), hip straight down at (0.5, 0.6).
// Elbow is placed at angle θ from the downward hip direction:
//   elbow = (0.5 + sin(θ)×r, 0.3 + cos(θ)×r)   (r = arm length in normalized units)
// ---------------------------------------------------------------------------

describe('computeElbowFlare', () => {
  it('returns ~60° for optimal flare', () => {
    // Elbow at 60° from downward hip ray
    // sin(60°)=0.866, cos(60°)=0.5  →  elbow=(0.5+0.866×0.2, 0.3+0.5×0.2)=(0.673, 0.4)
    const frame = makeFrame({
      [LANDMARK.LEFT_SHOULDER]: makeLandmark(0.5, 0.3),
      [LANDMARK.LEFT_ELBOW]: makeLandmark(0.673, 0.4),
      [LANDMARK.LEFT_HIP]: makeLandmark(0.5, 0.6),
      [LANDMARK.RIGHT_SHOULDER]: makeLandmark(0.5, 0.3),
      [LANDMARK.RIGHT_ELBOW]: makeLandmark(0.673, 0.4),
      [LANDMARK.RIGHT_HIP]: makeLandmark(0.5, 0.6),
    });
    expect(computeElbowFlare({ frame })).toBeCloseTo(60, 0);
  });

  it('returns ~85° for excessive flare', () => {
    // Elbow at 85° from downward hip ray
    // sin(85°)≈0.996, cos(85°)≈0.087  →  elbow=(0.5+0.199, 0.3+0.017)=(0.699, 0.317)
    const frame = makeFrame({
      [LANDMARK.LEFT_SHOULDER]: makeLandmark(0.5, 0.3),
      [LANDMARK.LEFT_ELBOW]: makeLandmark(0.699, 0.317),
      [LANDMARK.LEFT_HIP]: makeLandmark(0.5, 0.6),
      [LANDMARK.RIGHT_SHOULDER]: makeLandmark(0.5, 0.3),
      [LANDMARK.RIGHT_ELBOW]: makeLandmark(0.699, 0.317),
      [LANDMARK.RIGHT_HIP]: makeLandmark(0.5, 0.6),
    });
    expect(computeElbowFlare({ frame })).toBeCloseTo(85, 0);
  });

  it('returns ~25° for overtucked elbows', () => {
    // Elbow at 25° from downward hip ray
    // sin(25°)≈0.423, cos(25°)≈0.906  →  elbow=(0.5+0.085, 0.3+0.181)=(0.585, 0.481)
    const frame = makeFrame({
      [LANDMARK.LEFT_SHOULDER]: makeLandmark(0.5, 0.3),
      [LANDMARK.LEFT_ELBOW]: makeLandmark(0.585, 0.481),
      [LANDMARK.LEFT_HIP]: makeLandmark(0.5, 0.6),
      [LANDMARK.RIGHT_SHOULDER]: makeLandmark(0.5, 0.3),
      [LANDMARK.RIGHT_ELBOW]: makeLandmark(0.585, 0.481),
      [LANDMARK.RIGHT_HIP]: makeLandmark(0.5, 0.6),
    });
    expect(computeElbowFlare({ frame })).toBeCloseTo(25, 0);
  });
});

// ---------------------------------------------------------------------------
// assessPauseQuality
//
// Bar path Y: higher value = lower bar position (MediaPipe Y increases downward).
// PAUSE_VELOCITY_THRESHOLD = 5 cm/s; CM_PER_UNIT = 243.
// A velocity of 5 cm/s over 1 frame at 30fps (dt=1/30s) requires ΔY = 5/30/243 ≈ 0.000686.
// Steps smaller than this are considered paused.
// ---------------------------------------------------------------------------

/** Build a BarPathPoint array from a Y-value array. */
function makeRepPath(ys: number[]): BarPathPoint[] {
  return ys.map((y, frame) => ({ x: 0.5, y, frame }));
}

describe('assessPauseQuality', () => {
  it('detects a clean pause lasting ~0.5s', () => {
    // At 30fps, 0.5s = 15 frames. Build: descent (5 frames), plateau (15 frames), ascent (5 frames).
    // Descent: 0.30 → 0.55 (5 steps of 0.05 each = 12.15 cm/frame > threshold, just movement)
    // Plateau: y=0.55 for 15 frames (ΔY=0, velocity=0 < threshold)
    // Ascent:  0.55 → 0.30 (5 steps of 0.05 each)
    const descent = Array.from({ length: 6 }, (_, i) => 0.3 + i * 0.05); // 0.30..0.55
    const plateau = Array.from({ length: 15 }, () => 0.55);
    const ascent = Array.from({ length: 5 }, (_, i) => 0.55 - (i + 1) * 0.05); // 0.50..0.30
    const repPath = makeRepPath([...descent, ...plateau, ...ascent]);

    const result = assessPauseQuality({ repPath, fps: 30 });

    expect(result.pauseDurationSec).toBeGreaterThan(0);
    expect(result.isSinking).toBe(false);
  });

  it('detects sinking when Y continues increasing after the bar enters the low-velocity zone', () => {
    // Descent frames: ΔY = 0.05 per frame = 12.15 cm/frame at 30fps — well above threshold.
    // After descent the bar enters a low-velocity zone but Y still creeps up (sinking).
    // Low-velocity steps: ΔY = 0.0005 per frame = 0.121 cm/frame — below 5 cm/s threshold.
    // pauseStart will be the first low-velocity frame; pauseStart+2 has higher Y → isSinking.
    const repPath = makeRepPath([
      0.3, // frame 0 — fast descent
      0.35, // frame 1 — fast descent
      0.4, // frame 2 — fast descent
      0.45, // frame 3 — fast descent
      0.5, // frame 4 — fast descent → first low-vel transition
      0.5005, // frame 5 — slow, still sinking (pauseStart)
      0.501, // frame 6 — slow, still sinking (pauseStart+1)
      0.5015, // frame 7 — slow, still sinking (pauseStart+2; y > pauseStart → isSinking)
      0.501, // frame 8 — slow, settling
      0.45, // frame 9 — fast ascent
      0.4, // frame 10
    ]);

    const result = assessPauseQuality({ repPath, fps: 30 });

    expect(result.isSinking).toBe(true);
  });

  it('returns near-zero pause for a touch-and-go rep', () => {
    // Each frame moves 0.05 normalized units = 12.15 cm/frame at 30fps (far above threshold).
    // Descent to bottom (index 5) then immediate ascent — no low-velocity frames.
    const repPath = makeRepPath([
      0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3,
    ]);

    const result = assessPauseQuality({ repPath, fps: 30 });

    expect(result.pauseDurationSec).toBeCloseTo(0, 1);
    expect(result.isSinking).toBe(false);
  });

  it('returns zero pause and no sinking for fewer than 3 frames', () => {
    const result = assessPauseQuality({
      repPath: makeRepPath([0.3, 0.5]),
      fps: 30,
    });

    expect(result.pauseDurationSec).toBe(0);
    expect(result.isSinking).toBe(false);
  });
});
