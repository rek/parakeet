import type { BarPathPoint } from '@parakeet/shared-types';
import { describe, expect, it } from 'vitest';

import { assessPauseQuality } from '../pause-quality';

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
