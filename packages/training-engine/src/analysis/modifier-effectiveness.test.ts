import { describe, it, expect } from 'vitest';

import {
  applyCalibrationAdjustment,
  canAutoApply,
  computeCalibrationBias,
  extractModifierSamples,
  shouldTriggerReview,
} from './modifier-effectiveness';
import type { ModifierSample } from './modifier-effectiveness';

function makeSamples(count: number, rpeTarget: number, rpeActual: number): ModifierSample[] {
  return Array.from({ length: count }, () => ({
    modifierSource: 'soreness' as const,
    multiplier: 0.85,
    rpeTarget,
    rpeActual,
  }));
}

describe('computeCalibrationBias', () => {
  it('returns exploring confidence with zero samples', () => {
    const result = computeCalibrationBias({ samples: [] });
    expect(result.confidence).toBe('exploring');
    expect(result.sampleCount).toBe(0);
    expect(result.suggestedAdjustment).toBe(0);
  });

  it('detects negative bias (too easy → modifier too aggressive)', () => {
    // RPE target 8, actual 6 → bias = -2.0 → modifier should be less aggressive
    const samples = makeSamples(12, 8, 6);
    const result = computeCalibrationBias({ samples });

    expect(result.meanBias).toBe(-2);
    expect(result.suggestedAdjustment).toBeGreaterThan(0); // positive = less aggressive
    expect(result.confidence).toBe('medium');
  });

  it('detects positive bias (too hard → modifier too conservative)', () => {
    // RPE target 8, actual 9.5 → bias = +1.5 → modifier should be more aggressive
    const samples = makeSamples(12, 8, 9.5);
    const result = computeCalibrationBias({ samples });

    expect(result.meanBias).toBe(1.5);
    expect(result.suggestedAdjustment).toBeLessThan(0); // negative = more aggressive
  });

  it('returns near-zero adjustment when modifier is well-calibrated', () => {
    // RPE target 8, actual 8.1 → bias ≈ 0
    const samples = makeSamples(20, 8, 8.1);
    const result = computeCalibrationBias({ samples });

    expect(Math.abs(result.suggestedAdjustment)).toBeLessThan(0.01);
    expect(result.confidence).toBe('high');
  });

  it('assigns low confidence for 5-9 samples', () => {
    const samples = makeSamples(7, 8, 6);
    const result = computeCalibrationBias({ samples });
    expect(result.confidence).toBe('low');
  });

  it('assigns exploring confidence for < 5 samples', () => {
    const samples = makeSamples(3, 8, 6);
    const result = computeCalibrationBias({ samples });
    expect(result.confidence).toBe('exploring');
  });

  it('assigns high confidence for 20+ samples', () => {
    const samples = makeSamples(25, 8, 7.8);
    const result = computeCalibrationBias({ samples });
    expect(result.confidence).toBe('high');
  });

  it('clamps extreme adjustments to ±0.15', () => {
    // RPE target 8, actual 4 → bias = -4 → raw adjustment = 0.20 → clamped to 0.15
    const samples = makeSamples(20, 8, 4);
    const result = computeCalibrationBias({ samples });
    expect(result.suggestedAdjustment).toBe(0.15);
  });
});

describe('shouldTriggerReview', () => {
  it('returns false for exploring confidence (not enough data)', () => {
    const result = shouldTriggerReview({
      calibration: { modifierSource: 'soreness', sampleCount: 3, meanBias: -2, suggestedAdjustment: 0.1, confidence: 'exploring' },
    });
    expect(result).toBe(false);
  });

  it('returns true for low confidence', () => {
    const result = shouldTriggerReview({
      calibration: { modifierSource: 'soreness', sampleCount: 7, meanBias: -1, suggestedAdjustment: 0.03, confidence: 'low' },
    });
    expect(result).toBe(true);
  });

  it('returns true for large adjustment (> 5%)', () => {
    const result = shouldTriggerReview({
      calibration: { modifierSource: 'soreness', sampleCount: 15, meanBias: -2, suggestedAdjustment: 0.10, confidence: 'medium' },
    });
    expect(result).toBe(true);
  });

  it('returns false for small adjustment with medium confidence', () => {
    const result = shouldTriggerReview({
      calibration: { modifierSource: 'readiness', sampleCount: 15, meanBias: -0.3, suggestedAdjustment: 0.015, confidence: 'medium' },
    });
    expect(result).toBe(false);
  });

  it('returns true when direction flips from previous adjustment', () => {
    const result = shouldTriggerReview({
      calibration: { modifierSource: 'soreness', sampleCount: 15, meanBias: 0.5, suggestedAdjustment: -0.025, confidence: 'medium' },
      previousAdjustment: 0.03, // was positive, now negative → flip
    });
    expect(result).toBe(true);
  });
});

describe('canAutoApply', () => {
  it('returns false for exploring confidence', () => {
    expect(canAutoApply({
      calibration: { modifierSource: 'soreness', sampleCount: 3, meanBias: -1, suggestedAdjustment: 0.02, confidence: 'exploring' },
    })).toBe(false);
  });

  it('returns false for low confidence', () => {
    expect(canAutoApply({
      calibration: { modifierSource: 'soreness', sampleCount: 7, meanBias: -1, suggestedAdjustment: 0.02, confidence: 'low' },
    })).toBe(false);
  });

  it('returns false for large adjustment', () => {
    expect(canAutoApply({
      calibration: { modifierSource: 'soreness', sampleCount: 15, meanBias: -2, suggestedAdjustment: 0.10, confidence: 'medium' },
    })).toBe(false);
  });

  it('returns true for small adjustment with medium confidence', () => {
    expect(canAutoApply({
      calibration: { modifierSource: 'readiness', sampleCount: 15, meanBias: -0.3, suggestedAdjustment: 0.015, confidence: 'medium' },
    })).toBe(true);
  });

  it('returns true for small adjustment with high confidence', () => {
    expect(canAutoApply({
      calibration: { modifierSource: 'readiness', sampleCount: 25, meanBias: -0.2, suggestedAdjustment: 0.01, confidence: 'high' },
    })).toBe(true);
  });
});

describe('extractModifierSamples', () => {
  it('extracts samples from trace modifiers', () => {
    const samples = extractModifierSamples({
      modifiers: [
        { source: 'soreness', multiplier: 0.85, reason: 'Soreness level 3' },
        { source: 'readiness', multiplier: 0.95, reason: 'Poor sleep' },
      ],
      rpeTarget: 8,
      rpeActual: 7,
    });

    expect(samples).toHaveLength(2);
    expect(samples[0].modifierSource).toBe('soreness');
    expect(samples[0].multiplier).toBe(0.85);
    expect(samples[0].rpeTarget).toBe(8);
    expect(samples[0].rpeActual).toBe(7);
    expect(samples[1].modifierSource).toBe('readiness');
  });

  it('returns empty array when no modifiers active', () => {
    const samples = extractModifierSamples({
      modifiers: [],
      rpeTarget: 8,
      rpeActual: 8,
    });
    expect(samples).toHaveLength(0);
  });
});

describe('applyCalibrationAdjustment', () => {
  it('makes modifier less aggressive (positive adjustment)', () => {
    // Default ×0.85, adjustment +0.07 → ×0.92
    const result = applyCalibrationAdjustment({ defaultMultiplier: 0.85, adjustment: 0.07 });
    expect(result).toBeCloseTo(0.92);
  });

  it('makes modifier more aggressive (negative adjustment)', () => {
    // Default ×0.95, adjustment -0.05 → ×0.90
    const result = applyCalibrationAdjustment({ defaultMultiplier: 0.95, adjustment: -0.05 });
    expect(result).toBeCloseTo(0.90);
  });

  it('clamps to minimum 0.5', () => {
    const result = applyCalibrationAdjustment({ defaultMultiplier: 0.5, adjustment: -0.1 });
    expect(result).toBe(0.5);
  });

  it('clamps to maximum 1.2', () => {
    const result = applyCalibrationAdjustment({ defaultMultiplier: 1.1, adjustment: 0.15 });
    expect(result).toBe(1.2);
  });

  it('no adjustment returns default', () => {
    const result = applyCalibrationAdjustment({ defaultMultiplier: 0.90, adjustment: 0 });
    expect(result).toBe(0.90);
  });
});
