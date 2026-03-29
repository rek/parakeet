import { describe, expect, it } from 'vitest';

import type { VideoAnalysisResult } from '@parakeet/shared-types';

import { assembleCoachingContext } from '../assemble-coaching-context';

function makeAnalysis(reps: Array<{ barDriftCm?: number; forwardLeanDeg?: number; maxDepthCm?: number }>): VideoAnalysisResult {
  return {
    fps: 15,
    cameraAngle: 'side',
    analysisVersion: 1,
    reps: reps.map((r, i) => ({
      repNumber: i + 1,
      startFrame: i * 30,
      endFrame: (i + 1) * 30,
      barPath: [],
      faults: [],
      ...r,
    })),
  };
}

describe('assembleCoachingContext', () => {
  const baseAnalysis = makeAnalysis([
    { barDriftCm: 3, forwardLeanDeg: 42, maxDepthCm: -4 },
  ]);

  it('extracts weight from actual_sets weight_grams', () => {
    const ctx = assembleCoachingContext({
      analysis: baseAnalysis,
      lift: 'squat',
      session: null,
      log: {
        session_rpe: 8,
        actual_sets: [{ weight_grams: 140000 }, { weight_grams: 140000 }],
      },
      jitSnapshot: null,
      previousAnalyses: [],
    });

    expect(ctx.weightKg).toBe(140);
  });

  it('extracts weight from weight_kg when weight_grams missing', () => {
    const ctx = assembleCoachingContext({
      analysis: baseAnalysis,
      lift: 'squat',
      session: null,
      log: {
        session_rpe: 7,
        actual_sets: [{ weight_kg: 100 }],
      },
      jitSnapshot: null,
      previousAnalyses: [],
    });

    expect(ctx.weightKg).toBe(100);
  });

  it('returns null weight when no log', () => {
    const ctx = assembleCoachingContext({
      analysis: baseAnalysis,
      lift: 'squat',
      session: null,
      log: null,
      jitSnapshot: null,
      previousAnalyses: [],
    });

    expect(ctx.weightKg).toBeNull();
  });

  it('extracts session context from session object', () => {
    const ctx = assembleCoachingContext({
      analysis: baseAnalysis,
      lift: 'bench',
      session: {
        block_number: 2,
        week_number: 3,
        intensity_type: 'heavy',
        is_deload: false,
      },
      log: null,
      jitSnapshot: null,
      previousAnalyses: [],
    });

    expect(ctx.blockNumber).toBe(2);
    expect(ctx.weekNumber).toBe(3);
    expect(ctx.intensityType).toBe('heavy');
    expect(ctx.isDeload).toBe(false);
  });

  it('extracts soreness and readiness from jitSnapshot', () => {
    const ctx = assembleCoachingContext({
      analysis: baseAnalysis,
      lift: 'squat',
      session: null,
      log: null,
      jitSnapshot: {
        sorenessRatings: { quads: 6, glutes: 3 },
        sleepQuality: 2,
        energyLevel: 1,
        activeDisruptions: [{ disruption_type: 'illness', severity: 'minor' }],
      },
      previousAnalyses: [],
    });

    expect(ctx.sorenessRatings).toEqual({ quads: 6, glutes: 3 });
    expect(ctx.sleepQuality).toBe(2);
    expect(ctx.energyLevel).toBe(1);
    expect(ctx.activeDisruptions).toHaveLength(1);
  });

  it('computes longitudinal averages from previous analyses', () => {
    const prev = [
      makeAnalysis([{ barDriftCm: 2, forwardLeanDeg: 40 }]),
      makeAnalysis([{ barDriftCm: 4, forwardLeanDeg: 44 }]),
    ];

    const ctx = assembleCoachingContext({
      analysis: baseAnalysis,
      lift: 'squat',
      session: null,
      log: null,
      jitSnapshot: null,
      previousAnalyses: prev,
    });

    expect(ctx.previousVideoCount).toBe(2);
    expect(ctx.averageBarDriftCm).toBeCloseTo(3, 1);
    expect(ctx.averageForwardLeanDeg).toBeCloseTo(42, 1);
  });

  it('returns null longitudinal averages when no previous analyses', () => {
    const ctx = assembleCoachingContext({
      analysis: baseAnalysis,
      lift: 'squat',
      session: null,
      log: null,
      jitSnapshot: null,
      previousAnalyses: [],
    });

    expect(ctx.previousVideoCount).toBe(0);
    expect(ctx.averageBarDriftCm).toBeNull();
    expect(ctx.averageForwardLeanDeg).toBeNull();
    expect(ctx.averageDepthCm).toBeNull();
  });

  it('nulls all optional fields when inputs are null', () => {
    const ctx = assembleCoachingContext({
      analysis: baseAnalysis,
      lift: 'deadlift',
      session: null,
      log: null,
      jitSnapshot: null,
      previousAnalyses: [],
    });

    expect(ctx.weightKg).toBeNull();
    expect(ctx.sessionRpe).toBeNull();
    expect(ctx.blockNumber).toBeNull();
    expect(ctx.weekNumber).toBeNull();
    expect(ctx.intensityType).toBeNull();
    expect(ctx.sorenessRatings).toBeNull();
    expect(ctx.sleepQuality).toBeNull();
    expect(ctx.energyLevel).toBeNull();
    expect(ctx.activeDisruptions).toBeNull();
  });
});
