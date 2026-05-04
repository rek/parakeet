# Spec: Intra-Session Heart Rate

**Status**: Planned
**Domain**: UI / Data / Engine
**Phase**: 4 (Intra-Session HR & Post-Session Analysis)
**Owner**: any executor agent

## What This Covers

Real-time heart rate observation during active training sessions via Health Connect, an HR badge in the session UI, persistence of HR samples + summary metrics on `session_logs`, three pure HR computation helpers in the training engine, and decision-replay enrichment so the LLM can use HR for RPE validation.

## Prerequisites

- Phase 1 fully landed (`react-native-health-connect`, `health-connect.ts` lib including `readHeartRate`).
- [spec-biometric-types.md](./spec-biometric-types.md) — `HrSampleSchema`, `SessionHrDataSchema` exported.
- [spec-biometric-data.md](./spec-biometric-data.md) §2 migration applied (`session_logs.hr_samples`, `avg_hr`, `max_hr`, `hr_recovery_60s` columns).
- Generated Supabase types include the new `session_logs` columns.

## Existing Surface

- Active session screen: `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`. The screen owns rest-timer pill rendering — that's where `HrBadge` slots in.
- Session completion: `apps/parakeet/src/modules/session/application/session.service.ts` `completeSession(sessionId, userId, input)` calls `insertSessionLog({...})`. Extend `CompleteSessionInput` and the insert payload.
- Decision replay: `apps/parakeet/src/modules/session/application/decision-replay.service.ts` builds payload from session log fields. Extend the SELECT and the prompt body.

## Tasks

### 1. HR monitor hook

**File:** `apps/parakeet/src/modules/wearable/hooks/useHrMonitor.ts`

```typescript
import { useEffect, useRef, useState } from 'react';

import { captureException } from '@platform/utils/captureException';
import type { HrSample } from '@parakeet/shared-types';
import { readHeartRate } from '../lib/health-connect';

const POLL_INTERVAL_MS = 5000;

export interface HrMonitorState {
  currentBpm: number | null;
  samples: HrSample[];
  isConnected: boolean;
}

export function useHrMonitor(isActive: boolean): HrMonitorState {
  const [state, setState] = useState<HrMonitorState>({
    currentBpm: null,
    samples: [],
    isConnected: false,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const samplesRef = useRef<HrSample[]>([]);

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    samplesRef.current = [];
    setState({ currentBpm: null, samples: [], isConnected: false });

    let lastReadAt = new Date(Date.now() - 60_000);    // first poll covers last minute

    const poll = async () => {
      try {
        const now = new Date();
        const reads = await readHeartRate(lastReadAt, now);
        lastReadAt = now;
        if (reads.length === 0) {
          setState((prev) => ({ ...prev, isConnected: prev.samples.length > 0 }));
          return;
        }
        const newSamples: HrSample[] = reads.map((r) => ({
          timestamp_ms: new Date(r.recorded_at).getTime(),
          bpm: r.value,
        }));
        samplesRef.current = [...samplesRef.current, ...newSamples];
        const last = newSamples[newSamples.length - 1];
        setState({
          currentBpm: last.bpm,
          samples: samplesRef.current,
          isConnected: true,
        });
      } catch (err) {
        captureException(err);
        setState((prev) => ({ ...prev, isConnected: false }));
      }
    };

    void poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isActive]);

  return state;
}
```

**Notes:**
- Polling, not real-time observer — Health Connect's APIs are read-on-demand per `react-native-health-connect`.
- `samples` accumulates for the entire active period; consumer reads `samples` at completion to persist.
- On `isActive: false`, the hook does NOT clear `samples` — the caller may still need them for completion.

### 2. `HrBadge` component

**File:** `apps/parakeet/src/modules/wearable/ui/HrBadge.tsx`

```typescript
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  bpm: number | null;
}

export function HrBadge({ bpm }: Props) {
  // Pill, similar style to existing rest-timer pill in session header.
  // Display: "♥ 142" when bpm present; "♥ --" or hidden when null (decide per design — prefer hidden).
  // Accessibility:
  //   accessible={true}
  //   accessibilityLabel={bpm ? `Heart rate ${bpm} beats per minute` : 'Heart rate unavailable'}
  // Subtle pulse: scale animation 1.0 → 1.05 → 1.0 over 250ms each time bpm changes.
}
```

- Match existing rest-timer pill geometry (find in the session screen).
- Neutral colour when `bpm > 0`, muted/grey when null.
- Heart icon: use the existing icon library (e.g. `@expo/vector-icons` if already used, otherwise an inline SVG). Do NOT introduce a new icon dependency.

### 3. Session screen integration

**File:** `apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`

- Read `useWearableStatus().isPermitted` — guard the entire HR feature on permission.
- Activate `useHrMonitor(isPermitted && status === 'in_progress')`.
- Render `<HrBadge bpm={currentBpm} />` in the session header next to the rest timer pill, only when `isPermitted`.
- On session completion (the existing "Complete" / "Finish" handler):
  - Snapshot `samples` from the hook before navigating away.
  - Pass `hrData` to `completeSession`.

**Hook ordering:** `useHrMonitor` must be called BEFORE any conditional early return in the screen (per `feedback_hooks_before_early_return.md`).

### 4. Extend `completeSession`

**File:** `apps/parakeet/src/modules/session/application/session.service.ts`

```typescript
import { computeAvgHr, computeMaxHr, computeHrRecovery60s } from '@parakeet/training-engine';
import type { HrSample } from '@parakeet/shared-types';

export interface CompleteSessionInput {
  // existing fields...
  hrData?: { samples: HrSample[] };
}

export async function completeSession(
  sessionId: string,
  userId: string,
  input: CompleteSessionInput
): Promise<void> {
  // existing logic up to insertSessionLog...

  let hrFields = {};
  if (input.hrData?.samples?.length) {
    const sessionEndMs = new Date(input.completedAt).getTime();
    hrFields = {
      hr_samples: input.hrData.samples,
      avg_hr: computeAvgHr(input.hrData.samples),
      max_hr: computeMaxHr(input.hrData.samples),
      hr_recovery_60s: computeHrRecovery60s(input.hrData.samples, sessionEndMs),
    };
  }

  await insertSessionLog({
    sessionId,
    userId,
    sessionRpe: input.sessionRpe,
    completionPct,
    performanceVsPlan,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    ...hrFields,
  });
}
```

- Computation lives in the training engine (Step 5) — service layer just wires it.
- Existing sessions with no wearable: `hrFields` is `{}`, all four new columns stay null. Zero regression.

### 5. HR metrics formulas

**File:** `packages/training-engine/src/formulas/hr-metrics.ts`

```typescript
import type { HrSample } from '@parakeet/shared-types';

export function computeAvgHr(samples: HrSample[]): number | null {
  if (samples.length === 0) return null;
  const sum = samples.reduce((a, s) => a + s.bpm, 0);
  return Math.round(sum / samples.length);
}

export function computeMaxHr(samples: HrSample[]): number | null {
  if (samples.length === 0) return null;
  return Math.max(...samples.map((s) => s.bpm));
}

/**
 * Heart rate recovery: how many BPM the heart drops in 60 seconds
 * after the peak HR in the last 5 minutes of the session.
 * A drop >20 BPM is a strong autonomic-recovery marker.
 */
export function computeHrRecovery60s(
  samples: HrSample[],
  sessionEndTimestampMs: number
): number | null {
  if (samples.length < 2) return null;

  const lastFiveMinStart = sessionEndTimestampMs - 5 * 60 * 1000;
  const lateSamples = samples.filter((s) => s.timestamp_ms >= lastFiveMinStart);
  if (lateSamples.length === 0) return null;

  const peak = lateSamples.reduce((acc, s) => (s.bpm > acc.bpm ? s : acc), lateSamples[0]);
  const targetMs = peak.timestamp_ms + 60 * 1000;

  // Find the sample closest in time to peak + 60s, within ±15s tolerance.
  let closest: HrSample | null = null;
  let closestDelta = Infinity;
  for (const s of samples) {
    const delta = Math.abs(s.timestamp_ms - targetMs);
    if (delta < closestDelta && delta <= 15_000) {
      closest = s;
      closestDelta = delta;
    }
  }
  if (!closest) return null;

  return peak.bpm - closest.bpm;
}
```

**Notes:**
- ±15 second tolerance is arbitrary but matches the 5-second polling interval generously.
- Returns null when the recovery window has insufficient data — caller stores null without flagging an error.
- Tests in §6 cover the boundary conditions.

### 6. Tests

**File:** `packages/training-engine/src/formulas/__tests__/hr-metrics.test.ts`

Vitest. Cover:

- `computeAvgHr([])` → null.
- `computeAvgHr([{bpm: 100}, {bpm: 120}, {bpm: 140}])` → 120.
- `computeMaxHr([{bpm: 100}, {bpm: 180}, {bpm: 140}])` → 180.
- `computeMaxHr([])` → null.
- `computeHrRecovery60s`: peak at t=session_end - 30s with bpm 180; reading at t=session_end + 30s with bpm 130 → returns 50.
- `computeHrRecovery60s`: only one sample in last 5min → null.
- `computeHrRecovery60s`: peak found but no reading within ±15s of peak+60s → null.
- `computeHrRecovery60s`: empty samples → null.

### 7. Engine package exports

**File:** `packages/training-engine/src/index.ts`

```typescript
export {
  computeAvgHr,
  computeMaxHr,
  computeHrRecovery60s,
} from './formulas/hr-metrics';
```

### 8. Decision-replay enrichment

**File:** `apps/parakeet/src/modules/session/application/decision-replay.service.ts`

Extend the payload built for the LLM to include HR fields when present:

```typescript
const sessionLog = await fetchSessionLog(sessionId);    // adjust for actual fn name

const replayPayload = {
  // existing fields: jitInputSnapshot, plannedSets, actualSets, auxiliarySets, sessionRpe, lift, intensityType, blockNumber...
  ...(sessionLog.avg_hr !== null && {
    hrData: {
      avgHr: sessionLog.avg_hr,
      maxHr: sessionLog.max_hr,
      hrRecovery60s: sessionLog.hr_recovery_60s,
    },
  }),
};
```

Extend the SELECT in the underlying repository to include `avg_hr`, `max_hr`, `hr_recovery_60s` (do NOT pull `hr_samples` JSONB — too large for replay context).

### 9. Decision-replay prompt

**File:** `packages/training-engine/src/ai/prompts.ts`

Append to `DECISION_REPLAY_SYSTEM_PROMPT`:

```
Heart rate data (when present):
- hrData.avgHr: average heart rate during the session.
- hrData.maxHr: peak heart rate.
- hrData.hrRecovery60s: BPM drop in 60s after peak effort. Above 20 = good cardiovascular recovery.

Use HR data to validate RPE:
- High avgHr (e.g. > 150) combined with a low reported RPE (e.g. 6) suggests RPE under-reporting — note this gently.
- Rising maxHr across recent sessions at the same prescribed weight may indicate declining fitness or under-recovery.
HR data is supporting context only; never override the lifter's reported RPE — flag the discrepancy in the rationale instead.
```

### 10. Module exports

**File:** `apps/parakeet/src/modules/wearable/index.ts`

```typescript
export { useHrMonitor } from './hooks/useHrMonitor';
export { HrBadge } from './ui/HrBadge';
```

## Validation

- `npx vitest run packages/training-engine` — green; new tests pass.
- `npx tsc -p apps/parakeet --noEmit` clean.
- Manual end-to-end:
  1. Start a session with HR-capable wearable connected → badge shows live BPM after 5–10s.
  2. Complete the session → `select hr_samples, avg_hr, max_hr, hr_recovery_60s from session_logs where id = '...'` shows populated values.
  3. Complete a session WITHOUT a wearable → all four columns null; existing flow unchanged.
- Decision replay: trigger replay for a session with HR data → LLM payload includes `hrData` block.

## Risks

- **Polling cost.** A 5s poll for an hour is 720 reads. Health Connect handles this fine but observe battery on long sessions. Consider increasing the interval to 10s if profiling flags impact.
- **Stage-switch race.** When the user finishes the session and immediately backgrounds the app, the final batch of samples may not be flushed. Mitigation: flush samples synchronously inside the completion handler before any navigation/background suspension.
- **Sample size.** A 90-minute session could capture ~1080 samples (5s × 1080 = 90min). At ~40 bytes per sample (`{timestamp_ms, bpm}`), the row is ~45KB JSON. Acceptable but watch for outliers — if a single-row JSONB exceeds 100KB, consider downsampling to 10s before persistence.

## Out of Scope

- HRV during training (requires stillness — not feasible mid-set).
- HR-zone training prescriptions (Parakeet is strength-focused).
- Real-time RPE coaching from HR — out of scope for v1.
- iOS Health Kit.

## Dependencies

- Upstream: spec-biometric-types, spec-biometric-data, spec-pipeline (for `readHeartRate` lib and `useWearableStatus`).
- Downstream: none.

## Domain References

- [domain/performance-analysis.md](../../domain/performance-analysis.md) — RPE calibration, decision replay
- [domain/athlete-signals.md](../../domain/athlete-signals.md)
