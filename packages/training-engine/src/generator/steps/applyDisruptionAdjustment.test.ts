import { describe, expect, it } from 'vitest';

import { baseInput, makeDisruption } from '../../__test-helpers__/fixtures';
import { applyDisruptionAdjustment } from './applyDisruptionAdjustment';
import { initPipeline } from './initPipeline';

describe('applyDisruptionAdjustment', () => {
  describe('deload guard', () => {
    it('moderate disruption on deload — no set reduction, rationale notes disruption', () => {
      const input = baseInput({
        intensityType: 'deload',
        activeDisruptions: [makeDisruption('moderate')],
      });
      const ctx = initPipeline(input);
      const plannedBefore = ctx.plannedCount;
      const multiplierBefore = ctx.intensityMultiplier;

      applyDisruptionAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(plannedBefore);
      expect(ctx.intensityMultiplier).toBe(multiplierBefore);
      expect(ctx.skippedMainLift).toBe(false);
      expect(ctx.rationale).toContain(
        'Active disruption noted — deload session proceeds unchanged'
      );
    });

    it('major disruption on deload — session NOT skipped, rationale notes disruption', () => {
      const input = baseInput({
        intensityType: 'deload',
        activeDisruptions: [makeDisruption('major')],
      });
      const ctx = initPipeline(input);
      const plannedBefore = ctx.plannedCount;

      applyDisruptionAdjustment(ctx, input);

      expect(ctx.skippedMainLift).toBe(false);
      expect(ctx.plannedCount).toBe(plannedBefore);
      expect(ctx.rationale).toContain(
        'Active disruption noted — deload session proceeds unchanged'
      );
    });

    it('no disruption on deload — rationale unchanged', () => {
      const input = baseInput({
        intensityType: 'deload',
        activeDisruptions: [],
      });
      const ctx = initPipeline(input);
      const rationaleBefore = [...ctx.rationale];

      applyDisruptionAdjustment(ctx, input);

      expect(ctx.rationale).toEqual(rationaleBefore);
    });
  });

  describe('non-deload sessions', () => {
    it('moderate disruption — reduces sets and intensity', () => {
      const input = baseInput({
        intensityType: 'heavy',
        activeDisruptions: [makeDisruption('moderate')],
      });
      const ctx = initPipeline(input);
      const plannedBefore = ctx.plannedCount;

      applyDisruptionAdjustment(ctx, input);

      expect(ctx.plannedCount).toBeLessThan(plannedBefore);
      expect(ctx.intensityMultiplier).toBeLessThanOrEqual(0.9);
    });

    it('major disruption — skips main lift', () => {
      const input = baseInput({
        intensityType: 'heavy',
        activeDisruptions: [makeDisruption('major')],
      });
      const ctx = initPipeline(input);

      applyDisruptionAdjustment(ctx, input);

      expect(ctx.skippedMainLift).toBe(true);
      expect(ctx.plannedCount).toBe(0);
    });

    it('no disruption — no change', () => {
      const input = baseInput({
        intensityType: 'heavy',
        activeDisruptions: [],
      });
      const ctx = initPipeline(input);
      const plannedBefore = ctx.plannedCount;

      applyDisruptionAdjustment(ctx, input);

      expect(ctx.plannedCount).toBe(plannedBefore);
      expect(ctx.skippedMainLift).toBe(false);
    });
  });
});
