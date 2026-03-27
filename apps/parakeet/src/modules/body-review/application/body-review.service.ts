import {
  computePredictedFatigue,
  detectMismatches,
} from '@parakeet/training-engine';
import type {
  FatigueLevel,
  FatigueMismatch,
  MrvMevConfig,
  MuscleGroup,
  PredictedFatigue,
} from '@parakeet/training-engine';

import {
  fetchLatestWeeklyReview,
  fetchWeeklyBodyReviews,
  fetchWeeklyVolumeForReview,
  insertWeeklyBodyReview,
} from '../data/body-review.repository';
import type { WeeklyBodyReview } from '../data/body-review.repository';

export { computePredictedFatigue, detectMismatches };
export type {
  FatigueLevel,
  FatigueMismatch,
  MrvMevConfig,
  PredictedFatigue,
  WeeklyBodyReview,
};

export interface SaveReviewInput {
  userId: string;
  programId?: string | null;
  weekNumber: number;
  feltSoreness: Partial<Record<MuscleGroup, FatigueLevel>>;
  weeklyVolume: Partial<Record<MuscleGroup, number>>;
  mrvMevConfig: MrvMevConfig;
  notes?: string | null;
}

export async function saveWeeklyBodyReview(
  input: SaveReviewInput
): Promise<WeeklyBodyReview> {
  const predictedFatigue = computePredictedFatigue(
    input.weeklyVolume,
    input.mrvMevConfig
  );
  const mismatches = detectMismatches(input.feltSoreness, predictedFatigue);

  return insertWeeklyBodyReview({
    userId: input.userId,
    programId: input.programId,
    weekNumber: input.weekNumber,
    feltSoreness: input.feltSoreness,
    predictedFatigue,
    mismatches,
    notes: input.notes,
  });
}

export async function getWeeklyBodyReviews(
  userId: string,
  programId?: string
): Promise<WeeklyBodyReview[]> {
  return fetchWeeklyBodyReviews(userId, programId);
}

export async function getWeeklyVolumeForReview(
  userId: string,
  programId: string,
  weekNumber: number
): Promise<Record<MuscleGroup, number>> {
  return fetchWeeklyVolumeForReview(userId, programId, weekNumber);
}

/**
 * Returns the dominant mismatch direction from the most recent weekly body review.
 * Looks at mismatches for the given primary muscles. If more muscles are
 * "recovering well" than "accumulating fatigue", returns 'recovering_well'.
 * Returns null if no review exists or no mismatches for primary muscles.
 */
export async function getLatestMismatchDirection(
  userId: string,
  programId: string | null,
  weekNumber: number,
  primaryMuscles: MuscleGroup[]
): Promise<'recovering_well' | 'accumulating_fatigue' | null> {
  if (!programId) return null;
  const review = await fetchLatestWeeklyReview(userId, programId, weekNumber);
  if (!review || review.mismatches.length === 0) return null;

  const primaryMismatch = review.mismatches.filter((m) =>
    primaryMuscles.includes(m.muscle)
  );
  if (primaryMismatch.length === 0) return null;

  const recovering = primaryMismatch.filter(
    (m) => m.direction === 'recovering_well'
  ).length;
  const accumulating = primaryMismatch.filter(
    (m) => m.direction === 'accumulating_fatigue'
  ).length;
  if (recovering > accumulating) return 'recovering_well';
  if (accumulating > recovering) return 'accumulating_fatigue';
  return null;
}

export async function getLatestWeeklyReview(
  userId: string,
  programId: string,
  weekNumber: number
): Promise<WeeklyBodyReview | null> {
  return fetchLatestWeeklyReview(userId, programId, weekNumber);
}
