import { describe, expect, it } from 'vitest';

import { computeReadinessFromVerdicts } from '../readiness-score';
import type { RepVerdict, CriterionResult } from '../competition-grader';

function makeVerdict(verdict: RepVerdict['verdict'], failedCriteria: string[] = []): RepVerdict {
  const criteria: CriterionResult[] = [
    { name: 'depth', verdict: 'pass', measured: -5, threshold: 0, unit: 'cm', message: 'ok' },
    { name: 'lockout', verdict: 'pass', measured: 178, threshold: 175, unit: '°', message: 'ok' },
  ];
  for (const name of failedCriteria) {
    criteria.push({ name, verdict: 'fail', measured: 0, threshold: 0, unit: '', message: 'failed' });
  }
  return { verdict, criteria };
}

describe('computeReadinessFromVerdicts', () => {
  it('returns null for empty input', () => {
    expect(computeReadinessFromVerdicts({ verdicts: [] })).toBeNull();
  });

  it('returns 100% pass rate when all reps pass', () => {
    const verdicts = [
      makeVerdict('white_light'),
      makeVerdict('white_light'),
      makeVerdict('white_light'),
    ];
    const score = computeReadinessFromVerdicts({ verdicts });
    expect(score!.passRate).toBe(1);
    expect(score!.passedReps).toBe(3);
    expect(score!.failedReps).toBe(0);
  });

  it('computes correct pass rate with mixed verdicts', () => {
    const verdicts = [
      makeVerdict('white_light'),
      makeVerdict('red_light', ['depth']),
      makeVerdict('white_light'),
      makeVerdict('borderline'),
    ];
    const score = computeReadinessFromVerdicts({ verdicts });
    expect(score!.passRate).toBe(0.5);
    expect(score!.passedReps).toBe(2);
    expect(score!.borderlineReps).toBe(1);
    expect(score!.failedReps).toBe(1);
  });

  it('detects improving trend when second half is better', () => {
    const verdicts = [
      makeVerdict('red_light', ['depth']),
      makeVerdict('red_light', ['depth']),
      makeVerdict('white_light'),
      makeVerdict('white_light'),
    ];
    const score = computeReadinessFromVerdicts({ verdicts });
    expect(score!.trend).toBe('improving');
  });

  it('detects declining trend when second half is worse', () => {
    const verdicts = [
      makeVerdict('white_light'),
      makeVerdict('white_light'),
      makeVerdict('red_light', ['depth']),
      makeVerdict('red_light', ['depth']),
    ];
    const score = computeReadinessFromVerdicts({ verdicts });
    expect(score!.trend).toBe('declining');
  });

  it('detects stable trend when halves are similar', () => {
    const verdicts = [
      makeVerdict('white_light'),
      makeVerdict('red_light', ['depth']),
      makeVerdict('white_light'),
      makeVerdict('red_light', ['depth']),
    ];
    const score = computeReadinessFromVerdicts({ verdicts });
    expect(score!.trend).toBe('stable');
  });

  it('identifies most common failure criterion', () => {
    const verdicts = [
      makeVerdict('red_light', ['depth']),
      makeVerdict('red_light', ['depth']),
      makeVerdict('red_light', ['lockout']),
      makeVerdict('white_light'),
    ];
    const score = computeReadinessFromVerdicts({ verdicts });
    expect(score!.mostCommonFailure).toBe('depth');
  });

  it('returns null mostCommonFailure when no failures', () => {
    const verdicts = [
      makeVerdict('white_light'),
      makeVerdict('borderline'),
    ];
    const score = computeReadinessFromVerdicts({ verdicts });
    expect(score!.mostCommonFailure).toBeNull();
  });
});
