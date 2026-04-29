// @spec docs/features/wearable/spec-pipeline.md
import { computeReadinessScore } from '@parakeet/training-engine';
import type { RecoverySnapshotInsert } from '@parakeet/shared-types';

import { fetchLatestReading } from '../data/biometric.repository';
import { upsertRecoverySnapshot } from '../data/recovery.repository';
import { computeBaseline, computePctChange } from './baseline.service';

const BASELINE_DAYS = 7;

export type NonTrainingLoad = 0 | 1 | 2 | 3;

export function deriveNonTrainingLoad(
  steps: number | null,
  activeMinutes: number | null
): NonTrainingLoad {
  const stepsLevel: NonTrainingLoad =
    steps === null ? 0
    : steps > 15000 ? 3
    : steps >= 7000 ? 2
    : steps >= 3000 ? 1
    : 0;
  const activeLevel: NonTrainingLoad =
    activeMinutes === null ? 0
    : activeMinutes > 60 ? 3
    : activeMinutes >= 30 ? 2
    : activeMinutes >= 15 ? 1
    : 0;
  return Math.max(stepsLevel, activeLevel) as NonTrainingLoad;
}

export async function computeAndStoreRecoverySnapshot(
  userId: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const [
    latestHrv,
    latestRhr,
    latestSpo2,
    hrvBaseline,
    rhrBaseline,
    sleepReading,
    stepsToday,
    activeMinsToday,
  ] = await Promise.all([
    fetchLatestReading(userId, 'hrv_rmssd'),
    fetchLatestReading(userId, 'resting_hr'),
    fetchLatestReading(userId, 'spo2'),
    computeBaseline(userId, 'hrv_rmssd', BASELINE_DAYS),
    computeBaseline(userId, 'resting_hr', BASELINE_DAYS),
    fetchLatestReading(userId, 'sleep_duration'),
    fetchLatestReading(userId, 'steps'),
    fetchLatestReading(userId, 'active_minutes'),
  ]);

  const [deepReading, remReading] = await Promise.all([
    fetchLatestReading(userId, 'deep_sleep_pct'),
    fetchLatestReading(userId, 'rem_sleep_pct'),
  ]);

  const hrvPctChange = latestHrv ? computePctChange(latestHrv.value, hrvBaseline) : null;
  const rhrPctChange = latestRhr ? computePctChange(latestRhr.value, rhrBaseline) : null;

  const nonTrainingLoad = deriveNonTrainingLoad(
    stepsToday?.value ?? null,
    activeMinsToday?.value ?? null
  );

  const readinessScore = computeReadinessScore({
    hrvPctChange: hrvPctChange ?? undefined,
    restingHrPctChange: rhrPctChange ?? undefined,
    sleepDurationMin: sleepReading?.value,
    deepSleepPct: deepReading?.value,
    nonTrainingLoad,
  });

  const snapshot: Omit<RecoverySnapshotInsert, 'user_id'> = {
    date: today,
    hrv_rmssd: latestHrv?.value ?? null,
    hrv_baseline_7d: hrvBaseline,
    hrv_pct_change: hrvPctChange,
    resting_hr: latestRhr?.value ?? null,
    resting_hr_baseline_7d: rhrBaseline,
    rhr_pct_change: rhrPctChange,
    sleep_duration_min: sleepReading?.value ?? null,
    deep_sleep_pct: deepReading?.value ?? null,
    rem_sleep_pct: remReading?.value ?? null,
    spo2_avg: latestSpo2?.value ?? null,
    steps_24h: stepsToday?.value ?? null,
    active_minutes_24h: activeMinsToday?.value ?? null,
    readiness_score: readinessScore,
  };

  await upsertRecoverySnapshot(userId, snapshot);
}
