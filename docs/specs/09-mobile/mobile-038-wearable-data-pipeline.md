# Spec: Wearable Data Pipeline

**Status**: Planned
**Domain**: UI / Data

## What This Covers

The `wearable/` app module: Health Connect integration, background sync, baseline computation, recovery snapshot generation, and JIT input wiring. This is Phase 1 + Phase 2 wiring — the data pipeline that makes wearable data available to the training engine.

## Tasks

### Health Connect abstraction

**`apps/parakeet/src/modules/wearable/lib/health-connect.ts`:**

- [ ] `initHealthConnect()` — initialize the Health Connect SDK. Call once from app bootstrap (`_layout.tsx`). No-op if Health Connect is unavailable (emulator, old Android).

- [ ] `requestPermissions()` — request read permissions for:
  - `HeartRateVariabilityRmssdRecord`
  - `RestingHeartRateRecord`
  - `SleepSessionRecord`
  - `StepsRecord`
  - `OxygenSaturationRecord`
  - `HeartRateRecord` (for intra-session, Phase 4)
  - Returns `{ granted: boolean, permissions: Record<string, boolean> }`

- [ ] `checkPermissions()` — check current permission state without prompting
  - Returns same shape as `requestPermissions`

- [ ] `readHrvReadings(startTime: Date, endTime: Date)` → normalized `Array<{ value: number, recorded_at: string }>`
  - Reads `HeartRateVariabilityRmssdRecord` for time range
  - `value` = RMSSD in milliseconds

- [ ] `readRestingHr(startTime: Date, endTime: Date)` → normalized `Array<{ value: number, recorded_at: string }>`
  - Reads `RestingHeartRateRecord`
  - `value` = BPM

- [ ] `readSleepSessions(startTime: Date, endTime: Date)` → normalized sleep data:
  ```typescript
  Array<{
    start: string       // ISO datetime
    end: string         // ISO datetime
    durationMin: number
    deepSleepPct: number
    remSleepPct: number
  }>
  ```
  - Reads `SleepSessionRecord` with stages
  - Computes stage percentages from stage durations

- [ ] `readSteps(startTime: Date, endTime: Date)` → `number` (total steps)

- [ ] `readSpO2(startTime: Date, endTime: Date)` → normalized `Array<{ value: number, recorded_at: string }>`

- [ ] `isHealthConnectAvailable()` → `boolean` — checks if Health Connect is installed on device

### Sync service

**`apps/parakeet/src/modules/wearable/application/sync.service.ts`:**

- [ ] `syncWearableData(userId: string)` — main sync entry point:
  1. Check permissions via `checkPermissions()`. If not granted, return early (no error — just no-op).
  2. Read last 24 hours of data from Health Connect (all signal types).
  3. Normalize into `BiometricReading` rows.
  4. Upsert via `upsertBiometricReadings()` — dedup handled by unique constraint.
  5. Call `computeAndStoreRecoverySnapshot(userId)`.
  6. Return `{ synced: true, readingsInserted: number }`.

- [ ] Handle errors gracefully:
  - Health Connect unavailable → return `{ synced: false, reason: 'unavailable' }`
  - Permission denied → return `{ synced: false, reason: 'permission_denied' }`
  - Network error on Supabase write → throw (caller decides retry strategy)

### Baseline service

**`apps/parakeet/src/modules/wearable/application/baseline.service.ts`:**

- [ ] `computeBaseline(userId: string, type: BiometricType, days: number)` → `number | null`
  - Fetches readings via `fetchReadingsForBaseline(userId, type, days)`
  - Returns mean of values, or null if fewer than 3 readings exist (insufficient data)
  - For HRV and resting HR: use the single best reading per day (morning measurement) to avoid skewing from exercise readings

- [ ] `computePctChange(currentValue: number, baseline: number | null)` → `number | null`
  - Returns `((currentValue - baseline) / baseline) * 100`
  - Returns null if baseline is null

### Recovery service

**`apps/parakeet/src/modules/wearable/application/recovery.service.ts`:**

- [ ] `computeAndStoreRecoverySnapshot(userId: string)` — orchestrates snapshot computation:
  1. Fetch today's latest readings for each type from `biometric_readings`
  2. Compute 7-day baselines for HRV and resting HR via baseline service
  3. Compute % changes
  4. Compute sleep metrics from last sleep session
  5. Sum steps and active minutes for last 24h
  6. Compute composite `readinessScore` via `computeReadinessScore()` from training engine
  7. Upsert `recovery_snapshots` row for today

- [ ] `deriveNonTrainingLoad(steps: number | null, activeMinutes: number | null)` → `0 | 1 | 2 | 3`
  - 0 = sedentary (<3000 steps AND <15 active minutes)
  - 1 = light (3000–7000 steps OR 15–30 active minutes)
  - 2 = moderate (7000–15000 steps OR 30–60 active minutes)
  - 3 = heavy (>15000 steps OR >60 active minutes)
  - Uses whichever signal produces the higher load level

### JIT wiring

**`apps/parakeet/src/modules/jit/lib/jit.ts`:**

- [ ] In `runJITForSession`, after existing data fetches, add recovery snapshot fetch:
  ```typescript
  const recoverySnapshot = await fetchTodaySnapshot(userId)
  ```
  - Import `fetchTodaySnapshot` from `@modules/wearable`

- [ ] Populate wearable fields on `jitInput` when snapshot exists:
  ```typescript
  ...(recoverySnapshot && {
    hrvPctChange: recoverySnapshot.hrv_pct_change ?? undefined,
    restingHrPctChange: recoverySnapshot.rhr_pct_change ?? undefined,
    sleepDurationMin: recoverySnapshot.sleep_duration_min ?? undefined,
    deepSleepPct: recoverySnapshot.deep_sleep_pct ?? undefined,
    spo2Avg: recoverySnapshot.spo2_avg ?? undefined,
    nonTrainingLoad: deriveNonTrainingLoadFromSnapshot(recoverySnapshot),
    readinessScore: recoverySnapshot.readiness_score ?? undefined,
  })
  ```
  - When no snapshot exists, these fields remain undefined and the engine falls back to subjective readiness (existing behavior — zero regression)

- [ ] Add recovery snapshot fetch to the `Promise.all` block alongside other data fetches for parallel execution

### Sync hooks

**`apps/parakeet/src/modules/wearable/hooks/useWearableSync.ts`:**

- [ ] `useWearableSync()` — triggers sync on app foreground:
  - Listens to `AppState` changes
  - On transition to 'active', calls `syncWearableData(userId)` if last sync was >5 minutes ago
  - Stores last sync timestamp in Zustand or AsyncStorage
  - Mount in `_layout.tsx` or `(tabs)/_layout.tsx`

**`apps/parakeet/src/modules/wearable/hooks/useWearableStatus.ts`:**

- [ ] `useWearableStatus()` → `{ isAvailable, isPermitted, lastSyncAt, isSyncing }`
  - Checks Health Connect availability and permission state
  - Used by settings screen and conditional UI rendering

**`apps/parakeet/src/modules/wearable/hooks/useRecoverySnapshot.ts`:**

- [ ] `useRecoverySnapshot()` — React Query hook wrapping `fetchTodaySnapshot(userId)`
  - `staleTime: 5 * 60 * 1000` (5 min)
  - Returns today's recovery snapshot or null
  - Used by pre-session screen to render RecoveryCard

### Wearable settings screen

**`apps/parakeet/src/modules/wearable/ui/WearableSettings.tsx`:**

- [ ] Settings content component (rendered inside a settings route):
  - Health Connect status: "Connected" / "Not available" / "Permissions needed"
  - "Connect Health Data" button → calls `requestPermissions()`
  - Last sync time display
  - "Sync Now" button → calls `syncWearableData(userId)` with loading state
  - Device info (from last reading's `source` field)

**`apps/parakeet/src/app/settings/wearable.tsx`:**

- [ ] Expo Router screen that renders `WearableSettings`
- [ ] Add navigation entry in settings tab

### Module public API

**`apps/parakeet/src/modules/wearable/index.ts`:**

- [ ] Export as `WearableModule`:
  - `syncWearableData`
  - `useWearableSync`
  - `useWearableStatus`
  - `useRecoverySnapshot`
  - `fetchTodaySnapshot` (from repository, for JIT wiring)

### SpO2 auto-disruption

**`apps/parakeet/src/modules/wearable/application/recovery.service.ts`:**

- [ ] In `computeAndStoreRecoverySnapshot`, after computing `spo2Avg`:
  - If `spo2Avg < 94` AND no active illness disruption exists:
    - Auto-create a 'minor' severity illness disruption via disruption module
    - Include rationale: "SpO2 reading {spo2Avg}% — possible illness"
  - This is a suggestion, not a hard block. The disruption flows through the normal disruption pipeline.

## Dependencies

- [data-008-biometric-tables.md](../05-data/data-008-biometric-tables.md) — tables must exist
- [types-002-biometric-schemas.md](../03-types/types-002-biometric-schemas.md) — schemas for validation
- [engine-032-wearable-readiness-adjuster.md](../04-engine/engine-032-wearable-readiness-adjuster.md) — engine must accept wearable JITInput fields
- [mobile-011-soreness-checkin-screen.md](./mobile-011-soreness-checkin-screen.md) — RecoveryCard integrates into the existing soreness screen
