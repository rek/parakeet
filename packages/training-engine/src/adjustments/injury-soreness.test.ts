import { describe, expect, it } from 'vitest';

import { makeDisruption } from '../__test-helpers__/fixtures';
import type { MuscleGroup } from '../types';
import type { SorenessLevel } from './soreness-adjuster';
import {
  computeInjurySorenessOverrides,
  INJURY_SORENESS,
  mergeSorenessRatings,
} from './injury-soreness';

describe('computeInjurySorenessOverrides', () => {
  it('returns empty for no disruptions', () => {
    expect(computeInjurySorenessOverrides([])).toEqual({});
  });

  it('returns empty for non-injury disruptions', () => {
    const illness = {
      ...makeDisruption('moderate'),
      disruption_type: 'illness' as const,
    };
    expect(computeInjurySorenessOverrides([illness])).toEqual({});
  });

  it('returns empty for major injury (session skipped entirely)', () => {
    expect(computeInjurySorenessOverrides([makeDisruption('major')])).toEqual(
      {}
    );
  });

  it('injects soreness for squat muscles on minor injury', () => {
    const result = computeInjurySorenessOverrides([
      makeDisruption('minor', 'squat'),
    ]);
    expect(result['quads']).toBe(INJURY_SORENESS['minor']);
    expect(result['glutes']).toBe(INJURY_SORENESS['minor']);
  });

  it('injects soreness for deadlift muscles on moderate injury', () => {
    const result = computeInjurySorenessOverrides([
      makeDisruption('moderate', 'deadlift'),
    ]);
    expect(result['hamstrings']).toBe(INJURY_SORENESS['moderate']);
    expect(result['lower_back']).toBe(INJURY_SORENESS['moderate']);
    expect(result['upper_back']).toBe(INJURY_SORENESS['moderate']);
  });

  it('takes highest soreness when multiple injuries overlap', () => {
    const result = computeInjurySorenessOverrides([
      makeDisruption('minor', 'squat'), // glutes = 5
      makeDisruption('moderate', 'deadlift'), // glutes = 7
    ]);
    // glutes are trained by both squat and deadlift — moderate wins
    expect(result['glutes']).toBe(INJURY_SORENESS['moderate']);
  });

  it('handles null affected_lifts', () => {
    const d = { ...makeDisruption('moderate'), affected_lifts: null };
    expect(computeInjurySorenessOverrides([d])).toEqual({});
  });

  it('does not set soreness for muscles not trained by affected lift', () => {
    const result = computeInjurySorenessOverrides([
      makeDisruption('moderate', 'squat'),
    ]);
    // chest is not a squat muscle
    expect(result['chest']).toBeUndefined();
  });
});

describe('mergeSorenessRatings', () => {
  it('returns actual ratings when no overrides', () => {
    const actual: Partial<Record<MuscleGroup, SorenessLevel>> = {
      quads: 3 as SorenessLevel,
    };
    expect(mergeSorenessRatings(actual, {})).toEqual(actual);
  });

  it('injury soreness wins when higher', () => {
    const actual: Partial<Record<MuscleGroup, SorenessLevel>> = {
      quads: 3 as SorenessLevel,
    };
    const overrides: Partial<Record<MuscleGroup, SorenessLevel>> = {
      quads: 7 as SorenessLevel,
    };
    expect(mergeSorenessRatings(actual, overrides)['quads']).toBe(7);
  });

  it('actual soreness wins when higher', () => {
    const actual: Partial<Record<MuscleGroup, SorenessLevel>> = {
      quads: 9 as SorenessLevel,
    };
    const overrides: Partial<Record<MuscleGroup, SorenessLevel>> = {
      quads: 5 as SorenessLevel,
    };
    expect(mergeSorenessRatings(actual, overrides)['quads']).toBe(9);
  });

  it('adds muscles only in overrides', () => {
    const actual: Partial<Record<MuscleGroup, SorenessLevel>> = {};
    const overrides: Partial<Record<MuscleGroup, SorenessLevel>> = {
      hamstrings: 7 as SorenessLevel,
    };
    expect(mergeSorenessRatings(actual, overrides)['hamstrings']).toBe(7);
  });
});
