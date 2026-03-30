import { describe, expect, it } from 'vitest';

import {
  computePersonalBaseline,
  detectBaselineDeviations,
  MIN_VIDEOS_FOR_BASELINE,
} from '../personal-baseline';
import type { VideoAnalysisResult, RepAnalysis } from '@parakeet/shared-types';

function makeAnalysis({
  reps,
}: {
  reps: Partial<RepAnalysis>[];
}): VideoAnalysisResult {
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

describe('computePersonalBaseline', () => {
  it('returns null with fewer than MIN_VIDEOS_FOR_BASELINE analyses', () => {
    const analyses = Array.from({ length: MIN_VIDEOS_FOR_BASELINE - 1 }, () =>
      makeAnalysis({ reps: [{ barDriftCm: 2, forwardLeanDeg: 40, romCm: 50 }] }),
    );
    expect(computePersonalBaseline({ analyses })).toBeNull();
  });

  it('computes baseline from 5+ analyses', () => {
    const analyses = Array.from({ length: 6 }, (_, i) =>
      makeAnalysis({
        reps: [
          { barDriftCm: 2 + i * 0.5, forwardLeanDeg: 40 + i, romCm: 50 + i },
        ],
      }),
    );

    const baseline = computePersonalBaseline({ analyses });
    expect(baseline).not.toBeNull();
    expect(baseline!.videoCount).toBe(6);
    expect(baseline!.avgBarDriftCm).toBeCloseTo(3.25, 1);
    expect(baseline!.avgForwardLeanDeg).toBeCloseTo(42.5, 1);
    expect(baseline!.avgRomCm).toBeCloseTo(52.5, 1);
    expect(baseline!.sdBarDriftCm).toBeGreaterThan(0);
  });

  it('handles squat depth when present', () => {
    const analyses = Array.from({ length: 5 }, (_, i) =>
      makeAnalysis({
        reps: [
          {
            barDriftCm: 2,
            forwardLeanDeg: 40,
            romCm: 50,
            maxDepthCm: 3 + i,
          },
        ],
      }),
    );

    const baseline = computePersonalBaseline({ analyses });
    expect(baseline!.avgDepthCm).toBeCloseTo(5, 1);
  });

  it('returns null depth when no reps have maxDepthCm', () => {
    const analyses = Array.from({ length: 5 }, () =>
      makeAnalysis({
        reps: [{ barDriftCm: 2, forwardLeanDeg: 40, romCm: 50 }],
      }),
    );

    const baseline = computePersonalBaseline({ analyses });
    expect(baseline!.avgDepthCm).toBeNull();
  });

  it('skips analyses with no reps', () => {
    const withReps = Array.from({ length: 5 }, () =>
      makeAnalysis({
        reps: [{ barDriftCm: 2, forwardLeanDeg: 40, romCm: 50 }],
      }),
    );
    const empty = makeAnalysis({ reps: [] });
    const analyses = [...withReps, empty];

    const baseline = computePersonalBaseline({ analyses });
    expect(baseline!.videoCount).toBe(5);
  });
});

describe('detectBaselineDeviations', () => {
  const baseline = {
    videoCount: 10,
    avgBarDriftCm: 3,
    avgForwardLeanDeg: 42,
    avgRomCm: 52,
    avgDepthCm: 4,
    avgKneeAngleDeg: null,
    avgHipAngleAtLockoutDeg: null,
    sdBarDriftCm: 1,
    sdForwardLeanDeg: 3,
    sdRomCm: 4,
  };

  it('returns empty array when rep is within baseline', () => {
    const rep: RepAnalysis = {
      repNumber: 1,
      startFrame: 0,
      endFrame: 30,
      barPath: [],
      barDriftCm: 3.5,
      forwardLeanDeg: 43,
      romCm: 51,
      faults: [],
    };

    const deviations = detectBaselineDeviations({
      rep,
      baseline,
      lift: 'squat',
    });
    expect(deviations).toHaveLength(0);
  });

  it('flags bar drift worse when significantly higher than baseline', () => {
    const rep: RepAnalysis = {
      repNumber: 1,
      startFrame: 0,
      endFrame: 30,
      barPath: [],
      barDriftCm: 6, // 3 SDs above mean
      forwardLeanDeg: 42,
      romCm: 52,
      faults: [],
    };

    const deviations = detectBaselineDeviations({
      rep,
      baseline,
      lift: 'squat',
    });
    const driftDev = deviations.find((d) => d.metric === 'barDriftCm');
    expect(driftDev).toBeDefined();
    expect(driftDev!.direction).toBe('worse');
    expect(driftDev!.zScore).toBeCloseTo(3, 0);
  });

  it('flags bar drift better when significantly lower than baseline', () => {
    const rep: RepAnalysis = {
      repNumber: 1,
      startFrame: 0,
      endFrame: 30,
      barPath: [],
      barDriftCm: 0.5, // 2.5 SDs below mean
      forwardLeanDeg: 42,
      romCm: 52,
      faults: [],
    };

    const deviations = detectBaselineDeviations({
      rep,
      baseline,
      lift: 'squat',
    });
    const driftDev = deviations.find((d) => d.metric === 'barDriftCm');
    expect(driftDev).toBeDefined();
    expect(driftDev!.direction).toBe('better');
  });

  it('flags ROM better when significantly higher', () => {
    const rep: RepAnalysis = {
      repNumber: 1,
      startFrame: 0,
      endFrame: 30,
      barPath: [],
      barDriftCm: 3,
      forwardLeanDeg: 42,
      romCm: 62, // 2.5 SDs above mean
      faults: [],
    };

    const deviations = detectBaselineDeviations({
      rep,
      baseline,
      lift: 'squat',
    });
    const romDev = deviations.find((d) => d.metric === 'romCm');
    expect(romDev).toBeDefined();
    expect(romDev!.direction).toBe('better');
  });

  it('flags squat depth worse when shallower than baseline', () => {
    const rep: RepAnalysis = {
      repNumber: 1,
      startFrame: 0,
      endFrame: 30,
      barPath: [],
      barDriftCm: 3,
      forwardLeanDeg: 42,
      romCm: 52,
      maxDepthCm: -1, // above parallel (negative), baseline was +4
      faults: [],
    };

    const deviations = detectBaselineDeviations({
      rep,
      baseline,
      lift: 'squat',
    });
    const depthDev = deviations.find((d) => d.metric === 'maxDepthCm');
    expect(depthDev).toBeDefined();
    expect(depthDev!.direction).toBe('worse');
  });

  it('flags squat depth better when deeper than baseline', () => {
    const rep: RepAnalysis = {
      repNumber: 1,
      startFrame: 0,
      endFrame: 30,
      barPath: [],
      barDriftCm: 3,
      forwardLeanDeg: 42,
      romCm: 52,
      maxDepthCm: 8, // much deeper than baseline (+4)
      faults: [],
    };

    const deviations = detectBaselineDeviations({
      rep,
      baseline,
      lift: 'squat',
    });
    const depthDev = deviations.find((d) => d.metric === 'maxDepthCm');
    expect(depthDev).toBeDefined();
    expect(depthDev!.direction).toBe('better');
  });

  it('does not flag depth for non-squat lifts', () => {
    const rep: RepAnalysis = {
      repNumber: 1,
      startFrame: 0,
      endFrame: 30,
      barPath: [],
      barDriftCm: 3,
      forwardLeanDeg: 42,
      romCm: 52,
      maxDepthCm: -10,
      faults: [],
    };

    const deviations = detectBaselineDeviations({
      rep,
      baseline,
      lift: 'deadlift',
    });
    expect(deviations.find((d) => d.metric === 'maxDepthCm')).toBeUndefined();
  });
});
