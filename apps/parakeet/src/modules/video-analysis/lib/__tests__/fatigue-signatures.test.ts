import { describe, expect, it } from 'vitest';

import type { RepAnalysis } from '@parakeet/shared-types';

import { computeFatigueSignatures } from '../fatigue-signatures';

/** Helper to build a minimal RepAnalysis with only the fields fatigue cares about. */
function makeRep(overrides: Partial<RepAnalysis> & { repNumber: number }): RepAnalysis {
  return {
    startFrame: 0,
    endFrame: 10,
    barPath: [],
    faults: [],
    ...overrides,
  };
}

describe('computeFatigueSignatures', () => {
  it('returns null for fewer than 2 reps', () => {
    expect(computeFatigueSignatures({ reps: [] })).toBeNull();
    expect(computeFatigueSignatures({ reps: [makeRep({ repNumber: 1 })] })).toBeNull();
  });

  it('computes correct deltas for a flat set (no fatigue)', () => {
    const reps = [
      makeRep({
        repNumber: 1,
        forwardLeanDeg: 15,
        barDriftCm: 3,
        romCm: 50,
        eccentricDurationSec: 1.5,
        hipAngleAtLockoutDeg: 170,
        velocityLossPct: 0,
      }),
      makeRep({
        repNumber: 2,
        forwardLeanDeg: 15,
        barDriftCm: 3,
        romCm: 50,
        eccentricDurationSec: 1.5,
        hipAngleAtLockoutDeg: 170,
        velocityLossPct: 5,
      }),
      makeRep({
        repNumber: 3,
        forwardLeanDeg: 15,
        barDriftCm: 3,
        romCm: 50,
        eccentricDurationSec: 1.5,
        hipAngleAtLockoutDeg: 170,
        velocityLossPct: 5,
      }),
    ];

    const result = computeFatigueSignatures({ reps })!;
    expect(result.forwardLeanDriftDeg).toBe(0);
    expect(result.barDriftIncreaseCm).toBe(0);
    expect(result.romCompressionCm).toBe(0);
    expect(result.descentSpeedChange).toBe(1);
    expect(result.lockoutDegradationDeg).toBe(0);
  });

  it('detects progressive fatigue', () => {
    const reps = [
      makeRep({
        repNumber: 1,
        forwardLeanDeg: 10,
        barDriftCm: 2,
        romCm: 55,
        eccentricDurationSec: 1.2,
        hipAngleAtLockoutDeg: 175,
        velocityLossPct: 0,
      }),
      makeRep({
        repNumber: 2,
        forwardLeanDeg: 13,
        barDriftCm: 3.5,
        romCm: 52,
        eccentricDurationSec: 1.4,
        hipAngleAtLockoutDeg: 172,
        velocityLossPct: 10,
      }),
      makeRep({
        repNumber: 3,
        forwardLeanDeg: 16,
        barDriftCm: 5,
        romCm: 48,
        eccentricDurationSec: 1.6,
        hipAngleAtLockoutDeg: 168,
        velocityLossPct: 20,
      }),
      makeRep({
        repNumber: 4,
        forwardLeanDeg: 20,
        barDriftCm: 7,
        romCm: 44,
        eccentricDurationSec: 1.8,
        hipAngleAtLockoutDeg: 164,
        velocityLossPct: 30,
      }),
      makeRep({
        repNumber: 5,
        forwardLeanDeg: 24,
        barDriftCm: 9,
        romCm: 40,
        eccentricDurationSec: 2.0,
        hipAngleAtLockoutDeg: 160,
        velocityLossPct: 40,
      }),
    ];

    const result = computeFatigueSignatures({ reps })!;

    // Lean: 24 - 10 = +14 (increasing lean = fatiguing posterior chain)
    expect(result.forwardLeanDriftDeg).toBe(14);

    // Bar drift: 9 - 2 = +7 (increasing drift = motor control loss)
    expect(result.barDriftIncreaseCm).toBe(7);

    // ROM: 55 - 40 = +15 (reps getting shorter)
    expect(result.romCompressionCm).toBe(15);

    // Descent speed: 2.0 / 1.2 ≈ 1.67 (slowing down)
    expect(result.descentSpeedChange).toBeCloseTo(1.67, 1);

    // Lockout: 175 - 160 = +15 (degrading lockout)
    expect(result.lockoutDegradationDeg).toBe(15);

    // Velocity: monotonically increasing loss
    expect(result.velocityLossTrend).toBe('increasing');
  });

  it('detects improving set (negative fatigue)', () => {
    const reps = [
      makeRep({
        repNumber: 1,
        forwardLeanDeg: 20,
        barDriftCm: 6,
        romCm: 42,
        eccentricDurationSec: 2.0,
        hipAngleAtLockoutDeg: 162,
        velocityLossPct: 20,
      }),
      makeRep({
        repNumber: 2,
        forwardLeanDeg: 17,
        barDriftCm: 4,
        romCm: 46,
        eccentricDurationSec: 1.6,
        hipAngleAtLockoutDeg: 167,
        velocityLossPct: 12,
      }),
      makeRep({
        repNumber: 3,
        forwardLeanDeg: 14,
        barDriftCm: 3,
        romCm: 50,
        eccentricDurationSec: 1.4,
        hipAngleAtLockoutDeg: 172,
        velocityLossPct: 5,
      }),
    ];

    const result = computeFatigueSignatures({ reps })!;

    // Improving: lean decreasing, drift decreasing, ROM expanding
    expect(result.forwardLeanDriftDeg).toBe(-6);
    expect(result.barDriftIncreaseCm).toBe(-3);
    expect(result.romCompressionCm).toBe(-8);
    expect(result.descentSpeedChange).toBe(0.7);
    expect(result.lockoutDegradationDeg).toBe(-10);
    expect(result.velocityLossTrend).toBe('decreasing');
  });

  it('handles mixed/partial data gracefully', () => {
    const reps = [
      makeRep({
        repNumber: 1,
        forwardLeanDeg: 15,
        // barDriftCm missing
        romCm: 50,
      }),
      makeRep({
        repNumber: 2,
        // forwardLeanDeg missing
        barDriftCm: 5,
        romCm: 45,
      }),
    ];

    const result = computeFatigueSignatures({ reps })!;

    // Both need first AND last to have data
    expect(result.forwardLeanDriftDeg).toBeNull();
    expect(result.barDriftIncreaseCm).toBeNull();
    expect(result.romCompressionCm).toBe(5);
    expect(result.descentSpeedChange).toBeNull();
    expect(result.lockoutDegradationDeg).toBeNull();
    expect(result.velocityLossTrend).toBeNull(); // <3 velocity data points
  });

  it('classifies stable velocity trend correctly', () => {
    const reps = [
      makeRep({ repNumber: 1, velocityLossPct: 0 }),
      makeRep({ repNumber: 2, velocityLossPct: 5 }),
      makeRep({ repNumber: 3, velocityLossPct: 3 }),
      makeRep({ repNumber: 4, velocityLossPct: 6 }),
      makeRep({ repNumber: 5, velocityLossPct: 4 }),
    ];

    const result = computeFatigueSignatures({ reps })!;
    // Alternating up/down — no clear direction
    expect(result.velocityLossTrend).toBe('stable');
  });

  it('uses only first and last rep for scalar deltas', () => {
    // Middle reps are irrelevant to the delta calculation
    const reps = [
      makeRep({ repNumber: 1, forwardLeanDeg: 10, romCm: 55 }),
      makeRep({ repNumber: 2, forwardLeanDeg: 999, romCm: 1 }), // extreme middle rep
      makeRep({ repNumber: 3, forwardLeanDeg: 14, romCm: 50 }),
    ];

    const result = computeFatigueSignatures({ reps })!;
    expect(result.forwardLeanDriftDeg).toBe(4);   // 14 - 10, not affected by middle
    expect(result.romCompressionCm).toBe(5);       // 55 - 50, not affected by middle
  });
});
