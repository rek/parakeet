import { describe, expect, it } from 'vitest';

import { baseInput, makeSets } from '../../__test-helpers__/fixtures';
import { SorenessLevel } from '../../adjustments/soreness-adjuster';
import { MuscleGroup } from '../../types';
import { DEFAULT_MRV_MEV_CONFIG_MALE } from '../../volume/mrv-mev-calculator';
import { PipelineContext } from './pipeline-context';
import { applyCyclePhaseAdjustment } from './applyCyclePhaseAdjustment';
import { applyMrvCap } from './applyMrvCap';
import { applyReadinessAdjustment } from './applyReadinessAdjustment';
import { applyRpeAdjustment } from './applyRpeAdjustment';
import { applySorenessAdjustment } from './applySorenessAdjustment';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    intensityMultiplier: 1.0,
    plannedCount: 5,
    baseSetsCount: 5,
    inRecoveryMode: false,
    skippedMainLift: false,
    rationale: [],
    warnings: [],
    baseSets: makeSets(5, 100),
    baseWeight: 100,
    primaryMuscles: ['quads', 'glutes'] as MuscleGroup[],
    worstSoreness: 1 as SorenessLevel,
    readinessSetsRemoved: 0,
    cyclePhaseSetsRemoved: 0,
    sorenessSetsRemoved: 0,
    disruptionSetsRemoved: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// applyRpeAdjustment
// ---------------------------------------------------------------------------

describe('applyRpeAdjustment', () => {
  describe('insufficient history', () => {
    it('no logs → no-op', () => {
      const ctx = makeCtx();
      const input = baseInput({ recentLogs: [] });

      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBe(1.0);
      expect(ctx.rationale).toHaveLength(0);
    });

    it('exactly 1 log with non-null actual_rpe → no-op (needs 2)', () => {
      const ctx = makeCtx();
      const input = baseInput({
        recentLogs: [{ actual_rpe: 10, target_rpe: 8 }],
      });

      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBe(1.0);
      expect(ctx.rationale).toHaveLength(0);
    });

    it('2 logs where first has null actual_rpe → only 1 valid log → no-op', () => {
      const ctx = makeCtx();
      const input = baseInput({
        recentLogs: [
          { actual_rpe: null, target_rpe: 8 },
          { actual_rpe: 10, target_rpe: 8 },
        ],
      });

      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBe(1.0);
      expect(ctx.rationale).toHaveLength(0);
    });

    it('3 logs but only the first 2 non-null are used — third ignored', () => {
      // Logs 1+2 avg deviation = +0.5 (under threshold), log 3 would push it over if included
      const ctx = makeCtx();
      const input = baseInput({
        recentLogs: [
          { actual_rpe: 8.25, target_rpe: 8 }, // dev +0.25
          { actual_rpe: 8.75, target_rpe: 8 }, // dev +0.75
          { actual_rpe: 10, target_rpe: 8 }, // dev +2.0 — should be ignored
        ],
      });
      // avg of first two = (0.25 + 0.75) / 2 = 0.5 — below OVER_THRESHOLD 0.75
      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBe(1.0);
    });
  });

  describe('over-target thresholds', () => {
    it('avg deviation just below 0.75 → no adjustment', () => {
      const ctx = makeCtx();
      // avg dev = 0.74
      const input = baseInput({
        recentLogs: [
          { actual_rpe: 8.74, target_rpe: 8 },
          { actual_rpe: 8.74, target_rpe: 8 },
        ],
      });

      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBe(1.0);
    });

    it('avg deviation exactly 0.75 → small reduction ×0.975', () => {
      const ctx = makeCtx();
      const input = baseInput({
        recentLogs: [
          { actual_rpe: 8.75, target_rpe: 8 },
          { actual_rpe: 8.75, target_rpe: 8 },
        ],
      });

      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBeCloseTo(0.975);
      expect(ctx.rationale[0]).toContain('2.5%');
    });

    it('avg deviation just below 1.25 → small reduction (not large)', () => {
      const ctx = makeCtx();
      const input = baseInput({
        recentLogs: [
          { actual_rpe: 9.24, target_rpe: 8 },
          { actual_rpe: 9.24, target_rpe: 8 },
        ],
      });

      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBeCloseTo(0.975);
    });

    it('avg deviation exactly 1.25 → large reduction ×0.95', () => {
      const ctx = makeCtx();
      const input = baseInput({
        recentLogs: [
          { actual_rpe: 9.25, target_rpe: 8 },
          { actual_rpe: 9.25, target_rpe: 8 },
        ],
      });

      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBeCloseTo(0.95);
      expect(ctx.rationale[0]).toContain('5%');
    });
  });

  describe('under-target thresholds', () => {
    it('avg deviation just above -0.75 → no adjustment', () => {
      const ctx = makeCtx();
      const input = baseInput({
        recentLogs: [
          { actual_rpe: 7.27, target_rpe: 8 }, // dev -0.73
          { actual_rpe: 7.27, target_rpe: 8 },
        ],
      });

      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBe(1.0);
    });

    it('avg deviation exactly -0.75 → small boost ×1.025', () => {
      const ctx = makeCtx();
      const input = baseInput({
        recentLogs: [
          { actual_rpe: 7.25, target_rpe: 8 },
          { actual_rpe: 7.25, target_rpe: 8 },
        ],
      });

      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBeCloseTo(1.025);
      expect(ctx.rationale[0]).toContain('2.5%');
    });

    it('avg deviation exactly -1.25 → large boost ×1.05', () => {
      const ctx = makeCtx();
      const input = baseInput({
        recentLogs: [
          { actual_rpe: 6.75, target_rpe: 8 },
          { actual_rpe: 6.75, target_rpe: 8 },
        ],
      });

      applyRpeAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBeCloseTo(1.05);
      expect(ctx.rationale[0]).toContain('5%');
    });
  });
});

// ---------------------------------------------------------------------------
// applyMrvCap
// ---------------------------------------------------------------------------

describe('applyMrvCap', () => {
  describe('recovery mode guard', () => {
    it('inRecoveryMode=true → no-op even when MRV exceeded', () => {
      // quads mrv=20; volume at 25 would normally skip the lift
      const ctx = makeCtx({
        inRecoveryMode: true,
        primaryMuscles: ['quads'] as MuscleGroup[],
      });
      const input = baseInput({
        primaryLift: 'squat',
        weeklyVolumeToDate: { quads: 25 },
        mrvMevConfig: {
          ...DEFAULT_MRV_MEV_CONFIG_MALE,
          quads: { mev: 8, mrv: 20 },
        },
      });

      applyMrvCap(ctx, input);

      expect(ctx.skippedMainLift).toBe(false);
      expect(ctx.plannedCount).toBe(5);
    });
  });

  describe('MRV exceeded → skip main lift', () => {
    it('remaining capacity = 0 → skippedMainLift=true, plannedCount=0', () => {
      const ctx = makeCtx({ primaryMuscles: ['quads'] as MuscleGroup[] });
      const input = baseInput({
        primaryLift: 'squat',
        weeklyVolumeToDate: { quads: 20 }, // at mrv exactly
        mrvMevConfig: {
          ...DEFAULT_MRV_MEV_CONFIG_MALE,
          quads: { mev: 8, mrv: 20 },
        },
      });

      applyMrvCap(ctx, input);

      expect(ctx.skippedMainLift).toBe(true);
      expect(ctx.plannedCount).toBe(0);
      expect(ctx.warnings[0]).toContain('MRV exceeded');
      expect(ctx.warnings[0]).toContain('quads');
    });

    it('remaining capacity negative → skipped', () => {
      const ctx = makeCtx({ primaryMuscles: ['quads'] as MuscleGroup[] });
      const input = baseInput({
        primaryLift: 'squat',
        weeklyVolumeToDate: { quads: 22 }, // beyond mrv
        mrvMevConfig: {
          ...DEFAULT_MRV_MEV_CONFIG_MALE,
          quads: { mev: 8, mrv: 20 },
        },
      });

      applyMrvCap(ctx, input);

      expect(ctx.skippedMainLift).toBe(true);
      expect(ctx.plannedCount).toBe(0);
    });
  });

  describe('MRV approaching → cap sets', () => {
    it('remaining sets < plannedCount → plannedCount capped', () => {
      // quads contribution for squat = 1.0, so remaining sets = floor((20-17)/1.0) = 3
      const ctx = makeCtx({
        plannedCount: 5,
        primaryMuscles: ['quads'] as MuscleGroup[],
      });
      const input = baseInput({
        primaryLift: 'squat',
        weeklyVolumeToDate: { quads: 17 },
        mrvMevConfig: {
          ...DEFAULT_MRV_MEV_CONFIG_MALE,
          quads: { mev: 8, mrv: 20 },
        },
      });

      applyMrvCap(ctx, input);

      expect(ctx.skippedMainLift).toBe(false);
      expect(ctx.plannedCount).toBe(3);
      expect(ctx.warnings[0]).toContain('Approaching MRV');
    });

    it('remaining capacity exactly equals planned → no cap applied', () => {
      // quads contribution = 1.0, remaining = 20-15 = 5, plannedCount = 5
      const ctx = makeCtx({
        plannedCount: 5,
        primaryMuscles: ['quads'] as MuscleGroup[],
      });
      const input = baseInput({
        primaryLift: 'squat',
        weeklyVolumeToDate: { quads: 15 },
        mrvMevConfig: {
          ...DEFAULT_MRV_MEV_CONFIG_MALE,
          quads: { mev: 8, mrv: 20 },
        },
      });

      applyMrvCap(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.warnings).toHaveLength(0);
    });
  });

  describe('most restrictive muscle wins', () => {
    it('two primary muscles — the one with less remaining capacity caps plannedCount', () => {
      // Squat muscles include quads (contribution 1.0) and glutes (contribution 0.55)
      // quads: mrv=20, vol=17 → remaining=3 sets (floor(3/1.0))
      // glutes: mrv=22, vol=21 → remaining=1 set (floor(1/0.55) = 1)
      // glutes should win and cap to 1
      const ctx = makeCtx({
        plannedCount: 5,
        primaryMuscles: ['quads', 'glutes'] as MuscleGroup[],
      });
      const input = baseInput({
        primaryLift: 'squat',
        weeklyVolumeToDate: { quads: 17, glutes: 21 },
        mrvMevConfig: {
          ...DEFAULT_MRV_MEV_CONFIG_MALE,
          quads: { mev: 8, mrv: 20 },
          glutes: { mev: 0, mrv: 22 },
        },
      });

      applyMrvCap(ctx, input);

      // glutes remaining = 22 - 21 = 1, contribution 0.55 → floor(1/0.55) = 1
      expect(ctx.plannedCount).toBe(1);
    });

    it('one muscle at MRV skip threshold overrides cap from other muscle', () => {
      // quads at MRV (skip) + glutes just approaching — skip should win
      const ctx = makeCtx({
        plannedCount: 5,
        primaryMuscles: ['quads', 'glutes'] as MuscleGroup[],
      });
      const input = baseInput({
        primaryLift: 'squat',
        weeklyVolumeToDate: { quads: 20, glutes: 18 }, // quads exceeded, glutes fine
        mrvMevConfig: {
          ...DEFAULT_MRV_MEV_CONFIG_MALE,
          quads: { mev: 8, mrv: 20 },
          glutes: { mev: 0, mrv: 22 },
        },
      });

      applyMrvCap(ctx, input);

      expect(ctx.skippedMainLift).toBe(true);
      expect(ctx.plannedCount).toBe(0);
    });
  });

  describe('muscle not in primaryMuscles → ignored', () => {
    it('hamstrings at MRV but not in primaryMuscles for this session → not skipped', () => {
      // primaryMuscles only has quads; hamstrings over MRV should not affect the cap
      const ctx = makeCtx({
        primaryMuscles: ['quads'] as MuscleGroup[],
        plannedCount: 5,
      });
      const input = baseInput({
        primaryLift: 'squat',
        weeklyVolumeToDate: { quads: 0, hamstrings: 25 },
        mrvMevConfig: {
          ...DEFAULT_MRV_MEV_CONFIG_MALE,
          quads: { mev: 8, mrv: 20 },
          hamstrings: { mev: 6, mrv: 20 },
        },
      });

      applyMrvCap(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.skippedMainLift).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// applySorenessAdjustment
// ---------------------------------------------------------------------------

describe('applySorenessAdjustment', () => {
  describe('deload guard', () => {
    it('deload session with high soreness → no-op (guard fires before modifier lookup)', () => {
      const ctx = makeCtx({ worstSoreness: 7 as SorenessLevel, plannedCount: 5 });
      const input = baseInput({ intensityType: 'deload', biologicalSex: 'male' });

      applySorenessAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.intensityMultiplier).toBe(1.0);
      expect(ctx.inRecoveryMode).toBe(false);
      expect(ctx.sorenessSetsRemoved).toBe(0);
    });
  });

  describe('recovery mode (soreness 9-10)', () => {
    it('soreness 9 → inRecoveryMode=true, rationale set', () => {
      const ctx = makeCtx({ worstSoreness: 9 as SorenessLevel });
      const input = baseInput();

      applySorenessAdjustment(ctx, input);

      expect(ctx.inRecoveryMode).toBe(true);
      expect(ctx.rationale).toContain('Severe soreness — recovery session');
    });

    it('soreness 9 with calibration → calibration NOT applied in recovery mode', () => {
      const ctx = makeCtx({ worstSoreness: 9 as SorenessLevel });
      const input = baseInput({
        modifierCalibrations: { soreness: 0.05 }, // would make modifier less aggressive
      });

      applySorenessAdjustment(ctx, input);

      // intensityMultiplier stays 1.0 — recovery mode does not touch intensity via calibration
      expect(ctx.intensityMultiplier).toBe(1.0);
      expect(ctx.inRecoveryMode).toBe(true);
    });

    it('recovery mode — sorenessSetsRemoved is 0 (sets not counted as removed)', () => {
      const ctx = makeCtx({ worstSoreness: 9 as SorenessLevel, plannedCount: 5 });
      const input = baseInput();

      applySorenessAdjustment(ctx, input);

      expect(ctx.sorenessSetsRemoved).toBe(0);
    });
  });

  describe('normal soreness adjustments', () => {
    it('soreness 1-4 (fresh) → no change to plannedCount or intensityMultiplier', () => {
      const ctx = makeCtx({ worstSoreness: 3 as SorenessLevel });
      const input = baseInput();

      applySorenessAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.intensityMultiplier).toBe(1.0);
      expect(ctx.sorenessSetsRemoved).toBe(0);
    });

    it('soreness 7 (high, male) → 2 set reduction + 5% intensity cut', () => {
      const ctx = makeCtx({ worstSoreness: 7 as SorenessLevel, plannedCount: 5 });
      const input = baseInput({ biologicalSex: 'male' });

      applySorenessAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(3); // 5 - 2
      expect(ctx.intensityMultiplier).toBeCloseTo(0.95);
      expect(ctx.sorenessSetsRemoved).toBe(2);
    });

    it('soreness 7 (high, female) → 1 set reduction + 3% intensity cut', () => {
      const ctx = makeCtx({ worstSoreness: 7 as SorenessLevel, plannedCount: 5 });
      const input = baseInput({ biologicalSex: 'female' });

      applySorenessAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(4); // 5 - 1
      expect(ctx.intensityMultiplier).toBeCloseTo(0.97);
    });

    it('plannedCount never goes below 1 even with large setReduction', () => {
      const ctx = makeCtx({ worstSoreness: 7 as SorenessLevel, plannedCount: 1 });
      const input = baseInput({ biologicalSex: 'male' }); // HIGH_MALE: setReduction=2

      applySorenessAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(1);
    });
  });

  describe('calibration adjustment', () => {
    it('soreness 7 male with positive calibration → intensityMultiplier less aggressive', () => {
      // HIGH_MALE default multiplier = 0.95
      // calibration +0.03 → 0.95 + 0.03 = 0.98 (less aggressive reduction)
      const ctx = makeCtx({ worstSoreness: 7 as SorenessLevel });
      const input = baseInput({
        biologicalSex: 'male',
        modifierCalibrations: { soreness: 0.03 },
      });

      applySorenessAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBeCloseTo(0.98);
    });

    it('soreness 5 (moderate) — no intensity change so calibration has no effect', () => {
      // MODERATE_MALE: intensityMultiplier = 1.0 (condition: !== 1.0 required for calibration)
      const ctx = makeCtx({ worstSoreness: 5 as SorenessLevel });
      const input = baseInput({
        biologicalSex: 'male',
        modifierCalibrations: { soreness: 0.05 },
      });

      applySorenessAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBe(1.0);
    });
  });
});

// ---------------------------------------------------------------------------
// applyReadinessAdjustment
// ---------------------------------------------------------------------------

describe('applyReadinessAdjustment', () => {
  describe('deload guard', () => {
    it('deload session with poor sleep and low energy → no-op', () => {
      const ctx = makeCtx({ plannedCount: 5 });
      const input = baseInput({ intensityType: 'deload', sleepQuality: 1, energyLevel: 1 });

      applyReadinessAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.intensityMultiplier).toBe(1.0);
      expect(ctx.readinessSetsRemoved).toBe(0);
    });
  });

  describe('no readiness signals → no-op', () => {
    it('both sleepQuality and energyLevel undefined → no change', () => {
      const ctx = makeCtx();
      const input = baseInput({
        sleepQuality: undefined,
        energyLevel: undefined,
      });

      applyReadinessAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.intensityMultiplier).toBe(1.0);
      expect(ctx.rationale).toHaveLength(0);
      expect(ctx.readinessSetsRemoved).toBe(0);
    });
  });

  describe('poor readiness', () => {
    it('poor sleep only (1) → intensity reduced 2.5%, no set reduction', () => {
      const ctx = makeCtx();
      const input = baseInput({ sleepQuality: 1, energyLevel: undefined });

      applyReadinessAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBeCloseTo(0.975);
      expect(ctx.plannedCount).toBe(5);
      expect(ctx.rationale[0]).toContain('sleep');
    });

    it('low energy only (1) → intensity reduced 2.5%, no set reduction', () => {
      const ctx = makeCtx();
      const input = baseInput({ sleepQuality: undefined, energyLevel: 1 });

      applyReadinessAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBeCloseTo(0.975);
      expect(ctx.plannedCount).toBe(5);
    });

    it('both poor sleep and low energy → 1 set removed + 5% intensity cut', () => {
      const ctx = makeCtx({ plannedCount: 5 });
      const input = baseInput({ sleepQuality: 1, energyLevel: 1 });

      applyReadinessAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(4);
      expect(ctx.intensityMultiplier).toBeCloseTo(0.95);
      expect(ctx.readinessSetsRemoved).toBe(1);
    });
  });

  describe('great readiness', () => {
    it('great sleep and high energy (5) → intensity boost 2.5%', () => {
      const ctx = makeCtx();
      const input = baseInput({ sleepQuality: 5, energyLevel: 5 });

      applyReadinessAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBeCloseTo(1.025);
      expect(ctx.plannedCount).toBe(5); // no set change
    });

    it('great sleep only → no boost (both required)', () => {
      const ctx = makeCtx();
      const input = baseInput({ sleepQuality: 5, energyLevel: undefined });

      applyReadinessAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBe(1.0);
    });
  });

  describe('calibration', () => {
    it('poor sleep with positive readiness calibration → multiplier less aggressive', () => {
      // Default multiplier for poor sleep = 0.975; calibration +0.02 → 0.995
      const ctx = makeCtx();
      const input = baseInput({
        sleepQuality: 1,
        energyLevel: undefined,
        modifierCalibrations: { readiness: 0.02 },
      });

      applyReadinessAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBeCloseTo(0.995);
    });

    it('neutral readiness — calibration not applied (multiplier already 1.0)', () => {
      const ctx = makeCtx();
      const input = baseInput({
        sleepQuality: undefined,
        energyLevel: undefined,
        modifierCalibrations: { readiness: 0.05 },
      });

      applyReadinessAdjustment(ctx, input);

      expect(ctx.intensityMultiplier).toBe(1.0);
    });
  });
});

// ---------------------------------------------------------------------------
// applyCyclePhaseAdjustment
// ---------------------------------------------------------------------------

describe('applyCyclePhaseAdjustment', () => {
  describe('deload guard', () => {
    it('deload session with menstrual phase → no-op', () => {
      const ctx = makeCtx({ plannedCount: 5 });
      const input = baseInput({ intensityType: 'deload', cyclePhase: 'menstrual' });

      applyCyclePhaseAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.intensityMultiplier).toBe(1.0);
      expect(ctx.cyclePhaseSetsRemoved).toBe(0);
    });

    it('deload session with late_luteal phase → no-op', () => {
      const ctx = makeCtx({ plannedCount: 5 });
      const input = baseInput({ intensityType: 'deload', cyclePhase: 'late_luteal' });

      applyCyclePhaseAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.intensityMultiplier).toBe(1.0);
    });
  });

  describe('non-deload adjustments', () => {
    it('menstrual phase → −1 set + 5% intensity cut', () => {
      const ctx = makeCtx({ plannedCount: 5 });
      const input = baseInput({ cyclePhase: 'menstrual' });

      applyCyclePhaseAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(4);
      expect(ctx.intensityMultiplier).toBeCloseTo(0.95);
      expect(ctx.cyclePhaseSetsRemoved).toBe(1);
    });

    it('luteal phase → 2.5% intensity cut, no set reduction', () => {
      const ctx = makeCtx({ plannedCount: 5 });
      const input = baseInput({ cyclePhase: 'luteal' });

      applyCyclePhaseAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.intensityMultiplier).toBeCloseTo(0.975);
    });

    it('follicular phase → no-op (neutral)', () => {
      const ctx = makeCtx({ plannedCount: 5 });
      const input = baseInput({ cyclePhase: 'follicular' });

      applyCyclePhaseAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.intensityMultiplier).toBe(1.0);
    });

    it('no cycle phase → no-op', () => {
      const ctx = makeCtx({ plannedCount: 5 });
      const input = baseInput({ cyclePhase: undefined });

      applyCyclePhaseAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(5);
      expect(ctx.intensityMultiplier).toBe(1.0);
    });
  });
});
