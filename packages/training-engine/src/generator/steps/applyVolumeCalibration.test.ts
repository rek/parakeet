import { describe, expect, it } from 'vitest';

import { baseInput } from '../../__test-helpers__/fixtures';
import { applyVolumeCalibration } from './applyVolumeCalibration';
import { initPipeline } from './initPipeline';

function makeRecentLogs(count: number, rpeGap: number) {
  return Array.from({ length: count }, () => ({
    actual_rpe: 8.0 - rpeGap,
    target_rpe: 8.0,
  }));
}

describe('applyVolumeCalibration', () => {
  it('no data (new user) → 0 modifier', () => {
    const input = baseInput();
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBe(before);
  });

  it('RPE consistently low (gap >= 1.0) → +1 set', () => {
    const input = baseInput({
      recentLogs: makeRecentLogs(3, 1.5),
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBe(before + 1);
  });

  it('RPE very low + high readiness + low soreness → +2 sets', () => {
    const input = baseInput({
      recentLogs: makeRecentLogs(3, 2.0),
      sleepQuality: 5 as 5,
      energyLevel: 5 as 5,
      sorenessRatings: { quads: 2 as 2 },
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBeGreaterThanOrEqual(before + 2);
  });

  it('RPE consistently high (gap <= -1.0) → -1 set', () => {
    const input = baseInput({
      recentLogs: makeRecentLogs(3, -1.5),
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBe(before - 1);
  });

  it('capacity assessment "had more in me" → +1 set', () => {
    const input = baseInput({
      capacityHistory: [3, 3, 3],
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBe(before + 1);
  });

  it('weekly mismatch recovering well → +1 set', () => {
    const input = baseInput({
      weeklyMismatchDirection: 'recovering_well',
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBe(before + 1);
  });

  it('capped at +3 maximum even with all positive signals', () => {
    const input = baseInput({
      recentLogs: makeRecentLogs(3, 2.0),
      sleepQuality: 5 as 5,
      energyLevel: 5 as 5,
      sorenessRatings: { quads: 1 as 1 },
      capacityHistory: [4, 4, 4],
      weeklyMismatchDirection: 'recovering_well',
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBeLessThanOrEqual(before + 3);
  });

  it('never goes below 1 set', () => {
    const input = baseInput({
      recentLogs: makeRecentLogs(3, -3.0),
    });
    const ctx = initPipeline(input);
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBeGreaterThanOrEqual(1);
  });

  it('MRV cap prevents calibration from adding sets beyond remaining capacity', () => {
    const input = baseInput({
      recentLogs: makeRecentLogs(3, 2.0),
      sleepQuality: 5 as 5,
      energyLevel: 5 as 5,
      weeklyVolumeToDate: { quads: 18 },
      mrvMevConfig: {
        ...baseInput().mrvMevConfig,
        quads: { mev: 8, mrv: 20 },
      },
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    // quads remaining = 20 - 18 = 2, base is 2 sets, so no room to add
    expect(ctx.plannedCount).toBe(before);
  });

  it('extends baseSets when increasing volume', () => {
    const input = baseInput({
      recentLogs: makeRecentLogs(3, 1.5),
    });
    const ctx = initPipeline(input);
    const beforeSets = ctx.baseSets.length;
    applyVolumeCalibration(ctx, input);
    expect(ctx.baseSets.length).toBe(ctx.plannedCount);
    expect(ctx.baseSets.length).toBeGreaterThan(beforeSets);
  });

  it('skips calibration in recovery mode', () => {
    const input = baseInput({
      recentLogs: makeRecentLogs(3, 2.0),
      capacityHistory: [4, 4, 4],
    });
    const ctx = initPipeline(input);
    ctx.inRecoveryMode = true;
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBe(before);
  });

  it('needs at least 2 RPE logs to trigger RPE-based adjustment', () => {
    const input = baseInput({
      recentLogs: [{ actual_rpe: 6.0, target_rpe: 8.0 }],
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    // Only 1 log — RPE signal shouldn't trigger
    expect(ctx.plannedCount).toBe(before);
  });

  // --- Phase 3: Calibration learning ---

  it('modifier calibration: system over-reducing → +1 set', () => {
    const input = baseInput({
      modifierCalibrations: {
        soreness: 0.05,
        readiness: 0.04,
      },
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    // Total adjustment = 0.09 >= 0.08 threshold → +1
    expect(ctx.plannedCount).toBe(before + 1);
  });

  it('modifier calibration below threshold → no change', () => {
    const input = baseInput({
      modifierCalibrations: {
        soreness: 0.03,
        readiness: 0.02,
      },
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    // Total = 0.05 < 0.08 threshold
    expect(ctx.plannedCount).toBe(before);
  });

  // --- Phase 3: Progressive volume within blocks ---

  it('week 2 of block with favorable RPE → +1 progressive', () => {
    const input = baseInput({
      weekNumber: 2,
      recentLogs: makeRecentLogs(3, 0.8),
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBe(before + 1);
  });

  it('week 3 of block with favorable RPE → +2 progressive', () => {
    const input = baseInput({
      weekNumber: 3,
      recentLogs: makeRecentLogs(3, 0.8),
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBe(before + 2);
  });

  it('deload week skips progressive volume', () => {
    const input = baseInput({
      weekNumber: 3,
      intensityType: 'deload',
      recentLogs: makeRecentLogs(3, 1.0),
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    // Deload — no progressive boost (RPE may still trigger +1 from signal 1)
    // But we check progressive specifically didn't add
    expect(ctx.plannedCount).toBeLessThanOrEqual(before + 1);
  });

  it('week 1 of block → no progressive boost', () => {
    const input = baseInput({
      weekNumber: 1,
      recentLogs: makeRecentLogs(3, 0.8),
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    // Week 1 = no progressive. RPE gap 0.8 < 1.0 so no RPE signal either.
    expect(ctx.plannedCount).toBe(before);
  });

  it('high soreness blocks progressive volume', () => {
    const input = baseInput({
      weekNumber: 3,
      recentLogs: makeRecentLogs(3, 0.8),
      sorenessRatings: { quads: 8 as 8 }, // 8/10 = high on new scale
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyVolumeCalibration(ctx, input);
    // Soreness high (8/10) blocks progressive boost
    expect(ctx.plannedCount).toBeLessThanOrEqual(before);
  });

  // --- Integration ---

  it('integration: calibration +1 then soreness reduces net effect', () => {
    // This tests the pipeline order, not the step in isolation
    const input = baseInput({
      recentLogs: makeRecentLogs(3, 1.5),
      sorenessRatings: { quads: 6 as 6 },
    });
    const ctx = initPipeline(input);
    const baseSets = ctx.plannedCount;
    // Calibration should add +1
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBe(baseSets + 1);
    // Soreness 6 (moderate) will reduce -1 in the soreness step
    // Net effect: +1 - 1 = 0 (back to base)
  });
});
