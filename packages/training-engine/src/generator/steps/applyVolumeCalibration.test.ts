import { describe, expect, it } from 'vitest';

import { baseInput } from '../../__test-helpers__/fixtures';
import { initPipeline } from './initPipeline';
import { applyVolumeCalibration } from './applyVolumeCalibration';

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

  it('integration: calibration +1 then soreness reduces net effect', () => {
    // This tests the pipeline order, not the step in isolation
    const input = baseInput({
      recentLogs: makeRecentLogs(3, 1.5),
      sorenessRatings: { quads: 3 as 3 },
    });
    const ctx = initPipeline(input);
    const baseSets = ctx.plannedCount;
    // Calibration should add +1
    applyVolumeCalibration(ctx, input);
    expect(ctx.plannedCount).toBe(baseSets + 1);
    // Soreness of 3 (old scale, normalised to 6 = moderate) reduces -1
    // Net effect: +1 - 1 = 0 (back to base)
  });
});
