import { describe, expect, it } from 'vitest';

import {
  computeWeightDeviation,
  computeWorkingOneRm,
} from './weight-deviation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEstimate(estimatedOneRmKg: number | null) {
  return { estimatedOneRmKg };
}

// ---------------------------------------------------------------------------
// computeWeightDeviation
// ---------------------------------------------------------------------------

describe('computeWeightDeviation', () => {
  it('returns null when plannedWeightKg <= 0', () => {
    expect(
      computeWeightDeviation({
        plannedWeightKg: 0,
        actualSets: [{ weightKg: 100, reps: 5 }],
      })
    ).toBeNull();
    expect(
      computeWeightDeviation({
        plannedWeightKg: -10,
        actualSets: [{ weightKg: 100, reps: 5 }],
      })
    ).toBeNull();
  });

  it('returns null when actualSets is empty', () => {
    expect(
      computeWeightDeviation({ plannedWeightKg: 100, actualSets: [] })
    ).toBeNull();
  });

  it('returns null when all sets have 0 weight or 0 reps', () => {
    expect(
      computeWeightDeviation({
        plannedWeightKg: 100,
        actualSets: [
          { weightKg: 0, reps: 5 },
          { weightKg: 100, reps: 0 },
        ],
      })
    ).toBeNull();
  });

  it('returns zero deviation when planned and actual match exactly', () => {
    const result = computeWeightDeviation({
      plannedWeightKg: 100,
      actualSets: [{ weightKg: 100, reps: 5 }],
    });
    expect(result).not.toBeNull();
    expect(result!.deviationKg).toBe(0);
    expect(result!.deviationPct).toBe(0);
    expect(result!.actualMaxWeightKg).toBe(100);
    expect(result!.plannedWeightKg).toBe(100);
  });

  it('returns positive deviation when user bumps weight up', () => {
    // planned 100, sets at 100/105/100 → max 105, deviation +5, pct +0.05
    const result = computeWeightDeviation({
      plannedWeightKg: 100,
      actualSets: [
        { weightKg: 100, reps: 5 },
        { weightKg: 105, reps: 5 },
        { weightKg: 100, reps: 5 },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.actualMaxWeightKg).toBe(105);
    expect(result!.deviationKg).toBe(5);
    expect(result!.deviationPct).toBeCloseTo(0.05);
  });

  it('returns negative deviation when user drops weight', () => {
    // planned 100, actual 97.5 → deviation -2.5
    const result = computeWeightDeviation({
      plannedWeightKg: 100,
      actualSets: [{ weightKg: 97.5, reps: 5 }],
    });
    expect(result).not.toBeNull();
    expect(result!.deviationKg).toBeCloseTo(-2.5);
  });

  it('computes estimatedOneRmKg via Epley for a qualifying set', () => {
    // Epley: 1RM = weight × (1 + reps/30) → 100 × (1 + 3/30) = 110
    const result = computeWeightDeviation({
      plannedWeightKg: 100,
      actualSets: [{ weightKg: 100, reps: 3, rpe: 8.5 }],
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedOneRmKg).toBeCloseTo(110);
  });

  it('returns null estimatedOneRmKg when all sets have no RPE', () => {
    const result = computeWeightDeviation({
      plannedWeightKg: 100,
      actualSets: [{ weightKg: 100, reps: 5 }],
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedOneRmKg).toBeNull();
  });

  it('returns null estimatedOneRmKg when all sets have RPE < 7', () => {
    const result = computeWeightDeviation({
      plannedWeightKg: 100,
      actualSets: [
        { weightKg: 100, reps: 5, rpe: 6 },
        { weightKg: 102.5, reps: 5, rpe: 5.5 },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedOneRmKg).toBeNull();
  });

  it('uses the highest Epley estimate across multiple qualifying sets', () => {
    // set A: 100kg × 5 reps, RPE 8 → 100*(1+5/30) ≈ 116.67
    // set B: 105kg × 3 reps, RPE 9 → 105*(1+3/30) = 115.5
    // max should be set A
    const result = computeWeightDeviation({
      plannedWeightKg: 100,
      actualSets: [
        { weightKg: 100, reps: 5, rpe: 8 },
        { weightKg: 105, reps: 3, rpe: 9 },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedOneRmKg).toBeCloseTo(100 * (1 + 5 / 30));
  });

  it('returns weightKg as estimatedOneRmKg for a single rep (Epley identity)', () => {
    const result = computeWeightDeviation({
      plannedWeightKg: 140,
      actualSets: [{ weightKg: 140, reps: 1, rpe: 9 }],
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedOneRmKg).toBe(140);
  });

  it('qualifies sets at exactly RPE 7 (boundary)', () => {
    const result = computeWeightDeviation({
      plannedWeightKg: 100,
      actualSets: [{ weightKg: 100, reps: 5, rpe: 7 }],
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedOneRmKg).toBeCloseTo(100 * (1 + 5 / 30));
  });

  it('excludes sets at RPE 6.9 (below boundary)', () => {
    const result = computeWeightDeviation({
      plannedWeightKg: 100,
      actualSets: [{ weightKg: 100, reps: 5, rpe: 6.9 }],
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedOneRmKg).toBeNull();
  });

  it('filters out bodyweight sets (weightKg = 0) without crashing', () => {
    const result = computeWeightDeviation({
      plannedWeightKg: 100,
      actualSets: [
        { weightKg: 0, reps: 10, rpe: 8 },
        { weightKg: 100, reps: 5 },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.actualMaxWeightKg).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeWorkingOneRm
// ---------------------------------------------------------------------------

describe('computeWorkingOneRm', () => {
  it('returns stored 1RM with low confidence when fewer than 3 qualifying summaries', () => {
    const result = computeWorkingOneRm({
      recentEstimates: [makeEstimate(115), makeEstimate(120)],
      storedOneRmKg: 130,
    });
    expect(result.workingOneRmKg).toBe(130);
    expect(result.confidence).toBe('low');
    expect(result.source).toBe('stored');
  });

  it('returns stored 1RM with low confidence when summaries array is empty', () => {
    const result = computeWorkingOneRm({
      recentEstimates: [],
      storedOneRmKg: 130,
    });
    expect(result.workingOneRmKg).toBe(130);
    expect(result.confidence).toBe('low');
    expect(result.source).toBe('stored');
  });

  it('returns median estimate with medium confidence for exactly 3 qualifying sessions', () => {
    // estimates [110, 120, 130] → median 120; stored 100 → capped 110
    // roundToNearest(110) = 110 → working
    const result = computeWorkingOneRm({
      recentEstimates: [
        makeEstimate(110),
        makeEstimate(120),
        makeEstimate(130),
      ],
      storedOneRmKg: 100,
    });
    expect(result.confidence).toBe('medium');
    expect(result.source).toBe('working');
  });

  it('returns high confidence for 5 or more qualifying sessions', () => {
    const summaries = [110, 112, 115, 113, 114].map(makeEstimate);
    const result = computeWorkingOneRm({
      recentEstimates: summaries,
      storedOneRmKg: 110,
    });
    expect(result.confidence).toBe('high');
  });

  it('caps working 1RM at 110% of stored', () => {
    // estimates [130, 135, 140] → median 135; stored 100 → cap = 110
    const result = computeWorkingOneRm({
      recentEstimates: [
        makeEstimate(130),
        makeEstimate(135),
        makeEstimate(140),
      ],
      storedOneRmKg: 100,
    });
    expect(result.workingOneRmKg).toBe(110);
  });

  it('floors working 1RM at 85% of stored', () => {
    // estimates [70, 75, 72] → median 72; stored 100 → floor = 85
    const result = computeWorkingOneRm({
      recentEstimates: [makeEstimate(70), makeEstimate(75), makeEstimate(72)],
      storedOneRmKg: 100,
    });
    expect(result.workingOneRmKg).toBe(85);
  });

  it('rounds result to nearest 2.5kg', () => {
    // estimates [101, 102, 101] → median 101; stored 100 → raw 101
    // roundToNearest(101) = 100
    const result = computeWorkingOneRm({
      recentEstimates: [
        makeEstimate(101),
        makeEstimate(102),
        makeEstimate(101),
      ],
      storedOneRmKg: 100,
    });
    expect(result.workingOneRmKg % 2.5).toBe(0);
  });

  it('reports source as stored when rounded result equals storedOneRmKg', () => {
    // estimates all exactly 100 → median 100; stored 100 → working == stored → source 'stored'
    const result = computeWorkingOneRm({
      recentEstimates: [
        makeEstimate(100),
        makeEstimate(100),
        makeEstimate(100),
      ],
      storedOneRmKg: 100,
    });
    expect(result.workingOneRmKg).toBe(100);
    expect(result.source).toBe('stored');
  });

  it('uses median, not mean, so outliers do not skew the result', () => {
    // [80, 95, 100, 105, 120] → median 100; mean would be 100 too, but
    // [80, 120, 100, 105, 95] sorted = [80, 95, 100, 105, 120] → median 100
    const result = computeWorkingOneRm({
      recentEstimates: [80, 120, 100, 105, 95].map(makeEstimate),
      storedOneRmKg: 100,
    });
    expect(result.workingOneRmKg).toBe(100);
  });

  it('does not count summaries with null estimatedOneRmKg toward qualifying threshold', () => {
    // 2 real estimates + 3 nulls → only 2 qualifying → falls back to stored
    const summaries = [
      makeEstimate(110),
      makeEstimate(115),
      makeEstimate(null),
      makeEstimate(null),
      makeEstimate(null),
    ];
    const result = computeWorkingOneRm({
      recentEstimates: summaries,
      storedOneRmKg: 130,
    });
    expect(result.workingOneRmKg).toBe(130);
    expect(result.confidence).toBe('low');
    expect(result.source).toBe('stored');
  });
});
