// @spec docs/features/flock/spec-publish.md
import { describe, expect, it } from 'vitest';

import { deriveHeadline, type HeadlineSignals } from '../derive-headline';

const base: HeadlineSignals = {
  earnedPRs: [],
  wilks: null,
  wilksDelta: null,
  streakWeeks: null,
};

describe('deriveHeadline', () => {
  it('renders a rep-at-weight PR with grams + reps', () => {
    const result = deriveHeadline({
      ...base,
      earnedPRs: [
        { type: 'rep_at_weight', lift: 'squat', value: 3, weightKg: 142.5 },
      ],
    });
    expect(result.headlineKind).toBe('pr');
    expect(result.headline).toBe('Squat PR — 142.5kg × 3');
    expect(result.latestPrLift).toBe('squat');
    expect(result.latestPrWeightG).toBe(142500);
    expect(result.latestPrReps).toBe(3);
  });

  it('renders an estimated-1rm PR without reps', () => {
    const result = deriveHeadline({
      ...base,
      earnedPRs: [{ type: 'estimated_1rm', lift: 'bench', value: 100.2 }],
    });
    expect(result.headlineKind).toBe('pr');
    expect(result.headline).toBe('Bench PR — e1RM 100kg');
    expect(result.latestPrWeightG).toBe(100000);
    expect(result.latestPrReps).toBeNull();
  });

  it('prefers estimated_1rm over rep_at_weight over volume', () => {
    const result = deriveHeadline({
      ...base,
      earnedPRs: [
        { type: 'volume', lift: 'deadlift', value: 5000 },
        { type: 'rep_at_weight', lift: 'deadlift', value: 5, weightKg: 100 },
        { type: 'estimated_1rm', lift: 'deadlift', value: 180 },
      ],
    });
    expect(result.headline).toBe('Deadlift PR — e1RM 180kg');
  });

  it('falls back to Wilks when a positive delta and no PR', () => {
    const result = deriveHeadline({
      ...base,
      wilks: 318,
      wilksDelta: 4,
    });
    expect(result.headlineKind).toBe('wilks');
    expect(result.headline).toBe('Wilks 318 ▲ +4');
    expect(result.latestPrLift).toBeNull();
  });

  it('does not surface a Wilks drop as the headline', () => {
    const result = deriveHeadline({
      ...base,
      wilks: 310,
      wilksDelta: -4,
      streakWeeks: 6,
    });
    expect(result.headlineKind).toBe('streak');
    expect(result.headline).toBe('6-week streak');
  });

  it('uses a sustained streak when no PR or Wilks gain', () => {
    const result = deriveHeadline({ ...base, streakWeeks: 12 });
    expect(result.headlineKind).toBe('streak');
    expect(result.headline).toBe('12-week streak');
  });

  it('ignores a 1-week streak (below milestone) and falls back to trained', () => {
    const result = deriveHeadline({ ...base, streakWeeks: 1 });
    expect(result.headlineKind).toBe('trained');
    expect(result.headline).toBe('Trained today');
  });

  it('falls back to "Trained today" when nothing is notable', () => {
    const result = deriveHeadline(base);
    expect(result.headlineKind).toBe('trained');
  });

  it('PR outranks Wilks and streak', () => {
    const result = deriveHeadline({
      earnedPRs: [{ type: 'estimated_1rm', lift: 'squat', value: 150 }],
      wilks: 320,
      wilksDelta: 10,
      streakWeeks: 20,
    });
    expect(result.headlineKind).toBe('pr');
  });
});
