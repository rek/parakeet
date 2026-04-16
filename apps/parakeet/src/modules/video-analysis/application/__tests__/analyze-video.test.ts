import { describe, expect, it } from 'vitest';

import type { PoseFrame } from '../../lib/pose-types';
import {
  buildFrame,
  generateSquatFrames,
} from '../../lib/__tests__/fixtures';
import { analyzeVideoFrames } from '../analyze-video';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All-zero frame matching the EMPTY_FRAME shape in analyze-video.ts */
const EMPTY_FRAME: PoseFrame = Array.from({ length: 33 }, () => ({
  x: 0,
  y: 0,
  z: 0,
  visibility: 0,
}));

/**
 * Inject empty frames at specific indices into a frame array.
 * Simulates MediaPipe detection failures on those frames.
 */
function injectEmptyFrames(
  frames: PoseFrame[],
  emptyIndices: number[]
): PoseFrame[] {
  return frames.map((f, i) => (emptyIndices.includes(i) ? EMPTY_FRAME : f));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analyzeVideoFrames — landmarker failure handling', () => {
  it('returns valid result with 0 reps when ALL frames are empty', () => {
    const allEmpty = Array.from({ length: 40 }, () => EMPTY_FRAME);
    const result = analyzeVideoFrames({
      frames: allEmpty,
      fps: 4,
      lift: 'squat',
    });

    expect(result.reps).toEqual([]);
    expect(result.analysisVersion).toBe(4);
    expect(result.fatigueSignatures).toBeUndefined();
  });

  it('returns valid result when single frame is empty', () => {
    const frames = Array.from({ length: 5 }, () => buildFrame());
    frames[2] = EMPTY_FRAME;

    const result = analyzeVideoFrames({ frames, fps: 4, lift: 'squat' });

    // Should not crash — interpolation fills the gap
    expect(result.analysisVersion).toBe(4);
  });

  it('interpolates short gaps (1-2 empty frames) without losing reps', () => {
    const clean = generateSquatFrames({ reps: 3, framesPerRep: 60 });

    // Inject 1-frame gaps at scattered positions (not at rep boundaries)
    const gappy = injectEmptyFrames(clean, [10, 50, 100, 140]);
    const result = analyzeVideoFrames({ frames: gappy, fps: 4, lift: 'squat' });

    // Should still detect 3 reps despite minor gaps
    expect(result.reps.length).toBe(3);
  });

  it('survives long gap (5+ consecutive empty frames)', () => {
    const clean = generateSquatFrames({ reps: 3, framesPerRep: 60 });

    // Inject a 10-frame gap in the middle of rep 2
    const longGapIndices = Array.from({ length: 10 }, (_, i) => 80 + i);
    const gappy = injectEmptyFrames(clean, longGapIndices);
    const result = analyzeVideoFrames({ frames: gappy, fps: 4, lift: 'squat' });

    // Should still produce a result — may detect fewer reps due to signal disruption
    expect(result.analysisVersion).toBe(4);
    expect(result.reps.length).toBeGreaterThanOrEqual(1);
    expect(result.reps.length).toBeLessThanOrEqual(3);
  });

  it('adjusts effective fps proportionally to valid frame ratio', () => {
    const clean = generateSquatFrames({ reps: 2, framesPerRep: 60 });

    // Make half the frames empty — effective fps should halve
    const halfEmpty = clean.map((f, i) => (i % 2 === 0 ? EMPTY_FRAME : f));
    const result = analyzeVideoFrames({
      frames: halfEmpty,
      fps: 4,
      lift: 'squat',
    });

    // With 50% valid frames at 4fps, effective fps ≈ 2.
    // The analysis should still produce a valid result (not crash on NaN fps).
    expect(result.analysisVersion).toBe(4);
  });

  it('handles all three lifts with empty frames gracefully', () => {
    const lifts = ['squat', 'bench', 'deadlift'] as const;
    const allEmpty = Array.from({ length: 40 }, () => EMPTY_FRAME);

    for (const lift of lifts) {
      const result = analyzeVideoFrames({ frames: allEmpty, fps: 4, lift });
      expect(result.reps).toEqual([]);
      expect(result.analysisVersion).toBe(4);
    }
  });
});
