import { capitalize, sessionLabel } from './string';

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('squat')).toBe('Squat');
  });

  it('handles single character', () => {
    expect(capitalize('a')).toBe('A');
  });

  it('leaves already-capitalized string unchanged', () => {
    expect(capitalize('Heavy')).toBe('Heavy');
  });

  it('handles empty string without crashing', () => {
    expect(capitalize('')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(capitalize(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(capitalize(undefined)).toBe('');
  });
});

describe('sessionLabel', () => {
  it('returns "Lift — Intensity" when both are present', () => {
    expect(
      sessionLabel({ primary_lift: 'squat', intensity_type: 'heavy' })
    ).toBe('Squat — Heavy');
  });

  it('returns just the lift when intensity_type is null', () => {
    expect(sessionLabel({ primary_lift: 'bench', intensity_type: null })).toBe(
      'Bench'
    );
  });

  it('returns activity_name when primary_lift is null', () => {
    expect(
      sessionLabel({ primary_lift: null, activity_name: 'Morning Mobility' })
    ).toBe('Morning Mobility');
  });

  it('returns "Ad-Hoc Workout" when both primary_lift and activity_name are null', () => {
    expect(sessionLabel({ primary_lift: null, activity_name: null })).toBe(
      'Ad-Hoc Workout'
    );
  });

  it('returns "Ad-Hoc Workout" when primary_lift is missing and no activity_name', () => {
    expect(sessionLabel({})).toBe('Ad-Hoc Workout');
  });
});
