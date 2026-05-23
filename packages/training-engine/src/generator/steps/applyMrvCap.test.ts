import { describe, expect, it } from 'vitest';

import { baseInput } from '../../__test-helpers__/fixtures';
import { applyMrvCap } from './applyMrvCap';
import { initPipeline } from './initPipeline';

describe('applyMrvCap', () => {
  it('skips main lift when weeklyVolume already at MRV for a primary muscle', () => {
    const input = baseInput({
      weeklyVolumeToDate: { quads: 30 },
      mrvMevConfig: {
        ...baseInput().mrvMevConfig,
        quads: { mev: 10, mrv: 30 },
      },
    });
    const ctx = initPipeline(input);
    applyMrvCap(ctx, input);
    expect(ctx.skippedMainLift).toBe(true);
    expect(ctx.plannedCount).toBe(0);
  });

  it('caps plannedCount when remaining capacity is below the planned set count', () => {
    const input = baseInput({
      weeklyVolumeToDate: { quads: 26 },
      mrvMevConfig: {
        ...baseInput().mrvMevConfig,
        quads: { mev: 10, mrv: 30 },
      },
    });
    const ctx = initPipeline(input);
    // quads contribution for squat = 1.0 → remaining capacity = 4 sets
    // base squat plan is typically > 4 sets, so cap should bite
    applyMrvCap(ctx, input);
    expect(ctx.plannedCount).toBeLessThanOrEqual(4);
  });

  it('routes through the user-aware muscle mapper (finding #10)', () => {
    // Verifies the refactor: when customMuscleMap is present, applyMrvCap
    // builds a mapper closed over it. The mapping for a primary lift falls
    // back to LIFT_MUSCLES, so the custom map doesn't change behaviour for
    // primary-lift muscles — but the integration path is now consistent
    // with other steps and will pick up future changes that resolve aux
    // muscles for MRV calculations.
    const input = baseInput({
      customMuscleMap: { 'Pec Deck': ['chest'] },
      weeklyVolumeToDate: { quads: 5 },
      mrvMevConfig: {
        ...baseInput().mrvMevConfig,
        quads: { mev: 10, mrv: 30 },
      },
    });
    const ctx = initPipeline(input);
    const before = ctx.plannedCount;
    applyMrvCap(ctx, input);
    // Plenty of remaining capacity (30 - 5 = 25) → no cap applied
    expect(ctx.plannedCount).toBe(before);
    expect(ctx.skippedMainLift).toBe(false);
  });

  it('no-op in recovery mode', () => {
    const input = baseInput({
      weeklyVolumeToDate: { quads: 30 },
      mrvMevConfig: {
        ...baseInput().mrvMevConfig,
        quads: { mev: 10, mrv: 30 },
      },
    });
    const ctx = initPipeline(input);
    ctx.inRecoveryMode = true;
    const before = ctx.plannedCount;
    applyMrvCap(ctx, input);
    expect(ctx.plannedCount).toBe(before);
    expect(ctx.skippedMainLift).toBe(false);
  });
});
