import { describe, expect, it } from 'vitest';
import { describeAction, groupSuggestions } from './adjustment-helpers';

// Minimal shape matching AdjustmentSuggestion fields used by these functions
const make = (fields: {
  action: string;
  reduction_pct?: number | null;
  reps_reduction?: number | null;
  substitution_note?: string | null;
}) => fields as any;

describe('describeAction', () => {
  it('returns "Session skipped" for session_skipped', () => {
    expect(describeAction(make({ action: 'session_skipped' }))).toBe('Session skipped');
  });

  it('includes percentage when reduction_pct is present', () => {
    expect(describeAction(make({ action: 'weight_reduced', reduction_pct: 10 }))).toBe(
      'Weight reduced by 10%',
    );
  });

  it('returns "Weight reduced" when reduction_pct is null', () => {
    expect(describeAction(make({ action: 'weight_reduced', reduction_pct: null }))).toBe(
      'Weight reduced',
    );
  });

  it('returns "Weight reduced" when reduction_pct is absent', () => {
    expect(describeAction(make({ action: 'weight_reduced' }))).toBe('Weight reduced');
  });

  it('includes count when reps_reduction is present', () => {
    expect(describeAction(make({ action: 'reps_reduced', reps_reduction: 2 }))).toBe(
      'Reps reduced by 2',
    );
  });

  it('returns "Reps reduced" when reps_reduction is null', () => {
    expect(describeAction(make({ action: 'reps_reduced', reps_reduction: null }))).toBe(
      'Reps reduced',
    );
  });

  it('returns "Reps reduced" when reps_reduction is absent', () => {
    expect(describeAction(make({ action: 'reps_reduced' }))).toBe('Reps reduced');
  });

  it('uses substitution_note when present', () => {
    expect(
      describeAction(make({ action: 'exercise_substituted', substitution_note: 'Swapped to DB press' })),
    ).toBe('Swapped to DB press');
  });

  it('returns "Exercise substituted" when substitution_note is null', () => {
    expect(describeAction(make({ action: 'exercise_substituted', substitution_note: null }))).toBe(
      'Exercise substituted',
    );
  });

  it('returns "Exercise substituted" when substitution_note is absent', () => {
    expect(describeAction(make({ action: 'exercise_substituted' }))).toBe('Exercise substituted');
  });
});

describe('groupSuggestions', () => {
  it('returns empty Map for empty array', () => {
    const result = groupSuggestions([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('returns Map with count 1 for a single suggestion', () => {
    const s = make({ action: 'session_skipped' });
    const result = groupSuggestions([s]);
    expect(result.size).toBe(1);
    const entry = result.get('Session skipped');
    expect(entry).toBeDefined();
    expect(entry!.count).toBe(1);
    expect(entry!.s).toBe(s);
  });

  it('groups duplicate actions and increments count', () => {
    const a = make({ action: 'weight_reduced', reduction_pct: 10 });
    const b = make({ action: 'weight_reduced', reduction_pct: 10 });
    const result = groupSuggestions([a, b]);
    expect(result.size).toBe(1);
    expect(result.get('Weight reduced by 10%')!.count).toBe(2);
  });

  it('keeps distinct actions as separate entries', () => {
    const a = make({ action: 'session_skipped' });
    const b = make({ action: 'reps_reduced', reps_reduction: 1 });
    const result = groupSuggestions([a, b]);
    expect(result.size).toBe(2);
    expect(result.get('Session skipped')!.count).toBe(1);
    expect(result.get('Reps reduced by 1')!.count).toBe(1);
  });

  it('preserves the first suggestion object as the representative', () => {
    const first = make({ action: 'weight_reduced', reduction_pct: 5 });
    const second = make({ action: 'weight_reduced', reduction_pct: 5 });
    const result = groupSuggestions([first, second]);
    expect(result.get('Weight reduced by 5%')!.s).toBe(first);
  });
});
