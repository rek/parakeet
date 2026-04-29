// @spec docs/features/wearable/spec-expo-plugin.md
// @spec docs/features/wearable/spec-pipeline.md
import {
  getSdkStatus,
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  SdkAvailabilityStatus,
  SleepStageType,
} from 'react-native-health-connect';
import type { Permission } from 'react-native-health-connect';

const READ_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'OxygenSaturation' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
];

export type PermissionStatus = {
  granted: boolean;
  permissions: Record<string, boolean>;
};

export async function isHealthConnectAvailable(): Promise<boolean> {
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function initHealthConnect(): Promise<boolean> {
  try {
    return await initialize();
  } catch {
    return false;
  }
}

export async function requestPermissions(): Promise<PermissionStatus> {
  const granted = await requestPermission(READ_PERMISSIONS);
  const grantedSet = new Set(
    granted
      .filter((p): p is Permission => 'recordType' in p)
      .map((p) => p.recordType)
  );
  const permissions: Record<string, boolean> = {};
  for (const p of READ_PERMISSIONS) {
    permissions[p.recordType] = grantedSet.has(p.recordType);
  }
  return {
    granted: READ_PERMISSIONS.every((p) => grantedSet.has(p.recordType)),
    permissions,
  };
}

export async function checkPermissions(): Promise<PermissionStatus> {
  const granted = await getGrantedPermissions();
  const grantedSet = new Set(
    granted
      .filter((p): p is Permission => 'recordType' in p)
      .map((p) => p.recordType)
  );
  const permissions: Record<string, boolean> = {};
  for (const p of READ_PERMISSIONS) {
    permissions[p.recordType] = grantedSet.has(p.recordType);
  }
  return {
    granted: READ_PERMISSIONS.every((p) => grantedSet.has(p.recordType)),
    permissions,
  };
}

function toTimeFilter(start: Date, end: Date) {
  return {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

export async function readHrv(
  start: Date,
  end: Date
): Promise<Array<{ value: number; recorded_at: string }>> {
  const result = await readRecords('HeartRateVariabilityRmssd', {
    timeRangeFilter: toTimeFilter(start, end),
  });
  return result.records.map((r) => ({
    value: r.heartRateVariabilityMillis,
    recorded_at: r.time,
  }));
}

export async function readRestingHr(
  start: Date,
  end: Date
): Promise<Array<{ value: number; recorded_at: string }>> {
  const result = await readRecords('RestingHeartRate', {
    timeRangeFilter: toTimeFilter(start, end),
  });
  return result.records.map((r) => ({
    value: r.beatsPerMinute,
    recorded_at: r.time,
  }));
}

export async function readSleepSessions(
  start: Date,
  end: Date
): Promise<
  Array<{
    start: string;
    end: string;
    durationMin: number;
    deepSleepPct: number;
    remSleepPct: number;
  }>
> {
  const result = await readRecords('SleepSession', {
    timeRangeFilter: toTimeFilter(start, end),
  });
  return result.records.map((session) => {
    const totalMs =
      new Date(session.endTime).getTime() -
      new Date(session.startTime).getTime();
    const stages = session.stages ?? [];
    let deepMs = 0;
    let remMs = 0;
    for (const stage of stages) {
      const durationMs =
        new Date(stage.endTime).getTime() -
        new Date(stage.startTime).getTime();
      if (stage.stage === SleepStageType.DEEP) deepMs += durationMs;
      else if (stage.stage === SleepStageType.REM) remMs += durationMs;
    }
    return {
      start: session.startTime,
      end: session.endTime,
      durationMin: totalMs / 60000,
      deepSleepPct: totalMs > 0 ? (deepMs / totalMs) * 100 : 0,
      remSleepPct: totalMs > 0 ? (remMs / totalMs) * 100 : 0,
    };
  });
}

export async function readSteps(start: Date, end: Date): Promise<number> {
  const result = await readRecords('Steps', {
    timeRangeFilter: toTimeFilter(start, end),
  });
  return result.records.reduce((sum, r) => sum + r.count, 0);
}

export async function readSpO2(
  start: Date,
  end: Date
): Promise<Array<{ value: number; recorded_at: string }>> {
  const result = await readRecords('OxygenSaturation', {
    timeRangeFilter: toTimeFilter(start, end),
  });
  return result.records.map((r) => ({
    value: r.percentage,
    recorded_at: r.time,
  }));
}

export async function readActiveMinutes(start: Date, end: Date): Promise<number> {
  const result = await readRecords('ActiveCaloriesBurned', {
    timeRangeFilter: toTimeFilter(start, end),
  });
  const totalMs = result.records.reduce((sum, r) => {
    return (
      sum +
      (new Date(r.endTime).getTime() - new Date(r.startTime).getTime())
    );
  }, 0);
  return totalMs / 60000;
}

export async function readHeartRate(
  start: Date,
  end: Date
): Promise<Array<{ value: number; recorded_at: string }>> {
  const result = await readRecords('HeartRate', {
    timeRangeFilter: toTimeFilter(start, end),
  });
  return result.records.flatMap((r) =>
    r.samples.map((s) => ({ value: s.beatsPerMinute, recorded_at: s.time }))
  );
}
