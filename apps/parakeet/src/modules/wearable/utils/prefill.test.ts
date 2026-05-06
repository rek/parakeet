import { describe, expect, it } from 'vitest';

import { mapAutonomicToLevel, mapSleepDurationToLevel } from './prefill';

describe('mapSleepDurationToLevel', () => {
  it('returns null when duration is null', () => {
    expect(mapSleepDurationToLevel(null)).toBeNull();
  });

  it('maps <4h to 1', () => {
    expect(mapSleepDurationToLevel(180)).toBe(1);
    expect(mapSleepDurationToLevel(239)).toBe(1);
  });

  it('maps 4-5.5h to 2', () => {
    expect(mapSleepDurationToLevel(240)).toBe(2);
    expect(mapSleepDurationToLevel(300)).toBe(2);
    expect(mapSleepDurationToLevel(329)).toBe(2);
  });

  it('maps 5.5-7h to 3', () => {
    expect(mapSleepDurationToLevel(330)).toBe(3);
    expect(mapSleepDurationToLevel(390)).toBe(3);
    expect(mapSleepDurationToLevel(419)).toBe(3);
  });

  it('maps 7-8.5h to 4', () => {
    expect(mapSleepDurationToLevel(420)).toBe(4);
    expect(mapSleepDurationToLevel(480)).toBe(4);
    expect(mapSleepDurationToLevel(509)).toBe(4);
  });

  it('maps >=8.5h to 5', () => {
    expect(mapSleepDurationToLevel(510)).toBe(5);
    expect(mapSleepDurationToLevel(600)).toBe(5);
  });

  it('returns null for non-finite or negative input', () => {
    expect(mapSleepDurationToLevel(Number.NaN)).toBeNull();
    expect(mapSleepDurationToLevel(Number.POSITIVE_INFINITY)).toBeNull();
    expect(mapSleepDurationToLevel(-1)).toBeNull();
  });

  it('treats 0 minutes as level 1', () => {
    expect(mapSleepDurationToLevel(0)).toBe(1);
  });
});

describe('mapAutonomicToLevel', () => {
  it('returns null when both signals are null', () => {
    expect(mapAutonomicToLevel(null, null)).toBeNull();
  });

  it('uses HRV alone when RHR null', () => {
    expect(mapAutonomicToLevel(20, null)).toBe(5);
    expect(mapAutonomicToLevel(-25, null)).toBe(1);
    expect(mapAutonomicToLevel(0, null)).toBe(3);
  });

  it('inverts RHR alone when HRV null (RHR up = worse)', () => {
    expect(mapAutonomicToLevel(null, -20)).toBe(5);
    expect(mapAutonomicToLevel(null, 25)).toBe(1);
    expect(mapAutonomicToLevel(null, 0)).toBe(3);
  });

  it('averages HRV and inverted RHR when both present', () => {
    expect(mapAutonomicToLevel(20, -20)).toBe(5);
    expect(mapAutonomicToLevel(-20, 20)).toBe(1);
    expect(mapAutonomicToLevel(10, -10)).toBe(4);
    expect(mapAutonomicToLevel(-10, 10)).toBe(2);
    expect(mapAutonomicToLevel(0, 0)).toBe(3);
  });

  it('clamps boundaries correctly', () => {
    expect(mapAutonomicToLevel(-10, null)).toBe(2);
    expect(mapAutonomicToLevel(-9, null)).toBe(3);
    expect(mapAutonomicToLevel(15, null)).toBe(5);
    expect(mapAutonomicToLevel(14, null)).toBe(4);
  });

  it('treats non-finite signals as missing', () => {
    expect(mapAutonomicToLevel(Number.NaN, Number.NaN)).toBeNull();
    expect(mapAutonomicToLevel(Number.NaN, null)).toBeNull();
    expect(mapAutonomicToLevel(Number.POSITIVE_INFINITY, null)).toBeNull();
    expect(mapAutonomicToLevel(Number.NaN, -10)).toBe(4);
    expect(mapAutonomicToLevel(20, Number.NaN)).toBe(5);
  });
});
