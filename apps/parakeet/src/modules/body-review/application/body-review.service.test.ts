import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getLatestMismatchDirection,
  getLatestWeeklyReview,
  getWeeklyBodyReviews,
  saveWeeklyBodyReview,
} from './body-review.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockComputePredictedFatigue = vi.hoisted(() => vi.fn());
const mockDetectMismatches = vi.hoisted(() => vi.fn());
const mockInsertWeeklyBodyReview = vi.hoisted(() => vi.fn());
const mockFetchWeeklyBodyReviews = vi.hoisted(() => vi.fn());
const mockFetchWeeklyVolumeForReview = vi.hoisted(() => vi.fn());
const mockFetchLatestWeeklyReview = vi.hoisted(() => vi.fn());

vi.mock('@parakeet/training-engine', () => ({
  computePredictedFatigue: mockComputePredictedFatigue,
  detectMismatches: mockDetectMismatches,
}));

vi.mock('../data/body-review.repository', () => ({
  insertWeeklyBodyReview: mockInsertWeeklyBodyReview,
  fetchWeeklyBodyReviews: mockFetchWeeklyBodyReviews,
  fetchWeeklyVolumeForReview: mockFetchWeeklyVolumeForReview,
  fetchLatestWeeklyReview: mockFetchLatestWeeklyReview,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const PROGRAM_ID = 'program-1';
const WEEK_NUMBER = 3;

const PREDICTED_FATIGUE = {
  quads: { level: 'moderate' as const, sets: 8 },
  hamstrings: { level: 'low' as const, sets: 3 },
};

const STORED_REVIEW = {
  id: 'review-1',
  userId: USER_ID,
  programId: PROGRAM_ID,
  weekNumber: WEEK_NUMBER,
  feltSoreness: { quads: 'high' as const },
  predictedFatigue: PREDICTED_FATIGUE,
  mismatches: [
    {
      muscle: 'quads' as const,
      direction: 'accumulating_fatigue' as const,
      felt: 'high' as const,
      predicted: 'moderate' as const,
    },
  ],
  notes: null,
  createdAt: '2026-03-01T00:00:00Z',
};

const BASE_SAVE_INPUT = {
  userId: USER_ID,
  programId: PROGRAM_ID,
  weekNumber: WEEK_NUMBER,
  feltSoreness: { quads: 'high' as const },
  weeklyVolume: { quads: 10 } as Record<string, number>,
  mrvMevConfig: {
    quads: { mrv: 20, mev: 6, mav: 14 },
  } as Record<string, { mrv: number; mev: number; mav: number }>,
  notes: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('saveWeeklyBodyReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputePredictedFatigue.mockReturnValue(PREDICTED_FATIGUE);
    mockDetectMismatches.mockReturnValue(STORED_REVIEW.mismatches);
    mockInsertWeeklyBodyReview.mockResolvedValue(STORED_REVIEW);
  });

  it('returns the persisted review', async () => {
    const result = await saveWeeklyBodyReview(BASE_SAVE_INPUT);

    expect(result).toEqual(STORED_REVIEW);
  });

  it('calls computePredictedFatigue with weeklyVolume and mrvMevConfig', async () => {
    await saveWeeklyBodyReview(BASE_SAVE_INPUT);

    expect(mockComputePredictedFatigue).toHaveBeenCalledWith(
      BASE_SAVE_INPUT.weeklyVolume,
      BASE_SAVE_INPUT.mrvMevConfig
    );
  });

  it('calls detectMismatches with feltSoreness and computed predictedFatigue', async () => {
    await saveWeeklyBodyReview(BASE_SAVE_INPUT);

    expect(mockDetectMismatches).toHaveBeenCalledWith(
      BASE_SAVE_INPUT.feltSoreness,
      PREDICTED_FATIGUE
    );
  });

  it('passes computed fatigue and mismatches to insertWeeklyBodyReview', async () => {
    const mismatches = [
      {
        muscle: 'quads' as const,
        direction: 'recovering_well' as const,
        felt: 'low' as const,
        predicted: 'high' as const,
      },
    ];
    mockDetectMismatches.mockReturnValue(mismatches);

    await saveWeeklyBodyReview(BASE_SAVE_INPUT);

    expect(mockInsertWeeklyBodyReview).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        programId: PROGRAM_ID,
        weekNumber: WEEK_NUMBER,
        feltSoreness: BASE_SAVE_INPUT.feltSoreness,
        predictedFatigue: PREDICTED_FATIGUE,
        mismatches,
        notes: null,
      })
    );
  });

  it('passes notes through to the repository', async () => {
    const inputWithNotes = { ...BASE_SAVE_INPUT, notes: 'Felt great this week' };

    await saveWeeklyBodyReview(inputWithNotes);

    expect(mockInsertWeeklyBodyReview).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Felt great this week' })
    );
  });

  it('handles null programId', async () => {
    const input = { ...BASE_SAVE_INPUT, programId: null };

    await saveWeeklyBodyReview(input);

    expect(mockInsertWeeklyBodyReview).toHaveBeenCalledWith(
      expect.objectContaining({ programId: null })
    );
  });

  it('propagates errors from insertWeeklyBodyReview', async () => {
    mockInsertWeeklyBodyReview.mockRejectedValue(new Error('DB insert failed'));

    await expect(saveWeeklyBodyReview(BASE_SAVE_INPUT)).rejects.toThrow(
      'DB insert failed'
    );
  });
});

describe('getWeeklyBodyReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns reviews for a user', async () => {
    mockFetchWeeklyBodyReviews.mockResolvedValue([STORED_REVIEW]);

    const result = await getWeeklyBodyReviews(USER_ID);

    expect(result).toEqual([STORED_REVIEW]);
  });

  it('returns reviews filtered by programId when provided', async () => {
    mockFetchWeeklyBodyReviews.mockResolvedValue([STORED_REVIEW]);

    const result = await getWeeklyBodyReviews(USER_ID, PROGRAM_ID);

    expect(mockFetchWeeklyBodyReviews).toHaveBeenCalledWith(USER_ID, PROGRAM_ID);
    expect(result).toEqual([STORED_REVIEW]);
  });

  it('returns empty array when no reviews exist', async () => {
    mockFetchWeeklyBodyReviews.mockResolvedValue([]);

    const result = await getWeeklyBodyReviews(USER_ID);

    expect(result).toEqual([]);
  });

  it('propagates errors from fetchWeeklyBodyReviews', async () => {
    mockFetchWeeklyBodyReviews.mockRejectedValue(new Error('fetch failed'));

    await expect(getWeeklyBodyReviews(USER_ID)).rejects.toThrow('fetch failed');
  });
});

describe('getLatestWeeklyReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the latest review', async () => {
    mockFetchLatestWeeklyReview.mockResolvedValue(STORED_REVIEW);

    const result = await getLatestWeeklyReview(USER_ID, PROGRAM_ID, WEEK_NUMBER);

    expect(result).toEqual(STORED_REVIEW);
    expect(mockFetchLatestWeeklyReview).toHaveBeenCalledWith(
      USER_ID,
      PROGRAM_ID,
      WEEK_NUMBER
    );
  });

  it('returns null when no review exists', async () => {
    mockFetchLatestWeeklyReview.mockResolvedValue(null);

    const result = await getLatestWeeklyReview(USER_ID, PROGRAM_ID, WEEK_NUMBER);

    expect(result).toBeNull();
  });
});

describe('getLatestMismatchDirection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when programId is null', async () => {
    const result = await getLatestMismatchDirection(
      USER_ID,
      null,
      WEEK_NUMBER,
      ['quads']
    );

    expect(result).toBeNull();
    expect(mockFetchLatestWeeklyReview).not.toHaveBeenCalled();
  });

  it('returns null when no review exists', async () => {
    mockFetchLatestWeeklyReview.mockResolvedValue(null);

    const result = await getLatestMismatchDirection(
      USER_ID,
      PROGRAM_ID,
      WEEK_NUMBER,
      ['quads']
    );

    expect(result).toBeNull();
  });

  it('returns null when review has no mismatches', async () => {
    mockFetchLatestWeeklyReview.mockResolvedValue({
      ...STORED_REVIEW,
      mismatches: [],
    });

    const result = await getLatestMismatchDirection(
      USER_ID,
      PROGRAM_ID,
      WEEK_NUMBER,
      ['quads']
    );

    expect(result).toBeNull();
  });

  it('returns null when none of primaryMuscles appear in mismatches', async () => {
    mockFetchLatestWeeklyReview.mockResolvedValue({
      ...STORED_REVIEW,
      mismatches: [
        {
          muscle: 'hamstrings',
          direction: 'accumulating_fatigue',
          felt: 'high',
          predicted: 'low',
        },
      ],
    });

    const result = await getLatestMismatchDirection(
      USER_ID,
      PROGRAM_ID,
      WEEK_NUMBER,
      ['quads'] // quads not in mismatches
    );

    expect(result).toBeNull();
  });

  it('returns accumulating_fatigue when more muscles are accumulating', async () => {
    mockFetchLatestWeeklyReview.mockResolvedValue({
      ...STORED_REVIEW,
      mismatches: [
        { muscle: 'quads', direction: 'accumulating_fatigue', felt: 'high', predicted: 'moderate' },
        { muscle: 'hamstrings', direction: 'accumulating_fatigue', felt: 'high', predicted: 'low' },
        { muscle: 'glutes', direction: 'recovering_well', felt: 'low', predicted: 'high' },
      ],
    });

    const result = await getLatestMismatchDirection(
      USER_ID,
      PROGRAM_ID,
      WEEK_NUMBER,
      ['quads', 'hamstrings', 'glutes']
    );

    expect(result).toBe('accumulating_fatigue');
  });

  it('returns recovering_well when more muscles are recovering', async () => {
    mockFetchLatestWeeklyReview.mockResolvedValue({
      ...STORED_REVIEW,
      mismatches: [
        { muscle: 'quads', direction: 'recovering_well', felt: 'low', predicted: 'moderate' },
        { muscle: 'hamstrings', direction: 'recovering_well', felt: 'low', predicted: 'moderate' },
        { muscle: 'glutes', direction: 'accumulating_fatigue', felt: 'high', predicted: 'low' },
      ],
    });

    const result = await getLatestMismatchDirection(
      USER_ID,
      PROGRAM_ID,
      WEEK_NUMBER,
      ['quads', 'hamstrings', 'glutes']
    );

    expect(result).toBe('recovering_well');
  });

  it('returns null when recovering and accumulating are equal (tie)', async () => {
    mockFetchLatestWeeklyReview.mockResolvedValue({
      ...STORED_REVIEW,
      mismatches: [
        { muscle: 'quads', direction: 'recovering_well', felt: 'low', predicted: 'high' },
        { muscle: 'hamstrings', direction: 'accumulating_fatigue', felt: 'high', predicted: 'low' },
      ],
    });

    const result = await getLatestMismatchDirection(
      USER_ID,
      PROGRAM_ID,
      WEEK_NUMBER,
      ['quads', 'hamstrings']
    );

    expect(result).toBeNull();
  });

  it('only considers primaryMuscles when computing direction', async () => {
    // hamstrings (not primary) should be ignored even though it is accumulating
    mockFetchLatestWeeklyReview.mockResolvedValue({
      ...STORED_REVIEW,
      mismatches: [
        { muscle: 'quads', direction: 'recovering_well', felt: 'low', predicted: 'high' },
        { muscle: 'hamstrings', direction: 'accumulating_fatigue', felt: 'high', predicted: 'low' },
        { muscle: 'hamstrings', direction: 'accumulating_fatigue', felt: 'high', predicted: 'low' },
      ],
    });

    const result = await getLatestMismatchDirection(
      USER_ID,
      PROGRAM_ID,
      WEEK_NUMBER,
      ['quads'] // only quads is primary
    );

    expect(result).toBe('recovering_well');
  });

  it('passes correct arguments to fetchLatestWeeklyReview', async () => {
    mockFetchLatestWeeklyReview.mockResolvedValue(null);

    await getLatestMismatchDirection(USER_ID, PROGRAM_ID, 5, ['quads']);

    expect(mockFetchLatestWeeklyReview).toHaveBeenCalledWith(USER_ID, PROGRAM_ID, 5);
  });
});
