import { estimateOneRepMax_Epley } from '@parakeet/training-engine';
import { describe, expect, it, vi } from 'vitest';
import { inferSource, resolve1Rm } from './lifter-maxes';

// Mock the data repository to prevent pulling in the Supabase/react-native chain.
// Vitest hoists vi.mock calls above imports automatically.
vi.mock('../data/lifter-maxes.repository', () => ({
  getCurrentAuthUser: vi.fn(),
  insertLifterMaxes: vi.fn(),
  fetchLatestLifterMaxes: vi.fn(),
}));

// ── resolve1Rm ─────────────────────────────────────────────────────────────────

describe('resolve1Rm', () => {
  it('returns weight unchanged for a 1RM input', () => {
    expect(resolve1Rm({ type: '1rm', weightKg: 200 })).toBe(200);
  });

  it('applies Epley formula for a 3RM input with reps', () => {
    const weightKg = 180;
    const reps = 3;
    const expected = estimateOneRepMax_Epley(weightKg, reps);
    expect(resolve1Rm({ type: '3rm', weightKg, reps })).toBe(expected);
  });

  it('returns raw weight for a 3RM input with reps = undefined (edge case)', () => {
    // The `&& input.reps` guard short-circuits when reps is undefined.
    expect(resolve1Rm({ type: '3rm', weightKg: 150 })).toBe(150);
  });

  it('matches Epley formula numerically: weight × (1 + reps/30)', () => {
    const weightKg = 100;
    const reps = 3;
    // Epley: 100 × (1 + 3/30) = 100 × 1.1 = 110
    expect(resolve1Rm({ type: '3rm', weightKg, reps })).toBeCloseTo(110, 5);
  });
});

// ── inferSource ────────────────────────────────────────────────────────────────

describe('inferSource', () => {
  const lift1rm = (weightKg = 100) => ({ type: '1rm' as const, weightKg });
  const lift3rm = (weightKg = 100, reps = 3) => ({
    type: '3rm' as const,
    weightKg,
    reps,
  });

  it('returns "input_1rm" when all three lifts are 1RM', () => {
    expect(
      inferSource({ squat: lift1rm(), bench: lift1rm(), deadlift: lift1rm() })
    ).toBe('input_1rm');
  });

  it('returns "input_3rm" when all three lifts are 3RM', () => {
    expect(
      inferSource({ squat: lift3rm(), bench: lift3rm(), deadlift: lift3rm() })
    ).toBe('input_3rm');
  });

  it('returns "mixed" when squat is 3RM and bench/deadlift are 1RM', () => {
    expect(
      inferSource({ squat: lift3rm(), bench: lift1rm(), deadlift: lift1rm() })
    ).toBe('mixed');
  });

  it('returns "mixed" when two lifts are 1RM and one is 3RM', () => {
    expect(
      inferSource({ squat: lift1rm(), bench: lift1rm(), deadlift: lift3rm() })
    ).toBe('mixed');
  });

  it('returns "mixed" when two lifts are 3RM and one is 1RM', () => {
    expect(
      inferSource({ squat: lift3rm(), bench: lift3rm(), deadlift: lift1rm() })
    ).toBe('mixed');
  });
});
