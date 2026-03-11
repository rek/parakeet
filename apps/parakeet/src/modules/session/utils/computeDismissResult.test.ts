import { describe, expect, it } from 'vitest';

import type { PostRestState } from '../model/types';
import { computeDismissResult } from './computeDismissResult';

describe('computeDismissResult', () => {
  it('returns zeroed result for null state', () => {
    expect(computeDismissResult(null, Date.now())).toEqual({
      totalRest: 0,
      prevSetNumber: null,
      nextSetNumber: null,
      auxExercise: null,
      auxSetNumber: null,
    });
  });

  it('accumulates rest time and advances set number for a main set', () => {
    const now = Date.now();
    const state: PostRestState = {
      pendingMainSetNumber: 3,
      pendingAuxExercise: null,
      pendingAuxSetNumber: null,
      actualRestSeconds: 120,
      liftStartedAt: now - 5000,
      plannedReps: 5,
      resetSecondsRemaining: null,
    };
    const result = computeDismissResult(state, now);
    expect(result.totalRest).toBe(125);
    expect(result.prevSetNumber).toBe(3);
    expect(result.nextSetNumber).toBe(4);
    expect(result.auxExercise).toBeNull();
    expect(result.auxSetNumber).toBeNull();
  });

  it('surfaces aux exercise and set number, with no main set advancement', () => {
    const now = Date.now();
    const state: PostRestState = {
      pendingMainSetNumber: null,
      pendingAuxExercise: 'curls',
      pendingAuxSetNumber: 2,
      actualRestSeconds: 60,
      liftStartedAt: now,
      plannedReps: 10,
      resetSecondsRemaining: null,
    };
    const result = computeDismissResult(state, now);
    expect(result.auxExercise).toBe('curls');
    expect(result.auxSetNumber).toBe(2);
    expect(result.prevSetNumber).toBeNull();
    expect(result.nextSetNumber).toBeNull();
  });
});
