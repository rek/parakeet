import { describe, expect, it } from 'vitest';

import { baseInput, makeSets } from '../../__test-helpers__/fixtures';
import { SorenessLevel } from '../../adjustments/soreness-adjuster';
import { MuscleGroup } from '../../types';
import { PipelineContext } from './pipeline-context';
import { applyRepRangeAdjustment } from './applyRepRangeAdjustment';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    intensityMultiplier: 1.0,
    plannedCount: 3,
    baseSetsCount: 3,
    inRecoveryMode: false,
    skippedMainLift: false,
    rationale: [],
    warnings: [],
    baseSets: makeSets(3, 100),
    baseWeight: 100,
    primaryMuscles: ['chest', 'triceps'] as MuscleGroup[],
    worstSoreness: 1 as SorenessLevel,
    readinessSetsRemoved: 0,
    cyclePhaseSetsRemoved: 0,
    sorenessSetsRemoved: 0,
    disruptionSetsRemoved: 0,
    ...overrides,
  };
}

function setsWithRange(
  count: number,
  reps: number,
  repsRange: [number, number]
) {
  return Array.from({ length: count }, (_, i) => ({
    set_number: i + 1,
    weight_kg: 100,
    reps,
    rpe_target: 8,
    reps_range: repsRange,
  }));
}

function logs(rpes: number[], targetRpe = 8) {
  return rpes.map((actual_rpe) => ({ actual_rpe, target_rpe: targetRpe }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyRepRangeAdjustment', () => {
  describe('non-rep days — no-op', () => {
    it('heavy day leaves reps unchanged', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 5, [5, 5]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'heavy', recentLogs: logs([6, 6]) }));
      expect(ctx.baseSets.every((s) => s.reps === 5)).toBe(true);
      expect(ctx.rationale).toHaveLength(0);
    });

    it('explosive day leaves reps unchanged', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 8]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'explosive', recentLogs: logs([6, 6]) }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
      expect(ctx.rationale).toHaveLength(0);
    });
  });

  describe('rep day — insufficient history', () => {
    it('0 logs → no-op', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: [] }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
    });

    it('1 log with actual_rpe → no-op (needs 2)', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([6]) }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
    });

    it('2 logs with null actual_rpe → no-op', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({
        intensityType: 'rep',
        recentLogs: [{ actual_rpe: null, target_rpe: 8 }, { actual_rpe: null, target_rpe: 8 }],
      }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
    });
  });

  describe('rep day — RPE at or above target (no-op)', () => {
    it('RPE at target (avgDev 0) → no-op', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([8, 8]) }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
      expect(ctx.rationale).toHaveLength(0);
    });

    it('RPE above target (avgDev +1) → no-op', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([9, 9]) }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
      expect(ctx.rationale).toHaveLength(0);
    });
  });

  describe('rep day — mild signal (−1.25 to −0.75): no-op (weight boost covers this)', () => {
    it('avgDev just below threshold (−0.75) → no-op', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({
        intensityType: 'rep',
        recentLogs: [{ actual_rpe: 7.26, target_rpe: 8 }, { actual_rpe: 7.26, target_rpe: 8 }],
      }));
      // avgDev = -0.74 — does not cross RPE_LARGE_GAP (1.25)
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
      expect(ctx.rationale).toHaveLength(0);
    });

    it('B1 Rep (8–12), avgDev −1.0 (mild) → no-op', () => {
      // avgDev = -1.0: above -RPE_LARGE_GAP (-1.25), only weight boost fires (step 2)
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([7, 7]) }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
      expect(ctx.rationale).toHaveLength(0);
    });

    it('avgDev exactly −1.25 (boundary) → fires (≤ triggers)', () => {
      // −1.25 is exactly RPE_LARGE_GAP — should prescribe reps_max
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({
        intensityType: 'rep',
        recentLogs: [{ actual_rpe: 6.75, target_rpe: 8 }, { actual_rpe: 6.75, target_rpe: 8 }],
      }));
      // avgDev = 6.75 - 8 = -1.25 exactly
      expect(ctx.baseSets.every((s) => s.reps === 12)).toBe(true);
    });
  });

  describe('rep day — strong signal (≤ −1.25): prescribe reps_max', () => {
    it('B1 Rep (8–12): prescribes 12', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([6, 6]) }));
      expect(ctx.baseSets.every((s) => s.reps === 12)).toBe(true);
      expect(ctx.rationale[0]).toContain('well below target');
      expect(ctx.rationale[0]).toContain('12 reps');
    });

    it('B2 Rep (4–8): prescribes 8', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 4, [4, 8]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([6, 6]) }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
    });

    it('B3 Rep (3–5): prescribes 5', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 3, [3, 5]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([6, 6]) }));
      expect(ctx.baseSets.every((s) => s.reps === 5)).toBe(true);
    });

    it('rationale pushed exactly once regardless of set count', () => {
      const ctx = makeCtx({ baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([6, 6]) }));
      expect(ctx.rationale).toHaveLength(1);
    });

    it('rationale uses reps from first adjusted set (not baseSets[0] when no reps_range)', () => {
      // First set has no reps_range, second and third do — rationale should reflect adjusted reps
      const ctx = makeCtx({
        baseSets: [
          { set_number: 1, weight_kg: 100, reps: 8, rpe_target: 8 },
          { set_number: 2, weight_kg: 100, reps: 8, rpe_target: 8, reps_range: [8, 12] as [number, number] },
          { set_number: 3, weight_kg: 100, reps: 8, rpe_target: 8, reps_range: [8, 12] as [number, number] },
        ],
      });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([6, 6]) }));
      expect(ctx.rationale[0]).toContain('12 reps');
    });
  });

  describe('guard conditions', () => {
    it('recovery mode → no-op', () => {
      const ctx = makeCtx({ inRecoveryMode: true, baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([6, 6]) }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
      expect(ctx.rationale).toHaveLength(0);
    });

    it('skipped main lift → no-op', () => {
      const ctx = makeCtx({ skippedMainLift: true, baseSets: setsWithRange(3, 8, [8, 12]) });
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([6, 6]) }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
    });

    it('sets without reps_range are skipped', () => {
      const ctx = makeCtx({ baseSets: makeSets(3, 100, 8) }); // no reps_range
      applyRepRangeAdjustment(ctx, baseInput({ intensityType: 'rep', recentLogs: logs([6, 6]) }));
      expect(ctx.baseSets.every((s) => s.reps === 8)).toBe(true);
      expect(ctx.rationale).toHaveLength(0);
    });
  });
});
