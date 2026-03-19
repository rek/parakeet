import { getCurrentMaxes } from '@modules/program/lib/lifter-maxes';
import { computeWilks2020 } from '@parakeet/training-engine';
import { weightGramsToKg } from '@shared/utils/weight';

import { getProfileById } from '../data/profile.repository';

export interface CurrentWilksSnapshot {
  wilks: number;
  squatKg: number;
  benchKg: number;
  deadliftKg: number;
  bodyweightKg: number;
  sex: 'male' | 'female';
  recordedAt: string;
}

export async function getCurrentWilksSnapshot(
  userId: string
): Promise<CurrentWilksSnapshot | null> {
  const [maxes, profile] = await Promise.all([
    getCurrentMaxes(userId),
    getProfileById(userId),
  ]);
  if (!maxes || !profile?.bodyweight_kg) return null;

  const sex: 'male' | 'female' =
    profile.biological_sex === 'female' ? 'female' : 'male';
  const bodyweightKg = profile.bodyweight_kg;

  const squatKg = weightGramsToKg(maxes.squat_1rm_grams);
  const benchKg = weightGramsToKg(maxes.bench_1rm_grams);
  const deadliftKg = weightGramsToKg(maxes.deadlift_1rm_grams);
  const totalKg = squatKg + benchKg + deadliftKg;
  const wilks = computeWilks2020(totalKg, bodyweightKg, sex);

  return {
    wilks: Math.round(wilks),
    squatKg,
    benchKg,
    deadliftKg,
    bodyweightKg,
    sex,
    recordedAt: maxes.recorded_at,
  };
}
