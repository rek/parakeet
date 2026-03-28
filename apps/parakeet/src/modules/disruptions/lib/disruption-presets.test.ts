import { describe, expect, it } from 'vitest';

import {
  getMenstrualSymptomsPreset,
  inferEffectiveSeverity,
  SORENESS_NUMERIC,
  type SorenessLevel,
} from './disruption-presets';

describe('SORENESS_NUMERIC', () => {
  const levels: SorenessLevel[] = ['none', 'mild', 'sore', 'very_sore'];

  it('defines all four soreness levels', () => {
    for (const level of levels) {
      expect(SORENESS_NUMERIC[level]).toBeDefined();
    }
  });

  it('values are positive integers', () => {
    for (const level of levels) {
      const v = SORENESS_NUMERIC[level];
      expect(v).toBeGreaterThan(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('values are strictly increasing across severity', () => {
    expect(SORENESS_NUMERIC.none).toBeLessThan(SORENESS_NUMERIC.mild);
    expect(SORENESS_NUMERIC.mild).toBeLessThan(SORENESS_NUMERIC.sore);
    expect(SORENESS_NUMERIC.sore).toBeLessThan(SORENESS_NUMERIC.very_sore);
  });

  it('none maps to 1', () => {
    expect(SORENESS_NUMERIC.none).toBe(1);
  });

  it('mild maps to 3', () => {
    expect(SORENESS_NUMERIC.mild).toBe(3);
  });

  it('sore maps to 6', () => {
    expect(SORENESS_NUMERIC.sore).toBe(6);
  });

  it('very_sore maps to 8', () => {
    expect(SORENESS_NUMERIC.very_sore).toBe(8);
  });

  it('values fall within the expected range of 1-10', () => {
    for (const level of levels) {
      const v = SORENESS_NUMERIC[level];
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
});

describe('inferEffectiveSeverity', () => {
  it('returns major for unprogrammed_event regardless of selectedSeverity', () => {
    expect(inferEffectiveSeverity('unprogrammed_event', null)).toBe('major');
    expect(inferEffectiveSeverity('unprogrammed_event', 'minor')).toBe('major');
    expect(inferEffectiveSeverity('unprogrammed_event', 'major')).toBe('major');
  });

  it('returns the provided severity for fatigue type', () => {
    expect(inferEffectiveSeverity('fatigue', 'minor')).toBe('minor');
    expect(inferEffectiveSeverity('fatigue', 'major')).toBe('major');
  });

  it('returns null when selectedSeverity is null for non-unprogrammed types', () => {
    expect(inferEffectiveSeverity('fatigue', null)).toBeNull();
    expect(inferEffectiveSeverity('injury', null)).toBeNull();
    expect(inferEffectiveSeverity('illness', null)).toBeNull();
  });

  it('returns the provided severity for injury type', () => {
    expect(inferEffectiveSeverity('injury', 'minor')).toBe('minor');
    expect(inferEffectiveSeverity('injury', 'major')).toBe('major');
  });

  it('returns the provided severity for illness type', () => {
    expect(inferEffectiveSeverity('illness', 'major')).toBe('major');
  });
});

describe('getMenstrualSymptomsPreset', () => {
  it('returns a preset with type fatigue', () => {
    expect(getMenstrualSymptomsPreset().type).toBe('fatigue');
  });

  it('returns a preset with severity minor', () => {
    expect(getMenstrualSymptomsPreset().severity).toBe('minor');
  });

  it('returns a preset with allLifts true', () => {
    expect(getMenstrualSymptomsPreset().allLifts).toBe(true);
  });

  it('returns a Set containing all three training lifts', () => {
    const preset = getMenstrualSymptomsPreset();
    expect(preset.lifts).toBeInstanceOf(Set);
    expect(preset.lifts.has('squat')).toBe(true);
    expect(preset.lifts.has('bench')).toBe(true);
    expect(preset.lifts.has('deadlift')).toBe(true);
  });

  it('lift set size matches the number of training lifts', () => {
    expect(getMenstrualSymptomsPreset().lifts.size).toBe(3);
  });

  it('returns a non-empty description string', () => {
    const { description } = getMenstrualSymptomsPreset();
    expect(typeof description).toBe('string');
    expect(description.length).toBeGreaterThan(0);
  });

  it('description is Menstrual symptoms', () => {
    expect(getMenstrualSymptomsPreset().description).toBe('Menstrual symptoms');
  });

  it('returns a fresh Set on each call (not shared state)', () => {
    const a = getMenstrualSymptomsPreset();
    const b = getMenstrualSymptomsPreset();
    expect(a.lifts).not.toBe(b.lifts);
  });
});
