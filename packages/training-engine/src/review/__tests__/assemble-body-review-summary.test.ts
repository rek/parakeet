import { describe, expect, it } from 'vitest';

import type { RawWeeklyBodyReview } from '../assemble-cycle-report';
import { assembleBodyReviewSummary } from '../assemble-cycle-report';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReview(
  overrides: Partial<RawWeeklyBodyReview> = {}
): RawWeeklyBodyReview {
  return {
    week_number: 1,
    mismatches: [],
    felt_soreness: {},
    predicted_fatigue: {},
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('assembleBodyReviewSummary', () => {
  it('returns null for an empty array', () => {
    expect(assembleBodyReviewSummary([])).toBeNull();
  });

  it('returns reviewCount=1 with empty recurring muscles and correct delta for a single review with no mismatches', () => {
    const review = makeReview({
      week_number: 1,
      mismatches: [],
      felt_soreness: { quads: 3, hamstrings: 2 },
      predicted_fatigue: {
        quads: { predicted: 2, volumePct: 0.5 },
        hamstrings: { predicted: 1, volumePct: 0.3 },
      },
    });

    const result = assembleBodyReviewSummary([review]);

    expect(result).not.toBeNull();
    expect(result!.reviewCount).toBe(1);
    expect(result!.recurringAccumulatingMuscles).toEqual([]);
    // quads: felt 3, predicted 2 → delta +1
    expect(result!.avgFeltVsPredictedDelta['quads']).toBe(1);
    // hamstrings: felt 2, predicted 1 → delta +1
    expect(result!.avgFeltVsPredictedDelta['hamstrings']).toBe(1);
  });

  it('does not include a muscle in recurringAccumulatingMuscles when it appears in exactly one review', () => {
    const reviews = [
      makeReview({
        week_number: 1,
        mismatches: [
          { muscle: 'glutes', felt: 4, predicted: 2, direction: 'accumulating_fatigue' },
        ],
      }),
      makeReview({
        week_number: 2,
        mismatches: [],
      }),
    ];

    const result = assembleBodyReviewSummary(reviews);

    expect(result!.recurringAccumulatingMuscles).not.toContain('glutes');
  });

  it('includes a muscle in recurringAccumulatingMuscles when it appears with accumulating_fatigue in 2+ reviews', () => {
    const reviews = [
      makeReview({
        week_number: 1,
        mismatches: [
          { muscle: 'lower_back', felt: 5, predicted: 2, direction: 'accumulating_fatigue' },
        ],
      }),
      makeReview({
        week_number: 2,
        mismatches: [
          { muscle: 'lower_back', felt: 4, predicted: 2, direction: 'accumulating_fatigue' },
        ],
      }),
    ];

    const result = assembleBodyReviewSummary(reviews);

    expect(result!.recurringAccumulatingMuscles).toContain('lower_back');
  });

  it('calculates felt-vs-predicted delta correctly across multiple reviews', () => {
    // Week 1: quads felt=4, predicted=2 → delta=2
    // Week 2: quads felt=3, predicted=3 → delta=0
    // Average: (2 + 0) / 2 = 1.0
    const reviews = [
      makeReview({
        week_number: 1,
        felt_soreness: { quads: 4 },
        predicted_fatigue: { quads: { predicted: 2, volumePct: 0.6 } },
      }),
      makeReview({
        week_number: 2,
        felt_soreness: { quads: 3 },
        predicted_fatigue: { quads: { predicted: 3, volumePct: 0.5 } },
      }),
    ];

    const result = assembleBodyReviewSummary(reviews);

    expect(result!.avgFeltVsPredictedDelta['quads']).toBe(1);
  });

  it('skips muscles in felt_soreness that have no entry in predicted_fatigue', () => {
    const review = makeReview({
      felt_soreness: { traps: 3, biceps: 2 },
      predicted_fatigue: {
        // traps has no predicted entry — should be skipped
        biceps: { predicted: 1, volumePct: 0.2 },
      },
    });

    const result = assembleBodyReviewSummary([review]);

    expect(result!.avgFeltVsPredictedDelta['traps']).toBeUndefined();
    expect(result!.avgFeltVsPredictedDelta['biceps']).toBe(1);
  });

  it('does not count recovering_well mismatches toward recurringAccumulatingMuscles', () => {
    const reviews = [
      makeReview({
        week_number: 1,
        mismatches: [
          { muscle: 'chest', felt: 1, predicted: 3, direction: 'recovering_well' },
        ],
      }),
      makeReview({
        week_number: 2,
        mismatches: [
          { muscle: 'chest', felt: 1, predicted: 3, direction: 'recovering_well' },
        ],
      }),
    ];

    const result = assembleBodyReviewSummary(reviews);

    expect(result!.recurringAccumulatingMuscles).not.toContain('chest');
  });
});
