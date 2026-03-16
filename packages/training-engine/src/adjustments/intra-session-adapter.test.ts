import { describe, expect, it } from 'vitest';

import {
  adaptRemainingPlan,
  detectSetFailure,
  roundToNearest2_5,
  type IntraSessionContext,
} from './intra-session-adapter';
import { makeSets } from '../__test-helpers__/fixtures';

const BASE_CTX: Omit<
  IntraSessionContext,
  'consecutiveFailures' | 'remainingSets'
> = {
  completedSets: [],
  primaryLift: 'squat',
  oneRmKg: 200,
};

// ---------------------------------------------------------------------------
// detectSetFailure
// ---------------------------------------------------------------------------

describe('detectSetFailure', () => {
  it('returns true when actual < planned', () => {
    expect(detectSetFailure(5, 4)).toBe(true);
    expect(detectSetFailure(5, 0)).toBe(true);
    expect(detectSetFailure(3, 2)).toBe(true);
  });

  it('returns false when actual equals planned', () => {
    expect(detectSetFailure(5, 5)).toBe(false);
  });

  it('returns false when actual exceeds planned', () => {
    expect(detectSetFailure(5, 6)).toBe(false);
    expect(detectSetFailure(3, 10)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// roundToNearest2_5
// ---------------------------------------------------------------------------

describe('roundToNearest2_5', () => {
  it('rounds 95.3 down to 95', () => {
    expect(roundToNearest2_5(95.3)).toBe(95);
  });

  it('rounds 96.3 up to 97.5', () => {
    expect(roundToNearest2_5(96.3)).toBe(97.5);
  });

  it('leaves exact multiples unchanged', () => {
    expect(roundToNearest2_5(100)).toBe(100);
    expect(roundToNearest2_5(102.5)).toBe(102.5);
  });

  it('rounds midpoint (1.25) to nearest 2.5 boundary', () => {
    // 1.25 / 2.5 = 0.5 → rounds to 0 (banker rounding edge case varies by JS)
    // Standard Math.round rounds 0.5 up → 1 × 2.5 = 2.5
    expect(roundToNearest2_5(1.25)).toBe(2.5);
  });
});

// ---------------------------------------------------------------------------
// adaptRemainingPlan — no failures
// ---------------------------------------------------------------------------

describe('adaptRemainingPlan — no failures (consecutiveFailures=0)', () => {
  it('returns sets unchanged with no rest bonus and type "none"', () => {
    const sets = makeSets(3, 100);
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      consecutiveFailures: 0,
      remainingSets: sets,
    });
    expect(result.adaptationType).toBe('none');
    expect(result.restBonusSeconds).toBe(0);
    expect(result.sets).toEqual(sets);
    expect(result.rationale).toBe('');
  });
});

// ---------------------------------------------------------------------------
// adaptRemainingPlan — empty remaining sets
// ---------------------------------------------------------------------------

describe('adaptRemainingPlan — empty remaining sets', () => {
  it('returns empty plan with type "none" regardless of failures', () => {
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      consecutiveFailures: 3,
      remainingSets: [],
    });
    expect(result.adaptationType).toBe('none');
    expect(result.restBonusSeconds).toBe(0);
    expect(result.sets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// adaptRemainingPlan — first failure (consecutiveFailures=1)
// ---------------------------------------------------------------------------

describe('adaptRemainingPlan — first failure (consecutiveFailures=1)', () => {
  it('adds 60s rest bonus and leaves sets unchanged', () => {
    const sets = makeSets(2, 140);
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      consecutiveFailures: 1,
      remainingSets: sets,
    });
    expect(result.adaptationType).toBe('extended_rest');
    expect(result.restBonusSeconds).toBe(60);
    expect(result.sets).toEqual(sets);
    expect(result.rationale).toMatch(/extra rest/i);
  });
});

// ---------------------------------------------------------------------------
// adaptRemainingPlan — second consecutive failure (consecutiveFailures=2)
// ---------------------------------------------------------------------------

describe('adaptRemainingPlan — second failure (consecutiveFailures=2)', () => {
  it('reduces weight by 5% rounded to 2.5 kg, no rest bonus', () => {
    // 100 kg × 0.95 = 95 kg → already a multiple of 2.5
    const sets = makeSets(3, 100);
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      consecutiveFailures: 2,
      remainingSets: sets,
    });
    expect(result.adaptationType).toBe('weight_reduced');
    expect(result.restBonusSeconds).toBe(0);
    expect(result.sets).toHaveLength(3);
    result.sets.forEach((s) => expect(s.weight_kg).toBe(95));
    expect(result.rationale).toMatch(/5%/i);
  });

  it('rounds reduced weight to nearest 2.5 kg', () => {
    // 103 kg × 0.95 = 97.85 → rounds to 97.5
    const sets = makeSets(1, 103);
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      consecutiveFailures: 2,
      remainingSets: sets,
    });
    expect(result.sets[0].weight_kg).toBe(97.5);
  });

  it('applies reduction to multiple sets independently', () => {
    const sets = [
      { set_number: 1, weight_kg: 100, reps: 5 },
      { set_number: 2, weight_kg: 100, reps: 3 },
      { set_number: 3, weight_kg: 100, reps: 5 },
    ];
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      consecutiveFailures: 2,
      remainingSets: sets,
    });
    expect(result.sets.every((s) => s.weight_kg === 95)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// adaptRemainingPlan — third+ failure (consecutiveFailures>=3)
// ---------------------------------------------------------------------------

describe('adaptRemainingPlan — third+ failure (consecutiveFailures>=3)', () => {
  it('reduces weight by 10% and marks sets as optional via rationale', () => {
    // 100 kg × 0.90 = 90 kg
    const sets = makeSets(3, 100);
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      consecutiveFailures: 3,
      remainingSets: sets,
    });
    expect(result.adaptationType).toBe('sets_capped');
    expect(result.restBonusSeconds).toBe(0);
    result.sets.forEach((s) => expect(s.weight_kg).toBe(90));
    expect(result.rationale).toMatch(/optional/i);
  });

  it('treats consecutiveFailures=4 identically to 3', () => {
    const sets = makeSets(1, 100);
    const result4 = adaptRemainingPlan({
      ...BASE_CTX,
      consecutiveFailures: 4,
      remainingSets: sets,
    });
    const result3 = adaptRemainingPlan({
      ...BASE_CTX,
      consecutiveFailures: 3,
      remainingSets: sets,
    });
    expect(result4.adaptationType).toBe(result3.adaptationType);
    expect(result4.sets[0].weight_kg).toBe(result3.sets[0].weight_kg);
  });
});

// ---------------------------------------------------------------------------
// Weight floor constraint
// ---------------------------------------------------------------------------

describe('weight floor — weight cannot fall below 40% of oneRmKg', () => {
  it('clamps 5% reduction when result would breach floor', () => {
    // oneRmKg=200 → floor = 40% × 200 = 80 kg
    // Set weight=82 kg × 0.95 = 77.9 → rounds to 77.5, below floor → clamped to 80
    const sets = makeSets(1, 82);
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      oneRmKg: 200,
      consecutiveFailures: 2,
      remainingSets: sets,
    });
    expect(result.sets[0].weight_kg).toBe(80);
  });

  it('clamps 10% reduction when result would breach floor', () => {
    // oneRmKg=200 → floor = 80 kg
    // Set weight=85 kg × 0.90 = 76.5 → rounds to 77.5, below floor → clamped to 80
    const sets = makeSets(1, 85);
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      oneRmKg: 200,
      consecutiveFailures: 3,
      remainingSets: sets,
    });
    expect(result.sets[0].weight_kg).toBe(80);
  });

  it('does not clamp when reduction stays above floor', () => {
    // oneRmKg=200 → floor = 80 kg; 100 × 0.90 = 90 > 80 → no clamp
    const sets = makeSets(1, 100);
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      oneRmKg: 200,
      consecutiveFailures: 3,
      remainingSets: sets,
    });
    expect(result.sets[0].weight_kg).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Reset scenario
// ---------------------------------------------------------------------------

describe('adaptRemainingPlan — reset scenario', () => {
  it('consecutiveFailures=0 after a success returns type "none" with no changes', () => {
    const sets = makeSets(2, 120);
    const result = adaptRemainingPlan({
      ...BASE_CTX,
      consecutiveFailures: 0,
      remainingSets: sets,
    });
    expect(result.adaptationType).toBe('none');
    expect(result.sets).toEqual(sets);
    expect(result.restBonusSeconds).toBe(0);
  });
});
