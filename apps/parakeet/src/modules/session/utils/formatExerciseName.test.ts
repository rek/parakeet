import { describe, expect, it } from 'vitest';
import { formatExerciseName } from './formatExerciseName';

describe('formatExerciseName', () => {
  it('capitalizes a single word', () => {
    expect(formatExerciseName('squat')).toBe('Squat');
  });

  it('splits on underscores and capitalizes each word', () => {
    expect(formatExerciseName('bench_press')).toBe('Bench Press');
  });

  it('preserves already-capitalized segments', () => {
    expect(formatExerciseName('RDL')).toBe('RDL');
  });

  it('returns an empty string for an empty input', () => {
    expect(formatExerciseName('')).toBe('');
  });
});
