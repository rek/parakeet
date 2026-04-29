// @spec docs/features/wearable/spec-pipeline.md
import {
  checkPermissions,
  isHealthConnectAvailable,
  readActiveMinutes,
  readHrv,
  readRestingHr,
  readSleepSessions,
  readSpO2,
  readSteps,
} from '../lib/health-connect';
import { upsertBiometricReadings } from '../data/biometric.repository';
import { computeAndStoreRecoverySnapshot } from './recovery.service';

export type SyncResult =
  | { synced: true; readingsInserted: number }
  | { synced: false; reason: 'unavailable' | 'permission_denied' };

export async function syncWearableData(userId: string): Promise<SyncResult> {
  if (!(await isHealthConnectAvailable())) {
    return { synced: false, reason: 'unavailable' };
  }

  const perms = await checkPermissions();
  if (!perms.granted) {
    return { synced: false, reason: 'permission_denied' };
  }

  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  const [hrv, rhr, spo2, sleeps, steps, activeMins] = await Promise.all([
    readHrv(start, end),
    readRestingHr(start, end),
    readSpO2(start, end),
    readSleepSessions(start, end),
    readSteps(start, end),
    readActiveMinutes(start, end),
  ]);

  const readings = [
    ...hrv.map((r) => ({
      type: 'hrv_rmssd' as const,
      value: r.value,
      recorded_at: r.recorded_at,
      source: 'health_connect',
    })),
    ...rhr.map((r) => ({
      type: 'resting_hr' as const,
      value: r.value,
      recorded_at: r.recorded_at,
      source: 'health_connect',
    })),
    ...spo2.map((r) => ({
      type: 'spo2' as const,
      value: r.value,
      recorded_at: r.recorded_at,
      source: 'health_connect',
    })),
    ...sleeps.flatMap((s) => [
      {
        type: 'sleep_duration' as const,
        value: s.durationMin,
        recorded_at: s.end,
        source: 'health_connect',
      },
      {
        type: 'deep_sleep_pct' as const,
        value: s.deepSleepPct,
        recorded_at: s.end,
        source: 'health_connect',
      },
      {
        type: 'rem_sleep_pct' as const,
        value: s.remSleepPct,
        recorded_at: s.end,
        source: 'health_connect',
      },
    ]),
    {
      type: 'steps' as const,
      value: steps,
      recorded_at: end.toISOString(),
      source: 'health_connect',
    },
    {
      type: 'active_minutes' as const,
      value: activeMins,
      recorded_at: end.toISOString(),
      source: 'health_connect',
    },
  ];

  const { insertedCount } = await upsertBiometricReadings(userId, readings);
  await computeAndStoreRecoverySnapshot(userId);

  return { synced: true, readingsInserted: insertedCount };
}
