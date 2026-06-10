// @spec docs/features/wearable/spec-pipeline.md
import { addBreadcrumb } from '@platform/utils/captureException';

import { upsertBiometricReadings } from '../data/biometric.repository';
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
import { computeAndStoreRecoverySnapshot } from './recovery.service';

export type SyncResult =
  | { synced: true; readingsInserted: number }
  | { synced: false; reason: 'unavailable' | 'permission_denied' };

// Wrap each sync step so a failure carries the step name into the thrown
// error AND leaves a Sentry breadcrumb trail. The outer screen handler still
// captureException's the rethrown error — Sentry gets one event with the full
// step trail, and the alert message identifies the failing step.
async function runStep<T>(name: string, fn: () => Promise<T>): Promise<T> {
  addBreadcrumb('wearable.sync', `start ${name}`);
  try {
    const result = await fn();
    addBreadcrumb('wearable.sync', `done ${name}`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`wearable.sync ${name}: ${message}`, { cause: err });
  }
}

export async function syncWearableData(userId: string): Promise<SyncResult> {
  if (!(await runStep('isHealthConnectAvailable', isHealthConnectAvailable))) {
    return { synced: false, reason: 'unavailable' };
  }

  const perms = await runStep('checkPermissions', checkPermissions);
  if (!perms.granted) {
    return { synced: false, reason: 'permission_denied' };
  }

  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  const [hrv, rhr, spo2, sleeps, steps, activeMins] = await Promise.all([
    runStep('readHrv', () => readHrv(start, end)),
    runStep('readRestingHr', () => readRestingHr(start, end)),
    runStep('readSpO2', () => readSpO2(start, end)),
    runStep('readSleepSessions', () => readSleepSessions(start, end)),
    runStep('readSteps', () => readSteps(start, end)),
    runStep('readActiveMinutes', () => readActiveMinutes(start, end)),
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

  const { insertedCount } = await runStep('upsertBiometricReadings', () =>
    upsertBiometricReadings(userId, readings)
  );
  await runStep('computeAndStoreRecoverySnapshot', () =>
    computeAndStoreRecoverySnapshot(userId)
  );

  return { synced: true, readingsInserted: insertedCount };
}
