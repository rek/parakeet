# Spec: Intra-Session Heart Rate

**Status**: Planned
**Domain**: UI / Data

## What This Covers

Real-time heart rate monitoring during active training sessions via Health Connect, HR display in the session UI, and post-session HR data persistence and analysis. Phase 4 of the wearable integration.

## Tasks

### HR monitor hook

**`apps/parakeet/src/modules/wearable/hooks/useHrMonitor.ts`:**

- [ ] `useHrMonitor(isActive: boolean)` → `{ currentBpm: number | null, samples: HrSample[], isConnected: boolean }`
  - When `isActive` is true, begins observing `HeartRateRecord` from Health Connect
  - Samples HR every 5 seconds (or as frequently as Health Connect provides)
  - Accumulates samples in `HrSample[]` array: `{ timestamp_ms: number, bpm: number }`
  - `currentBpm` is the most recent reading (or null if no data)
  - `isConnected` indicates whether HR data is flowing
  - When `isActive` becomes false, stops observing and finalizes samples array
  - Implementation note: Health Connect may provide HR via `readRecords` polling rather than real-time observer — poll every 5s during active session

- [ ] Cleanup: on unmount, stop any active observation/polling

### HR badge component

**`apps/parakeet/src/modules/wearable/ui/HrBadge.tsx`:**

- [ ] `HrBadge` component — small pill showing current BPM:
  - Display: heart icon + "142" (current BPM)
  - Style: pill shape matching rest timer pill style, positioned in session header
  - Color: neutral when data flowing, gray when no data
  - Subtle pulse animation on each new reading (CSS scale transition, not animated loop)
  - When `currentBpm` is null, show "-- ♥" or hide entirely
  - `accessibilityLabel="Heart rate: 142 beats per minute"` (or "Heart rate unavailable")

### Session screen integration

**`apps/parakeet/src/app/(tabs)/session/[sessionId].tsx` (or relevant session screen):**

- [ ] Add HR monitoring to the session screen:
  - Activate `useHrMonitor(true)` when session status is 'in_progress'
  - Render `<HrBadge />` in the session header bar, next to the rest timer
  - Only render if `useWearableStatus().isPermitted` is true (hide entirely when no wearable)

- [ ] On session completion, pass HR samples to the completion flow:
  - `hrSamples` array available from the hook
  - Pass to `completeSession` service call (see persistence below)

### HR data persistence

**`apps/parakeet/src/modules/session/application/session.service.ts`:**

- [ ] Extend `completeSession` (or the session log insert path) to accept optional HR data:
  ```typescript
  hrData?: {
    samples: HrSample[]
    avgHr: number | null
    maxHr: number | null
    hrRecovery60s: number | null
  }
  ```

- [ ] When `hrData` is provided, include in the `session_logs` insert/update:
  - `hr_samples`: JSON.stringify(samples) — full array for post-hoc analysis
  - `avg_hr`: mean of all sample BPM values
  - `max_hr`: max of all sample BPM values
  - `hr_recovery_60s`: computed (see below)

### HR metrics computation

**`packages/training-engine/src/formulas/hr-metrics.ts`:**

- [ ] `computeAvgHr(samples: HrSample[])` → `number | null`
  - Mean BPM. Returns null if samples is empty.

- [ ] `computeMaxHr(samples: HrSample[])` → `number | null`
  - Max BPM. Returns null if samples is empty.

- [ ] `computeHrRecovery60s(samples: HrSample[], sessionEndTimestampMs: number)` → `number | null`
  - Find the peak HR in the last 5 minutes of the session
  - Find the HR reading closest to 60 seconds after that peak
  - Return `peakHr - recoveryHr` (positive = good recovery, higher is better)
  - Return null if insufficient data (fewer than 2 samples in the recovery window)
  - Context: HR recovery is a validated marker of cardiovascular fitness and autonomic readiness. A drop of >20 BPM in 60s is considered good.

### Decision replay enrichment

**`packages/training-engine/src/ai/prompts.ts`:**

- [ ] Extend `DECISION_REPLAY_SYSTEM_PROMPT` with HR context:
  ```
  Heart rate data (when present):
  - avgHr: average heart rate during the session.
  - maxHr: peak heart rate during the session.
  - hrRecovery60s: BPM drop in 60s after peak effort. >20 = good cardiovascular recovery.
  - Use HR data to validate RPE accuracy: high avgHr + low reported RPE suggests RPE under-reporting.
  - Compare maxHr across sessions for the same lift/intensity: rising maxHr at same weight may indicate declining fitness or under-recovery.
  ```

**`apps/parakeet/src/modules/session/application/decision-replay.service.ts`:**

- [ ] Include `avg_hr`, `max_hr`, `hr_recovery_60s` from `session_logs` in the decision replay payload when present

### Export from training engine

**`packages/training-engine/src/index.ts`:**

- [ ] Export `computeAvgHr`, `computeMaxHr`, `computeHrRecovery60s` from `formulas/hr-metrics`

### Tests

**`packages/training-engine/src/formulas/__tests__/hr-metrics.test.ts`:**

- [ ] `computeAvgHr`: normal samples → correct mean
- [ ] `computeAvgHr`: empty array → null
- [ ] `computeMaxHr`: returns highest BPM
- [ ] `computeHrRecovery60s`: clear peak + 60s later reading → correct delta
- [ ] `computeHrRecovery60s`: no data in recovery window → null
- [ ] `computeHrRecovery60s`: peak in last 5 min, recovery reading ~60s after → positive delta

## Dependencies

- [mobile-038-wearable-data-pipeline.md](./mobile-038-wearable-data-pipeline.md) — Health Connect abstraction layer and permissions
- [data-008-biometric-tables.md](../05-data/data-008-biometric-tables.md) — `session_logs` HR columns must exist
- [types-002-biometric-schemas.md](../03-types/types-002-biometric-schemas.md) — `HrSampleSchema`, `SessionHrDataSchema`
