import {
  computePredictedFatigue,
  detectMismatches,
} from '@parakeet/training-engine';
import type {
  FatigueLevel,
  MrvMevConfig,
  MuscleGroup,
} from '@parakeet/training-engine';

import {
  fetchLatestWeeklyReview,
  fetchWeeklyBodyReviews,
  fetchWeeklyVolumeForReview,
  insertWeeklyBodyReview,
} from '../data/body-review.repository';
import type { WeeklyBodyReview } from '../data/body-review.repository';

export type { WeeklyBodyReview };

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

export async function getLatestWeeklyReview(
  userId: string,
  programId: string,
  weekNumber: number
): Promise<WeeklyBodyReview | null> {
  return fetchLatestWeeklyReview(userId, programId, weekNumber);
}
