import { describe, expect, it } from 'vitest';

import { computeSessionStats } from './session-stats';

const completed = { is_completed: true };
const incomplete = { is_completed: false };

describe('computeSessionStats', () => {
  it('returns 100% completion when all actual sets are completed', () => {
    const result = computeSessionStats([completed, completed, completed], []);
    expect(result.isAuxOnly).toBe(false);
    expect(result.totalSets).toBe(3);
    expect(result.completedSets).toBe(3);
    expect(result.completionPct).toBe('100');
  });

  it('returns correct percentage when some actual sets are completed', () => {
    const result = computeSessionStats(
      [completed, incomplete, completed, incomplete],
      []
    );
    expect(result.isAuxOnly).toBe(false);
    expect(result.totalSets).toBe(4);
    expect(result.completedSets).toBe(2);
    expect(result.completionPct).toBe('50');
  });

  it('uses auxiliary sets when there are no actual sets (isAuxOnly=true)', () => {
    const result = computeSessionStats([], [completed, completed, incomplete]);
    expect(result.isAuxOnly).toBe(true);
    expect(result.totalSets).toBe(3);
    expect(result.completedSets).toBe(2);
  });

  it('returns totalSets=0 and completionPct="0" when both actual and aux sets are empty', () => {
    const result = computeSessionStats([], []);
    expect(result.isAuxOnly).toBe(false);
    expect(result.totalSets).toBe(0);
    expect(result.completedSets).toBe(0);
    expect(result.completionPct).toBe('0');
  });

  it('rounds percentage to integer string', () => {
    // 1 of 3 = 33.333…% → rounds to '33'
    const result = computeSessionStats([completed, incomplete, incomplete], []);
    expect(result.completionPct).toBe('33');
  });

  it('ignores aux sets when actual sets are present (not aux-only)', () => {
    const result = computeSessionStats([completed], [completed, completed]);
    expect(result.isAuxOnly).toBe(false);
    expect(result.totalSets).toBe(1);
    expect(result.completedSets).toBe(1);
  });

  it('isAuxOnly is false when actual sets are present alongside aux sets', () => {
    const result = computeSessionStats([incomplete], [completed]);
    expect(result.isAuxOnly).toBe(false);
  });

  it('hybrid: actual + aux both non-empty — completionPct derived from actual only', () => {
    // 2 of 4 actual completed; aux sets are all completed but must not inflate the count
    const result = computeSessionStats(
      [completed, incomplete, completed, incomplete],
      [completed, completed, completed]
    );
    expect(result.isAuxOnly).toBe(false);
    expect(result.totalSets).toBe(4);
    expect(result.completedSets).toBe(2);
    expect(result.completionPct).toBe('50');
  });
});
