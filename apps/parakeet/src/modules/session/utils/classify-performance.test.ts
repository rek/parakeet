import { describe, expect, it } from 'vitest';

import {
  classifyPerformance,
  COMPLETION_PCT_INCOMPLETE_BELOW,
  COMPLETION_PCT_UNDER_BELOW,
  COMPLETION_RATIO_OVER_ABOVE,
} from './classify-performance';

describe('classifyPerformance', () => {
  it('incomplete when completionPct is below 50%', () => {
    expect(classifyPerformance(2, 5, 40)).toBe('incomplete');
    expect(classifyPerformance(0, 5, 0)).toBe('incomplete');
  });

  it('incomplete at exactly the border below threshold', () => {
    expect(classifyPerformance(2, 5, 49.99)).toBe('incomplete');
  });

  it('under when completionPct is 50–90%', () => {
    expect(classifyPerformance(3, 5, 60)).toBe('under');
    expect(classifyPerformance(4, 5, 80)).toBe('under');
  });

  it('under at exactly the 50% floor', () => {
    expect(classifyPerformance(3, 6, 50)).toBe('under');
  });

  it('at when completionPct is 90–110% of plan', () => {
    expect(classifyPerformance(5, 5, 100)).toBe('at');
    expect(classifyPerformance(5, 5, 90)).toBe('at');
  });

  it('over when completed count exceeds 110% of plan', () => {
    expect(classifyPerformance(6, 5, 120)).toBe('over');
    expect(classifyPerformance(7, 5, 140)).toBe('over');
  });

  it('at when completionPct is ≥ 90 but ratio is within 1.1', () => {
    // 11/10 = exactly 1.1 — NOT strictly > 1.1, so stays 'at'
    expect(classifyPerformance(11, 10, 110)).toBe('at');
  });

  it('at when plannedCount is 0 (ad-hoc / no plan)', () => {
    // No denominator for the over check. completionPct will still be whatever
    // the caller passed; if it's ≥ 90 it lands as 'at'.
    expect(classifyPerformance(3, 0, 100)).toBe('at');
  });

  it('never returns over when plannedCount is 0', () => {
    // Even a huge completion can't flip to over without a plan to exceed
    expect(classifyPerformance(20, 0, 200)).toBe('at');
  });

  it('constants match the documented bands', () => {
    // Lock the thresholds so tuning touches both the domain doc and this test
    expect(COMPLETION_PCT_INCOMPLETE_BELOW).toBe(50);
    expect(COMPLETION_PCT_UNDER_BELOW).toBe(90);
    expect(COMPLETION_RATIO_OVER_ABOVE).toBe(1.1);
  });
});
