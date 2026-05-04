# Spec: Wearable Data Pipeline

**Status**: Planned
**Domain**: App / Data
**Phase**: 1 (everything except `RecoveryCard` UI in §11) + Phase 2 hand-off (JIT wiring in §10)
**Owner**: any executor agent

## What This Covers

The `apps/parakeet/src/modules/wearable/` module: Health Connect abstraction, sync service, baseline + recovery snapshot computation, hooks (foreground sync, status, snapshot read), settings screen, and JIT wiring that feeds the recovery snapshot into `JITInput`. This is the bulk of Phase 1 plus the JIT integration step that bridges into Phase 2.

UI components on the soreness screen (`RecoveryCard`, `HrvTrendChart`, `SleepSummary`) are Phase 3 — see [spec-recovery-card.md](./spec-recovery-card.md). Intra-session HR is Phase 4 — see [spec-intra-hr.md](./spec-intra-hr.md).

## Prerequisites

- [spec-expo-plugin.md](./spec-expo-plugin.md) — `react-native-health-connect` must be installed and the dev client rebuilt.
- [spec-biometric-types.md](./spec-biometric-types.md) — Zod schemas exported from `@parakeet/shared-types`.
- [spec-biometric-data.md](./spec-biometric-data.md) — tables exist, RLS in place, repositories implemented.
- [spec-readiness-adjuster.md](./spec-readiness-adjuster.md) §2 (`computeReadinessScore`) — landed in Phase 1 alongside this spec, OR snapshot stores `readiness_score: null` until Phase 2.

## Module Skeleton

```
apps/parakeet/src/modules/wearable/
├── application/
│   ├── baseline.service.ts        # 7-day rolling baselines
│   ├── recovery.service.ts        # daily snapshot computation
│   └── sync.service.ts            # main entry point
├── data/
│   ├── biometric.repository.ts    # see spec-biometric-data.md §5
│   ├── recovery.repository.ts     # see spec-biometric-data.md §6
│   └── index.ts                   # barrel
├── hooks/
│   ├── useRecoverySnapshot.ts
│   ├── useWearableStatus.ts
│   └── useWearableSync.ts
├── lib/
│   └── health-connect.ts          # typed wrapper over react-native-health-connect
├── ui/
│   └── WearableSettings.tsx       # settings screen content
└── index.ts                       # public API
```

## Tasks

### 1. Health Connect abstraction

**File:** `apps/parakeet/src/modules/wearable/lib/health-connect.ts`

Wrap `react-native-health-connect` so the rest of the module never touches native types directly. Functions:

```typescript
import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  type Permission,
  type RecordType,
} from 'react-native-health-connect';

const READ_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'HeartRate' },                // intra-session, Phase 4
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
  // react-native-health-connect throws or returns a sentinel on unavailable platforms.
  // Wrap in try/catch and return false on any error.
}

export async function initHealthConnect(): Promise<boolean> {
  // Call once at app bootstrap. Returns true on success, false if unavailable.
}

export async function requestPermissions(): Promise<PermissionStatus>;
export async function checkPermissions(): Promise<PermissionStatus>;

// Read helpers — each returns normalised `{ value, recorded_at }` rows or sleep session shape.
export async function readHrv(start: Date, end: Date): Promise<Array<{ value: number; recorded_at: string }>>;
export async function readRestingHr(start: Date, end: Date): Promise<Array<{ value: number; recorded_at: string }>>;
export async function readSleepSessions(start: Date, end: Date): Promise<Array<{
  start: string;
  end: string;
  durationMin: number;
  deepSleepPct: number;
  remSleepPct: number;
}>>;
export async function readSteps(start: Date, end: Date): Promise<number>;
export async function readSpO2(start: Date, end: Date): Promise<Array<{ value: number; recorded_at: string }>>;
export async function readActiveMinutes(start: Date, end: Date): Promise<number>;
export async function readHeartRate(start: Date, end: Date): Promise<Array<{ value: number; recorded_at: string }>>;
```

**Notes:**
- All `value` fields are numbers in canonical units: HRV = ms (RMSSD), HR/RHR = BPM, sleep = minutes, SpO2 = percent.
- `readSleepSessions` aggregates stage durations into percentages: `deepSleepPct = sum(deep stage durations) / total session duration * 100`.
- Never `as any` on Health Connect types (per `feedback_zero_type_hacking.md`). If the library's types are incomplete, file an issue and commit a typed shim — don't inline cast.
- `isHealthConnectAvailable` must be safe to call on any platform — used to guard render paths.

### 2. Baseline service

**File:** `apps/parakeet/src/modules/wearable/application/baseline.service.ts`

```typescript
import { fetchReadingsForBaseline } from '../data/biometric.repository';
import type { BiometricType } from '@parakeet/shared-types';

const MIN_DAYS_FOR_BASELINE = 5;     // 5-day warmup gate (design decision)

/**
 * Returns the mean of the best (highest) reading per day for the last `days` days.
 * Returns null if fewer than MIN_DAYS_FOR_BASELINE distinct days have readings.
 *
 * For HRV and resting HR: "best per day" means the morning measurement when the body
 * is most rested. We approximate this by taking the lowest RHR and highest HRV
 * reading per day (typical morning physiology).
 */
export async function computeBaseline(
  userId: string,
  type: BiometricType,
  days: number
): Promise<number | null> {
  const readings = await fetchReadingsForBaseline(userId, type, days);
  if (readings.length === 0) return null;

  // Bucket by date (YYYY-MM-DD) and pick best per day.
  const byDay = new Map<string, number[]>();
  for (const r of readings) {
    const day = r.recorded_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(r.value);
  }
  if (byDay.size < MIN_DAYS_FOR_BASELINE) return null;

  const perDayBest: number[] = [];
  for (const values of byDay.values()) {
    if (type === 'resting_hr') perDayBest.push(Math.min(...values));
    else if (type === 'hrv_rmssd') perDayBest.push(Math.max(...values));
    else perDayBest.push(values.reduce((a, b) => a + b, 0) / values.length);
  }
  return perDayBest.reduce((a, b) => a + b, 0) / perDayBest.length;
}

export function computePctChange(currentValue: number, baseline: number | null): number | null {
  if (baseline === null || baseline === 0) return null;
  return ((currentValue - baseline) / baseline) * 100;
}
```

**The 5-day warmup gate is enforced here.** When fewer than 5 distinct days of readings exist, `computeBaseline` returns null, `computePctChange` returns null, the snapshot stores null `hrv_pct_change`/`rhr_pct_change`, and the engine's `hasWearableData(input)` returns false (since both `hrvPctChange` and `restingHrPctChange` are undefined). The subjective adjuster runs as today.

### 3. Recovery service

**File:** `apps/parakeet/src/modules/wearable/application/recovery.service.ts`

```typescript
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
    steps === null ? 0 :
    steps > 15000 ? 3 :
    steps >= 7000 ? 2 :
    steps >= 3000 ? 1 :
    0;
  const activeLevel: NonTrainingLoad =
    activeMinutes === null ? 0 :
    activeMinutes > 60 ? 3 :
    activeMinutes >= 30 ? 2 :
    activeMinutes >= 15 ? 1 :
    0;
  return Math.max(stepsLevel, activeLevel) as NonTrainingLoad;
}

export async function computeAndStoreRecoverySnapshot(
  userId: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Fetch today's latest readings + baselines in parallel.
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

  // 2. Sleep stage readings (deep + REM) — fetched alongside duration if persisted.
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
```

**Notes:**
- `computeReadinessScore` is imported from `@parakeet/training-engine`. If Phase 1 ships without it (alternative ordering), inline `readiness_score: null` and remove the import.
- Sleep stage percentages are persisted as separate readings (`deep_sleep_pct`, `rem_sleep_pct`) by the sync service — see §4. This simplifies querying in `recovery.service`.
- SpO2 auto-disruption logic intentionally omitted here. See [spec-spo2-disruption.md](./spec-spo2-disruption.md) for the deferred design.

### 4. Sync service

**File:** `apps/parakeet/src/modules/wearable/application/sync.service.ts`

```typescript
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
    ...hrv.map((r) => ({ type: 'hrv_rmssd' as const, value: r.value, recorded_at: r.recorded_at, source: 'health_connect' })),
    ...rhr.map((r) => ({ type: 'resting_hr' as const, value: r.value, recorded_at: r.recorded_at, source: 'health_connect' })),
    ...spo2.map((r) => ({ type: 'spo2' as const, value: r.value, recorded_at: r.recorded_at, source: 'health_connect' })),
    ...sleeps.flatMap((s) => [
      { type: 'sleep_duration' as const, value: s.durationMin, recorded_at: s.end, source: 'health_connect' },
      { type: 'deep_sleep_pct' as const, value: s.deepSleepPct, recorded_at: s.end, source: 'health_connect' },
      { type: 'rem_sleep_pct' as const, value: s.remSleepPct, recorded_at: s.end, source: 'health_connect' },
    ]),
    { type: 'steps' as const, value: steps, recorded_at: end.toISOString(), source: 'health_connect' },
    { type: 'active_minutes' as const, value: activeMins, recorded_at: end.toISOString(), source: 'health_connect' },
  ];

  const { insertedCount } = await upsertBiometricReadings(userId, readings);
  await computeAndStoreRecoverySnapshot(userId);

  return { synced: true, readingsInserted: insertedCount };
}
```

**Error handling:**
- Health Connect read errors throw — the foreground sync hook catches and `captureException`s.
- Supabase write errors throw — caller decides retry. Per `feedback_always_capture_exceptions.md`: never silently swallow, never strip `captureException`.

### 5. Bootstrap initialisation

**File:** `apps/parakeet/src/app/_layout.tsx`

In `RootLayoutNav` (the existing component that hosts other recovery hooks), call `useWearableSync()` after `useSessionRecovery`. Add `initHealthConnect()` invocation in the existing bootstrap sequence (where `@platform/supabase/bootstrap` runs) — wrap in try/catch, never let it crash the app on devices without Health Connect.

### 6. Foreground sync hook

**File:** `apps/parakeet/src/modules/wearable/hooks/useWearableSync.ts`

```typescript
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { captureException } from '@platform/utils/captureException';
import { useAuth } from '@modules/auth';

import { syncWearableData } from '../application/sync.service';

const LAST_SYNC_KEY = 'wearable_last_sync_ms';
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;     // 5 minutes

export function useWearableSync(): void {
  const { user } = useAuth();
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
      lastSyncRef.current = stored ? Number(stored) : 0;
    })();

    const handleChange = async (state: AppStateStatus) => {
      if (state !== 'active' || !user) return;
      const now = Date.now();
      if (now - lastSyncRef.current < MIN_SYNC_INTERVAL_MS) return;
      lastSyncRef.current = now;
      try {
        await syncWearableData(user.id);
        await AsyncStorage.setItem(LAST_SYNC_KEY, String(now));
      } catch (err) {
        captureException(err);
      }
    };

    const sub = AppState.addEventListener('change', handleChange);
    void handleChange(AppState.currentState);    // also fire on mount

    return () => sub.remove();
  }, [user]);
}
```

Mount once in `RootLayoutNav` (Step 5).

### 7. Status hook

**File:** `apps/parakeet/src/modules/wearable/hooks/useWearableStatus.ts`

```typescript
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { checkPermissions, isHealthConnectAvailable } from '../lib/health-connect';

export interface WearableStatus {
  isAvailable: boolean;
  isPermitted: boolean;
  lastSyncAt: number | null;
  isSyncing: boolean;
}

export function useWearableStatus(): WearableStatus {
  const [state, setState] = useState<WearableStatus>({
    isAvailable: false,
    isPermitted: false,
    lastSyncAt: null,
    isSyncing: false,
  });

  useEffect(() => {
    void (async () => {
      const isAvailable = await isHealthConnectAvailable();
      const perms = isAvailable ? await checkPermissions() : { granted: false, permissions: {} };
      const last = await AsyncStorage.getItem('wearable_last_sync_ms');
      setState({
        isAvailable,
        isPermitted: perms.granted,
        lastSyncAt: last ? Number(last) : null,
        isSyncing: false,
      });
    })();
  }, []);

  return state;
}
```

For Phase 1 the `isSyncing` flag is always false; refine later if a settings-screen "Sync now" button needs a spinner — the screen itself can manage that local state.

### 8. Recovery snapshot hook

**File:** `apps/parakeet/src/modules/wearable/hooks/useRecoverySnapshot.ts`

Per `apps/parakeet/CLAUDE.md` data-layer rules: define a `queryOptions` factory in `data/recovery.queries.ts` and consume it from the hook.

**File:** `apps/parakeet/src/modules/wearable/data/recovery.queries.ts`

```typescript
import { queryOptions } from '@tanstack/react-query';

import { fetchTodaySnapshot } from './recovery.repository';

export const recoveryQueryKeys = {
  all: ['wearable', 'recovery'] as const,
  today: (userId: string) => [...recoveryQueryKeys.all, 'today', userId] as const,
};

export function todayRecoverySnapshotOptions(userId: string) {
  return queryOptions({
    queryKey: recoveryQueryKeys.today(userId),
    queryFn: () => fetchTodaySnapshot(userId),
    staleTime: 5 * 60 * 1000,
  });
}
```

**File:** `apps/parakeet/src/modules/wearable/hooks/useRecoverySnapshot.ts`

```typescript
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';

import { todayRecoverySnapshotOptions } from '../data/recovery.queries';

export function useRecoverySnapshot() {
  const { user } = useAuth();
  return useQuery({
    ...todayRecoverySnapshotOptions(user?.id ?? ''),
    enabled: Boolean(user?.id),
  });
}
```

### 9. Wearable settings screen

**File:** `apps/parakeet/src/modules/wearable/ui/WearableSettings.tsx`

Render component (NOT a route — `app/settings/wearable.tsx` is the route shell):

- Health Connect status row: "Connected" / "Not available on this device" / "Permissions needed"
- "Connect Health Data" button — calls `requestPermissions()`, on success navigates back or refreshes status
- Last sync time display — relative format (e.g. "12 min ago") from `useWearableStatus().lastSyncAt`
- "Sync now" button — calls `syncWearableData(user.id)` with local loading state; show toast/alert on completion or error
- Device info — derived from `fetchLatestReading(userId, 'hrv_rmssd').source` if any reading exists
- Async handlers must `try/catch + captureException + Alert` (per `feedback_error_handling_screens.md` and `feedback_loading_flag_before_await.md` — flip `isSyncing` true BEFORE the first await)

**File:** `apps/parakeet/src/app/settings/wearable.tsx`

```typescript
import { SafeAreaView } from 'react-native-safe-area-context';

import { WearableSettings } from '@modules/wearable';

export default function WearableSettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <WearableSettings />
    </SafeAreaView>
  );
}
```

(Match the existing settings sub-route shell pattern — see `apps/parakeet/src/app/settings/training-days.tsx` etc. for the reference structure.)

**File:** `apps/parakeet/src/app/(tabs)/settings.tsx`

Add a row in the existing settings list (where "Manage Formulas", "Volume & Recovery" etc. live):

- Label: "Wearable"
- Status indicator dot: green (connected), amber (permissions needed), gray (not available)
- Subtitle: "Last sync 12m ago" / "Connect to enable" / "Not available"
- `onPress` → `router.push('/settings/wearable')`

Status data sourced from `useWearableStatus()`.

### 10. JIT wiring (Phase 2 hand-off)

**File:** `apps/parakeet/src/modules/jit/lib/jit.ts`

Inside `runJITForSession`, the existing `Promise.all` block has 12 fetches. Add the recovery snapshot fetch:

```typescript
import { fetchTodaySnapshot } from '@modules/wearable';

// existing destructuring + Promise.all...
const [
  // existing items...
  recoverySnapshot,
] = await Promise.all([
  // existing items...
  fetchTodaySnapshot(userId),
]);
```

When building `jitInput`, spread wearable fields when the snapshot exists:

```typescript
const jitInput: JITInput = {
  // existing fields...
  sleepQuality,                  // already passed in by caller
  energyLevel,                   // already passed in by caller
  ...(recoverySnapshot && {
    hrvPctChange: recoverySnapshot.hrv_pct_change ?? undefined,
    restingHrPctChange: recoverySnapshot.rhr_pct_change ?? undefined,
    sleepDurationMin: recoverySnapshot.sleep_duration_min ?? undefined,
    deepSleepPct: recoverySnapshot.deep_sleep_pct ?? undefined,
    spo2Avg: recoverySnapshot.spo2_avg ?? undefined,
    nonTrainingLoad: deriveNonTrainingLoadFromSnapshot(recoverySnapshot),
    readinessScore: recoverySnapshot.readiness_score ?? undefined,
  }),
};
```

Helper:

```typescript
import { deriveNonTrainingLoad } from '@modules/wearable';

function deriveNonTrainingLoadFromSnapshot(s: RecoverySnapshot): number | undefined {
  if (s.steps_24h === null && s.active_minutes_24h === null) return undefined;
  return deriveNonTrainingLoad(s.steps_24h, s.active_minutes_24h);
}
```

Re-export `deriveNonTrainingLoad` from the wearable module's public API (Step 12).

**Backward compatibility:** When `recoverySnapshot` is null OR all wearable fields are null, the spread does nothing and the engine's `hasWearableData(input)` returns false. Existing subjective flow runs unchanged. This is the zero-regression path.

### 11. UI integration (Phase 3 — defer)

`RecoveryCard`, `HrvTrendChart`, `SleepSummary`, conditional rendering on `soreness.tsx`. See [spec-recovery-card.md](./spec-recovery-card.md).

### 12. Module public API

**File:** `apps/parakeet/src/modules/wearable/index.ts`

```typescript
// Application
export {
  syncWearableData,
  type SyncResult,
} from './application/sync.service';
export {
  computeAndStoreRecoverySnapshot,
  deriveNonTrainingLoad,
} from './application/recovery.service';

// Data — exposed for JIT wiring + cycle review
export {
  fetchTodaySnapshot,
  fetchSnapshotsForRange,
} from './data/recovery.repository';

// Hooks
export { useRecoverySnapshot } from './hooks/useRecoverySnapshot';
export { useWearableStatus } from './hooks/useWearableStatus';
export { useWearableSync } from './hooks/useWearableSync';

// UI — Phase 1 settings
export { WearableSettings } from './ui/WearableSettings';

// Phase 3 UI exports added by spec-recovery-card.md
```

**Boundary rule:** the wearable module is a leaf — it imports from `@platform/*`, `@parakeet/training-engine`, `@parakeet/shared-types`, and `@modules/auth`, but NEVER from `@modules/jit`, `@modules/session`, or `@modules/disruptions` (auto-disruption case for SpO2 is deferred to [spec-spo2-disruption.md](./spec-spo2-disruption.md), where the dependency direction is documented).

## Validation

- `npx tsc -p apps/parakeet --noEmit` clean.
- Manual: install + grant permissions → first sync writes biometric_readings. Verify with `select count(*) from biometric_readings where user_id = '...'`.
- Manual: re-sync within 5 minutes → no new rows (foreground throttle works).
- Manual: re-sync after 5 minutes → upsert no-ops on existing `(user_id, type, recorded_at)`.
- Manual: with <5 days of HRV → `recovery_snapshots.hrv_pct_change` is null; JIT trace shows subjective adjuster fired.
- Manual: with ≥5 days of HRV → `recovery_snapshots.hrv_pct_change` populated; JIT trace shows wearable adjuster fired with non-null rationale.
- Boundary: `npx nx run parakeet:lint` (or equivalent boundary check) confirms no forbidden imports from app modules.

## Risks

- **AppState mount timing.** `AppState.addEventListener` may miss the initial 'active' on cold start. Mitigated by also calling `handleChange(AppState.currentState)` at mount.
- **Date string assumptions.** `new Date().toISOString().slice(0, 10)` returns UTC date. For users near midnight in non-UTC zones the snapshot may bind to "yesterday". Acceptable for v1; if needed, switch to a timezone-aware library (already used elsewhere in the app — search for existing date utils first).
- **Read race.** A pre-session run that arrives before `useWearableSync` completes will see stale or null data. Mitigation: also trigger sync from the soreness screen pre-mount when `lastSyncAt` is older than 30 min (Phase 3 implementation detail).

## Out of Scope

- `RecoveryCard` UI — see [spec-recovery-card.md](./spec-recovery-card.md).
- Intra-session HR — see [spec-intra-hr.md](./spec-intra-hr.md).
- SpO2 auto-disruption — see [spec-spo2-disruption.md](./spec-spo2-disruption.md).
- Cycle review snapshots — see [spec-cycle-review-recovery.md](./spec-cycle-review-recovery.md).

## Dependencies

- Upstream: types, data, expo-plugin (all Phase 1), readiness-score function (Phase 1 partial dep on Phase 2).
- Downstream: recovery-card (Phase 3), cycle-review-recovery (Phase 2), intra-hr (Phase 4).

## Domain References

- [domain/session-prescription.md](../../domain/session-prescription.md) — JIT pipeline integration
- [domain/athlete-signals.md](../../domain/athlete-signals.md)
