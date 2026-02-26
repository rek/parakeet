import { computeWilks2020 } from '@parakeet/training-engine';

import { getProfileById } from '../data/profile.repository';
import { getCurrentMaxes } from '../lib/lifter-maxes';

export interface CurrentWilksSnapshot {
  wilks: number;
  squatKg: number;
  benchKg: number;
  deadliftKg: number;
  bodyweightKg: number;
  sex: 'male' | 'female';
  recordedAt: string;
}

export async function getCurrentWilksSnapshot(userId: string): Promise<CurrentWilksSnapshot | null> {
  const [maxes, profile] = await Promise.all([
    getCurrentMaxes(userId),
    getProfileById(userId),
  ]);
  if (!maxes) return null;

  const sex: 'male' | 'female' =
    profile?.biological_sex === 'female' ? 'female' : 'male';
  const bodyweightKg = 85;

  const squatKg = maxes.squat_1rm_grams / 1000;
  const benchKg = maxes.bench_1rm_grams / 1000;
  const deadliftKg = maxes.deadlift_1rm_grams / 1000;
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
