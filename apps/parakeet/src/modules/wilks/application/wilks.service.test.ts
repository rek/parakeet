import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentWilksSnapshot } from './wilks.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetCurrentMaxes = vi.hoisted(() => vi.fn());
const mockGetProfileById = vi.hoisted(() => vi.fn());
const mockComputeWilks2020 = vi.hoisted(() => vi.fn());
const mockWeightGramsToKg = vi.hoisted(() => vi.fn());

vi.mock('@modules/program', () => ({
  getCurrentMaxes: mockGetCurrentMaxes,
}));

vi.mock('../data/profile.repository', () => ({
  getProfileById: mockGetProfileById,
}));

vi.mock('@parakeet/training-engine', () => ({
  computeWilks2020: mockComputeWilks2020,
}));

vi.mock('@shared/utils/weight', () => ({
  weightGramsToKg: mockWeightGramsToKg,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMaxes(
  overrides: Partial<{
    squat_1rm_grams: number;
    bench_1rm_grams: number;
    deadlift_1rm_grams: number;
    recorded_at: string;
  }> = {}
) {
  return {
    squat_1rm_grams: 200000,
    bench_1rm_grams: 140000,
    deadlift_1rm_grams: 240000,
    recorded_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function makeProfile(
  overrides: Partial<{
    bodyweight_kg: number;
    biological_sex: string;
  }> = {}
) {
  return {
    id: 'user-1',
    display_name: 'Test User',
    biological_sex: 'male',
    bodyweight_kg: 90,
    date_of_birth: '1990-01-01',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getCurrentWilksSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: weightGramsToKg divides by 1000
    mockWeightGramsToKg.mockImplementation((grams: number) => grams / 1000);
  });

  it('returns null when getCurrentMaxes returns null', async () => {
    mockGetCurrentMaxes.mockResolvedValue(null);
    mockGetProfileById.mockResolvedValue(makeProfile());

    const result = await getCurrentWilksSnapshot('user-1');

    expect(result).toBeNull();
  });

  it('returns null when profile has no bodyweight_kg', async () => {
    mockGetCurrentMaxes.mockResolvedValue(makeMaxes());
    mockGetProfileById.mockResolvedValue(makeProfile({ bodyweight_kg: 0 }));

    const result = await getCurrentWilksSnapshot('user-1');

    expect(result).toBeNull();
  });

  it('returns null when getProfileById returns null', async () => {
    mockGetCurrentMaxes.mockResolvedValue(makeMaxes());
    mockGetProfileById.mockResolvedValue(null);

    const result = await getCurrentWilksSnapshot('user-1');

    expect(result).toBeNull();
  });

  it('computes male Wilks snapshot with correct values', async () => {
    const maxes = makeMaxes({
      squat_1rm_grams: 200000,
      bench_1rm_grams: 140000,
      deadlift_1rm_grams: 240000,
      recorded_at: '2026-03-01T00:00:00Z',
    });
    mockGetCurrentMaxes.mockResolvedValue(maxes);
    mockGetProfileById.mockResolvedValue(
      makeProfile({ biological_sex: 'male', bodyweight_kg: 90 })
    );
    mockComputeWilks2020.mockReturnValue(412.75);

    const result = await getCurrentWilksSnapshot('user-1');

    expect(result).not.toBeNull();
    expect(result!.sex).toBe('male');
    expect(result!.squatKg).toBe(200);
    expect(result!.benchKg).toBe(140);
    expect(result!.deadliftKg).toBe(240);
    expect(result!.bodyweightKg).toBe(90);
    expect(result!.wilks).toBe(413); // Math.round(412.75)
    expect(result!.recordedAt).toBe('2026-03-01T00:00:00Z');
    expect(mockComputeWilks2020).toHaveBeenCalledWith(580, 90, 'male');
  });

  it('computes female Wilks snapshot with correct values', async () => {
    const maxes = makeMaxes({
      squat_1rm_grams: 120000,
      bench_1rm_grams: 80000,
      deadlift_1rm_grams: 150000,
      recorded_at: '2026-02-15T00:00:00Z',
    });
    mockGetCurrentMaxes.mockResolvedValue(maxes);
    mockGetProfileById.mockResolvedValue(
      makeProfile({ biological_sex: 'female', bodyweight_kg: 65 })
    );
    mockComputeWilks2020.mockReturnValue(389.2);

    const result = await getCurrentWilksSnapshot('user-1');

    expect(result).not.toBeNull();
    expect(result!.sex).toBe('female');
    expect(result!.squatKg).toBe(120);
    expect(result!.benchKg).toBe(80);
    expect(result!.deadliftKg).toBe(150);
    expect(result!.bodyweightKg).toBe(65);
    expect(result!.wilks).toBe(389); // Math.round(389.2)
    expect(mockComputeWilks2020).toHaveBeenCalledWith(350, 65, 'female');
  });

  it('defaults to male sex when biological_sex is not "female"', async () => {
    mockGetCurrentMaxes.mockResolvedValue(makeMaxes());
    // biological_sex missing / null-like value
    mockGetProfileById.mockResolvedValue(
      makeProfile({ biological_sex: 'other' })
    );
    mockComputeWilks2020.mockReturnValue(300);

    const result = await getCurrentWilksSnapshot('user-1');

    expect(result!.sex).toBe('male');
    expect(mockComputeWilks2020).toHaveBeenCalledWith(
      expect.any(Number),
      90,
      'male'
    );
  });

  it('rounds wilks to the nearest integer', async () => {
    mockGetCurrentMaxes.mockResolvedValue(makeMaxes());
    mockGetProfileById.mockResolvedValue(makeProfile());
    // Return a value with decimal that rounds up
    mockComputeWilks2020.mockReturnValue(399.5);

    const result = await getCurrentWilksSnapshot('user-1');

    expect(result!.wilks).toBe(400);
  });

  it('passes the sum of squat + bench + deadlift as totalKg to computeWilks2020', async () => {
    const maxes = makeMaxes({
      squat_1rm_grams: 150000,
      bench_1rm_grams: 100000,
      deadlift_1rm_grams: 200000,
    });
    mockGetCurrentMaxes.mockResolvedValue(maxes);
    mockGetProfileById.mockResolvedValue(makeProfile({ bodyweight_kg: 80 }));
    mockComputeWilks2020.mockReturnValue(350);

    await getCurrentWilksSnapshot('user-1');

    // 150 + 100 + 200 = 450
    expect(mockComputeWilks2020).toHaveBeenCalledWith(450, 80, 'male');
  });

  it('fetches maxes and profile concurrently (both called once)', async () => {
    mockGetCurrentMaxes.mockResolvedValue(makeMaxes());
    mockGetProfileById.mockResolvedValue(makeProfile());
    mockComputeWilks2020.mockReturnValue(380);

    await getCurrentWilksSnapshot('user-1');

    expect(mockGetCurrentMaxes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentMaxes).toHaveBeenCalledWith('user-1');
    expect(mockGetProfileById).toHaveBeenCalledTimes(1);
    expect(mockGetProfileById).toHaveBeenCalledWith('user-1');
  });
});
