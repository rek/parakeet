import { describe, expect, it } from 'vitest';

import {
  computeConcentricVelocity,
  computeVelocityLoss,
  estimateRirFromVelocityLoss,
} from '../bar-velocity';

describe('computeConcentricVelocity', () => {
  it('computes velocity from a simple descent-ascent path', () => {
    // 10 frames at 4fps: bar goes from y=0.3 → 0.6 (bottom) → 0.3 (lockout)
    const repPath = [
      { x: 0.5, y: 0.3, frame: 0 },
      { x: 0.5, y: 0.4, frame: 1 },
      { x: 0.5, y: 0.5, frame: 2 },
      { x: 0.5, y: 0.6, frame: 3 }, // bottom
      { x: 0.5, y: 0.5, frame: 4 },
      { x: 0.5, y: 0.4, frame: 5 },
      { x: 0.5, y: 0.3, frame: 6 }, // lockout
      { x: 0.5, y: 0.3, frame: 7 },
    ];

    const velocity = computeConcentricVelocity({ repPath, fps: 4 });
    expect(velocity).not.toBeNull();
    // Concentric: frames 3→6 = 3 frames at 4fps = 0.75s
    // Displacement: (0.6 - 0.3) * 243 = 72.9cm
    // Velocity: 72.9 / 0.75 = 97.2 cm/s
    expect(velocity!).toBeCloseTo(97.2, 0);
  });

  it('returns null for too few frames', () => {
    const repPath = [
      { x: 0.5, y: 0.3, frame: 0 },
      { x: 0.5, y: 0.6, frame: 1 },
    ];
    expect(computeConcentricVelocity({ repPath, fps: 4 })).toBeNull();
  });

  it('returns null when no concentric phase exists', () => {
    // All descending — no ascent
    const repPath = [
      { x: 0.5, y: 0.3, frame: 0 },
      { x: 0.5, y: 0.4, frame: 1 },
      { x: 0.5, y: 0.5, frame: 2 },
      { x: 0.5, y: 0.6, frame: 3 },
    ];
    expect(computeConcentricVelocity({ repPath, fps: 4 })).toBeNull();
  });
});

describe('computeVelocityLoss', () => {
  it('computes loss relative to first rep', () => {
    const losses = computeVelocityLoss({ velocities: [100, 90, 80, 70] });
    expect(losses).toEqual([0, 10, 20, 30]);
  });

  it('handles null velocities', () => {
    const losses = computeVelocityLoss({ velocities: [100, null, 80] });
    expect(losses).toEqual([0, null, 20]);
  });

  it('returns all null for single velocity', () => {
    const losses = computeVelocityLoss({ velocities: [100] });
    expect(losses).toEqual([null]);
  });
});

describe('estimateRirFromVelocityLoss', () => {
  it('returns 6 at 0% velocity loss', () => {
    expect(estimateRirFromVelocityLoss({ velocityLossPct: 0 })).toBe(6);
  });

  it('returns ~2.5 at 20% velocity loss', () => {
    expect(estimateRirFromVelocityLoss({ velocityLossPct: 20 })).toBe(2.5);
  });

  it('returns 0 at 40%+ velocity loss', () => {
    expect(estimateRirFromVelocityLoss({ velocityLossPct: 40 })).toBe(0);
    expect(estimateRirFromVelocityLoss({ velocityLossPct: 50 })).toBe(0);
  });

  it('interpolates between anchors', () => {
    const rir = estimateRirFromVelocityLoss({ velocityLossPct: 15 });
    // Between 10% (4.5 RiR) and 20% (2.5 RiR): midpoint = 3.5
    expect(rir).toBe(3.5);
  });

  it('returns null for null input', () => {
    expect(estimateRirFromVelocityLoss({ velocityLossPct: null })).toBeNull();
  });
});
