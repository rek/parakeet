import { describe, expect, it } from 'vitest';

import {
  clampCycleLength,
  computeNextPeriodDate,
  CYCLE_LENGTH_MAX,
  CYCLE_LENGTH_MIN,
} from './cycle-math';

describe('clampCycleLength', () => {
  it('clamps below minimum to CYCLE_LENGTH_MIN (24)', () => {
    expect(clampCycleLength(20)).toBe(CYCLE_LENGTH_MIN);
    expect(clampCycleLength(0)).toBe(CYCLE_LENGTH_MIN);
  });

  it('clamps above maximum to CYCLE_LENGTH_MAX (35)', () => {
    expect(clampCycleLength(40)).toBe(CYCLE_LENGTH_MAX);
    expect(clampCycleLength(100)).toBe(CYCLE_LENGTH_MAX);
  });

  it('returns value unchanged when within range', () => {
    expect(clampCycleLength(28)).toBe(28);
    expect(clampCycleLength(24)).toBe(24);
    expect(clampCycleLength(35)).toBe(35);
  });
});

describe('computeNextPeriodDate', () => {
  it('adds cycleLength days to lastPeriodStart and returns ISO date string', () => {
    expect(computeNextPeriodDate('2026-01-01', 28)).toBe('2026-01-29');
  });

  it('handles month boundaries correctly', () => {
    expect(computeNextPeriodDate('2026-01-15', 28)).toBe('2026-02-12');
  });

  it('handles year boundaries correctly', () => {
    expect(computeNextPeriodDate('2025-12-20', 28)).toBe('2026-01-17');
  });

  it('handles the minimum cycle length', () => {
    expect(computeNextPeriodDate('2026-03-01', 24)).toBe('2026-03-25');
  });

  it('handles the maximum cycle length', () => {
    expect(computeNextPeriodDate('2026-03-01', 35)).toBe('2026-04-05');
  });

  it('returns a plain ISO date string with no time component', () => {
    const result = computeNextPeriodDate('2026-06-01', 28);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
