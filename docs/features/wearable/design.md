# Feature: Wearable Data Integration

**Status**: Planned
**Date**: 13 Mar 2026

## Overview

Integrates open-source wearable devices (heart rate monitors, smartwatches) into the JIT pipeline via Android Health Connect. Replaces subjective readiness signals (sleep quality, energy level) with objective physiological data (HRV, resting heart rate, sleep duration/stages) when available, and adds entirely new signals the system cannot capture today (HRV trends, intra-session heart rate, cardiac recovery).

## Problem Statement

The system currently captures readiness through two subjective 3-point scales: sleep quality (Poor / OK / Great) and energy level (Low / Normal / High). These are valuable but limited:

**Pain points:**
- Subjective signals are noisy. A lifter may report "OK" sleep when they actually slept 4.5 hours because they don't feel tired yet — cortisol masking is real. The system cannot distinguish genuine readiness from perceived readiness.
- HRV (heart rate variability) is the single best predictor of recovery status in strength training. It cannot be captured subjectively. A 20% HRV drop from baseline reliably predicts reduced training capacity, even when the athlete feels fine.
- Resting heart rate elevation is an early indicator of illness, overreaching, or incomplete recovery — often detectable 24–48 hours before symptoms appear. The system has no access to this signal.
- Sleep duration and stage data (deep sleep %, REM %) provide far more training-relevant information than a 3-point subjective scale. A lifter who slept 7 hours but got 8% deep sleep recovered less than one who slept 6 hours with 22% deep sleep.
- Intra-session heart rate data can validate RPE reports. If the watch says HR peaked at 185 but the lifter reported RPE 7, there is a calibration mismatch worth surfacing.
- Non-training physical load (steps, active minutes) contributes to total stress but is invisible to the system. A lifter who walked 25,000 steps on a rest day has less recovery capacity than one who rested.

**Desired outcome:** When a wearable is connected, the system automatically uses objective physiological data to calibrate every session — replacing guesswork with measurement. When no wearable is connected, the existing subjective flow works exactly as it does today.

## Device & Data Source Strategy

The integration is device-agnostic by design. Rather than coupling to a specific watch, the system reads from Android Health Connect — a standardized health data API that any device can write to.

**Recommended open-source stack:**

| Layer | Tool | Role |
|-------|------|------|
| Device | PineTime (InfiniTime), Bangle.js, or Gadgetbridge-compatible (Amazfit Bip/GTR, Mi Band, Casio, etc.) | HR, HRV, sleep, steps, SpO2 sensors |
| Bridge | Gadgetbridge (F-Droid) | Open-source Android app. Syncs device data to Health Connect. Supports 40+ device families. |
| API | Android Health Connect | Google's standardized health data layer. Read-only from Parakeet's perspective. |
| RN binding | `react-native-health-connect` | Expo-compatible typed API for Health Connect records |

This means Parakeet never communicates with the watch directly. The user sets up Gadgetbridge once (pair device, enable Health Connect sync), and Parakeet reads normalized data from Health Connect. If the user switches watches, nothing changes in Parakeet.

### Why Health Connect (not direct BLE)

- Health Connect normalizes data types across devices. HRV from a PineTime and HRV from an Amazfit arrive in the same schema.
- BLE communication is complex, device-specific, and battery-intensive. Gadgetbridge already solves this.
- Health Connect provides permission management and data access controls that Android users expect.
- Future-proof: if the user switches to a commercial watch (Garmin, Samsung), Health Connect still works.

## Signals & Training Value

| Signal | Health Connect Type | Training Value | Replaces/Extends |
|--------|-------------------|---------------|-----------------|
| **HRV (RMSSD)** | `HeartRateVariabilityRmssdRecord` | Gold standard recovery readiness. Drop >15% from 7-day baseline = impaired recovery. | Supersedes subjective `sleepQuality` + `energyLevel` |
| **Resting HR** | `RestingHeartRateRecord` | Elevated RHR = illness, fatigue, overreaching. >10% above baseline warrants caution. | Feeds readiness adjuster |
| **Sleep duration** | `SleepSessionRecord` | <6h = reduce volume. <5h = aggressive reduction. | Replaces subjective `sleepQuality` 1\|2\|3 |
| **Sleep stages** | `SleepSessionRecord.stages` | Deep sleep <15% = impaired muscular recovery regardless of total duration. | Nuances sleep beyond duration |
| **Intra-session HR** | `HeartRateRecord` (real-time observer) | RPE validation: HR says hard but lifter says easy → flag. Post-session EPOC estimation. | New signal — no subjective equivalent |
| **Steps / active minutes** | `StepsRecord` / `ActiveCaloriesBurnedRecord` | High non-training load compounds fatigue. >15k steps on rest day = reduced recovery. | New signal for total stress load |
| **SpO2** | `OxygenSaturationRecord` | Sudden drop below 94% flags illness before symptoms. Can auto-create disruption. | New signal — illness early warning |

### Signal Priority for JIT

1. **HRV % change from baseline** — highest weight. Integrates sleep, stress, training load, and recovery into one number.
2. **Sleep duration + deep sleep %** — direct recovery quality measure.
3. **Resting HR % change from baseline** — corroborates HRV; elevated RHR without HRV drop may indicate non-training stress.
4. **Non-training load** — contextual modifier.
5. **SpO2** — binary threshold for disruption auto-detection, not a continuous modifier.

### Objective vs Subjective Conflict Resolution

When wearable data and subjective input both exist:
- **Objective data takes precedence** for intensity/volume adjustments. If HRV says recovery is impaired but the lifter reports feeling great, the engine reduces load and explains why in the rationale.
- **Subjective data is still captured** and included in the JIT input. The LLM sees both signals and can note discrepancies. This is useful for calibration — if subjective and objective consistently diverge, the cycle review can surface it.
- **Subjective input is never blocked**. Even with a wearable, the lifter can still rate sleep/energy. The system treats wearable data as the primary signal and subjective as supporting context.

## User Experience

### User Flows

**Flow A — Setup (one-time):**

1. User installs Gadgetbridge from F-Droid and pairs their watch
2. In Gadgetbridge settings, user enables Health Connect sync
3. In Parakeet → Settings → Wearable, user taps "Connect Health Data"
4. Android Health Connect permission prompt appears (read-only: HR, HRV, sleep, steps, SpO2)
5. User grants permissions
6. Parakeet syncs last 7 days of data to establish baselines
7. Settings screen shows connection status, last sync time, device name

**Flow B — Daily sync (automatic, no user action):**

1. User wears watch overnight → Gadgetbridge syncs to Health Connect
2. User opens Parakeet → app foreground triggers Health Connect read (last 24h)
3. Sync service normalizes readings, persists to `biometric_readings`
4. Recovery service computes today's `recovery_snapshot`: HRV vs baseline, RHR vs baseline, sleep analysis, composite readiness score
5. Recovery snapshot upserted to Supabase

**Flow C — Pre-session with wearable data:**

1. User taps "Start" on today's session
2. Soreness check-in screen appears (unchanged)
3. Below soreness: **RecoveryCard** replaces the sleep/energy pickers when wearable data is available:
   - HRV trend sparkline (7 days) with today's reading highlighted
   - Sleep summary: duration + deep/REM %
   - Readiness score badge (0–100, color-coded)
   - If HRV or sleep is concerning, a brief note: "HRV 18% below baseline — session will be adjusted"
4. If no wearable data → existing sleep/energy pickers appear (zero regression)
5. User taps "Generate Today's Workout" → JIT runs with objective signals

**Flow D — Intra-session HR monitoring (Phase 4):**

1. During active session, Parakeet observes real-time HR from Health Connect
2. Small HR badge in session header shows current BPM
3. HR data sampled every 5s, stored with session log on completion
4. Post-session: avg HR, max HR, and 60s recovery (HR drop after last set) computed and stored

**Alternative flows:**
- Wearable not worn last night: no sleep/HRV data → falls back to subjective pickers
- Partial data (HR but no HRV): uses what's available, fills gaps with subjective input
- Health Connect permission denied: wearable module inactive, subjective flow unchanged
- Gadgetbridge not installed: same as no wearable — graceful degradation

### Visual Design Notes

- **RecoveryCard**: Rounded card matching existing soreness screen styling. HRV sparkline uses the accent color, with the current day's dot enlarged. Score badge uses red (<40) / amber (40–60) / green (>60) coloring.
- **HR badge in session**: Small pill in the session header, same style as the rest timer pill. Pulses subtly when receiving data.
- **Settings → Wearable**: Simple screen: connection status, last sync time, permissions toggle, "Sync Now" button.

## Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  PineTime / │     │              │     │                │
│  Amazfit /  │ BLE │ Gadgetbridge │ ──► │ Health Connect │
│  Mi Band    │ ──► │  (Android)   │     │   (Android)    │
└─────────────┘     └──────────────┘     └───────┬────────┘
                                                 │
                                    react-native-health-connect
                                                 │
                              ┌──────────────────▼──────────────────┐
                              │  wearable/application/sync.service  │
                              │  • read last 24h of HR, HRV, sleep  │
                              │  • dedup + normalize                 │
                              │  • persist to biometric_readings     │
                              └──────────────────┬──────────────────┘
                                                 │
                              ┌──────────────────▼──────────────────┐
                              │  wearable/application/recovery.svc  │
                              │  • compute baselines (7-day rolling) │
                              │  • compute % changes                 │
                              │  • composite readiness score         │
                              │  • upsert recovery_snapshots         │
                              └──────────────────┬──────────────────┘
                                                 │
                              ┌──────────────────▼──────────────────┐
                              │  jit/lib/jit.ts (runJITForSession)  │
                              │  • fetch today's recovery_snapshot   │
                              │  • populate wearable JITInput fields │
                              │  • engine uses wearable-readiness    │
                              │    adjuster when data present        │
                              └─────────────────────────────────────┘
```

**Sync triggers:**
- App foreground (`AppState` change listener) — read last 24h
- Pre-session (before JIT runs) — ensure fresh data, re-compute snapshot if stale
- Manual "Sync Now" in settings

## Data Model

### New tables

**`biometric_readings`** — raw time-series from Health Connect:
- `id` UUID PK
- `user_id` UUID FK → users
- `type` TEXT (hrv_rmssd | resting_hr | sleep_duration | deep_sleep_pct | rem_sleep_pct | spo2 | steps | active_minutes)
- `value` NUMERIC
- `recorded_at` TIMESTAMPTZ
- `source` TEXT (device name / 'health_connect')
- `created_at` TIMESTAMPTZ
- UNIQUE(user_id, type, recorded_at) — dedup on re-sync

**`recovery_snapshots`** — one computed row per user per day:
- `id` UUID PK
- `user_id` UUID FK → users
- `date` DATE
- `hrv_rmssd` NUMERIC nullable
- `hrv_baseline_7d` NUMERIC nullable
- `hrv_pct_change` NUMERIC nullable (negative = worse)
- `resting_hr` NUMERIC nullable
- `resting_hr_baseline_7d` NUMERIC nullable
- `rhr_pct_change` NUMERIC nullable (positive = worse)
- `sleep_duration_min` NUMERIC nullable
- `deep_sleep_pct` NUMERIC nullable
- `rem_sleep_pct` NUMERIC nullable
- `spo2_avg` NUMERIC nullable
- `steps_24h` NUMERIC nullable
- `active_minutes_24h` NUMERIC nullable
- `readiness_score` NUMERIC nullable (0–100)
- `created_at` TIMESTAMPTZ
- UNIQUE(user_id, date)

### Extensions to existing tables

**`session_logs`** — intra-session HR data (Phase 4):
- `hr_samples` JSONB nullable — `[{ timestamp_ms, bpm }]`
- `avg_hr` NUMERIC nullable
- `max_hr` NUMERIC nullable
- `hr_recovery_60s` NUMERIC nullable (BPM drop in first 60s post-last-set)

### New Zod schemas

`packages/shared-types/src/modules/biometric.schema.ts`:
- `BiometricTypeSchema` — enum of reading types
- `BiometricReadingSchema` — raw reading row
- `RecoverySnapshotSchema` — daily computed snapshot

### JITInput extensions

New optional fields on `JITInput` (backward compatible — all optional):
- `hrvPctChange?: number` — % change from 7-day baseline (negative = worse)
- `restingHrPctChange?: number` — % change from 7-day baseline (positive = worse)
- `sleepDurationMin?: number` — actual minutes slept last night
- `deepSleepPct?: number` — % of total sleep in deep stage
- `spo2Avg?: number` — overnight SpO2 average
- `nonTrainingLoad?: number` — 0–3 scale derived from steps + active minutes
- `readinessScore?: number` — composite 0–100 from recovery snapshot

When these fields are populated, they supersede `sleepQuality` and `energyLevel` in the readiness adjuster.

## Engine Integration

### Wearable readiness adjuster

New file: `packages/training-engine/src/adjustments/wearable-readiness-adjuster.ts`

Deterministic decision table (no LLM needed for the formula path):

| Condition | setReduction | intensityMultiplier | Rationale |
|-----------|-------------|--------------------|----|
| HRV drop >20% | 1 | 0.95 | "HRV significantly below baseline — reduced volume and intensity" |
| HRV drop 10–20% | 0 | 0.975 | "HRV below baseline — reduced intensity 2.5%" |
| RHR elevated >10% | 0 | 0.975 | "Resting heart rate elevated — reduced intensity 2.5%" |
| Sleep <5h | 1 | 0.95 | "Very short sleep — reduced volume and intensity" |
| Sleep 5–6h | 0 | 0.975 | "Short sleep — reduced intensity 2.5%" |
| Deep sleep <15% | 0 | 0.975 | "Low deep sleep — reduced intensity 2.5%" |
| SpO2 <94% | — | — | Auto-create illness disruption (handled separately) |
| HRV improvement >10% AND sleep >7h AND deep >20% | 0 | 1.025 | "Strong recovery signals — intensity boosted 2.5%" |

Stacking rules:
- HRV + RHR adjustments stack (multiplicative on intensityMultiplier)
- Sleep + HRV adjustments stack
- setReduction caps at 2 (never remove more than 2 sets from wearable signals alone)
- Final modifier still subject to existing hard constraints (40% intensity floor, 1 set minimum)

When wearable data is present, this adjuster runs **instead of** `getReadinessModifier`. When absent, `getReadinessModifier` runs as today.

### LLM prompt extension

Add to `JIT_SYSTEM_PROMPT`:

```
Wearable recovery data (when present):
- hrvPctChange: negative = worse recovery. >-20% is significant.
- restingHrPctChange: positive = elevated RHR. >10% warrants caution.
- sleepDurationMin: <360 (6h) is poor. <300 (5h) is critically low.
- deepSleepPct: <15% impairs muscular recovery regardless of total duration.
- readinessScore: 0-100 composite. <40 = significant concern. >70 = good.
- When wearable and subjective signals conflict, trust wearable data but note the discrepancy in rationale.
- Wearable signals do not override disruptions. A disruption still takes precedence.
```

### Cycle review integration

`CycleReport` input gains:
- `recoverySnapshots[]` — daily recovery data for the full cycle
- LLM can correlate HRV trends with performance, detect overreaching patterns, and suggest recovery adjustments

## App Module Structure

New module: `apps/parakeet/src/modules/wearable/`

```
wearable/
  application/
    sync.service.ts          # Health Connect read + normalize + persist
    recovery.service.ts      # Compute daily recovery snapshot from raw readings
    baseline.service.ts      # 7-day rolling baseline calculation
  data/
    biometric.repository.ts  # Supabase CRUD for biometric_readings
    recovery.repository.ts   # Supabase CRUD for recovery_snapshots
  hooks/
    useRecoverySnapshot.ts   # Today's recovery data for pre-session screen
    useWearableSync.ts       # Trigger sync on app foreground
    useWearableStatus.ts     # Connection status, last sync time
    useHrMonitor.ts          # Real-time HR during session (Phase 4)
  lib/
    health-connect.ts        # Health Connect init, permissions, typed read helpers
    readiness-score.ts       # Composite score formula (pure function, testable)
  ui/
    RecoveryCard.tsx          # Pre-session recovery summary card
    HrvTrendChart.tsx         # 7-day HRV sparkline
    SleepSummary.tsx          # Last night's sleep breakdown
    HrBadge.tsx              # In-session HR pill (Phase 4)
    WearableSettings.tsx     # Settings screen content
  index.ts                   # Public API: WearableModule.*
```

## Implementation Phases

### Phase 1 — Data Pipeline (no UI changes, no engine changes)
- Install `react-native-health-connect`
- Supabase migration: `biometric_readings`, `recovery_snapshots` tables
- Zod schemas in `shared-types`
- `wearable/` module: sync service, recovery service, baseline service
- Repositories for both tables
- `useWearableSync` hook (app foreground trigger)
- Settings screen: permissions, connection status
- **Validation**: sync runs, data persists, baselines compute correctly

### Phase 2 — Engine Integration (training engine changes, JIT wiring)
- Extend `JITInput` with wearable fields
- New `wearable-readiness-adjuster.ts` in training engine
- Wire `jit.ts` to fetch recovery snapshot and populate JIT input
- Update `JIT_SYSTEM_PROMPT` with wearable signal documentation
- Update `readiness-adjuster.ts` dispatch: wearable adjuster when data present, subjective adjuster when not
- **Validation**: JIT output changes when wearable data present, unchanged when absent

### Phase 3 — Pre-Session UI
- `RecoveryCard` component on soreness check-in screen
- `HrvTrendChart` sparkline
- `SleepSummary` display
- Conditional rendering: RecoveryCard when wearable data exists, existing sleep/energy pickers when not
- **Validation**: UI shows correct data, graceful fallback

### Phase 4 — Intra-Session HR & Post-Session Analysis
- Real-time HR observer via Health Connect during active session
- `HrBadge` component in session header
- HR samples stored on `session_logs` at completion
- Post-session: avg HR, max HR, HR recovery computation
- Decision replay prompt extension: include HR data for RPE validation
- `session_logs` migration for HR columns
- **Validation**: HR data captured during session, stored correctly, visible in dashboard

## User Benefits

**More accurate workouts**: Objective physiological data is more reliable than subjective self-assessment. HRV catches recovery deficits that lifters cannot feel. The workout adapts to the body's actual state, not the mind's perception of it.

**Early illness detection**: SpO2 drops and sustained RHR elevation can flag illness 24–48 hours before symptoms. The system can auto-create a disruption and begin protective adjustments before the lifter even knows they're getting sick.

**Zero friction when connected**: Once set up, wearable data flows automatically. The pre-session flow gets faster (no sleep/energy tapping needed) and more accurate simultaneously.

**Full backward compatibility**: No wearable? Nothing changes. Partial data? Use what's available, fill gaps with subjective input. The system is strictly additive.

**Intra-session insights**: Heart rate during training validates RPE reports and provides data for the decision replay system. Over time, this builds a calibration profile: "when this lifter reports RPE 8, their HR is typically X" — enabling more personalized prescription.

## What We Chose NOT To Do

- **No direct BLE communication**: Device communication is Gadgetbridge's job. Parakeet reads from Health Connect only. This avoids BLE complexity, battery drain, and device-specific code.
- **No continuous background sync**: The app syncs on foreground and pre-session. Background tasks add complexity (Expo background limitations, battery concerns) for marginal benefit — wearable data is only actionable at session time.
- **No automatic MRV adjustment from wearable data**: Wearable signals affect today's session (intensity/volume modifiers), not long-term MRV configuration. Adjusting MRV based on single-day physiological readings risks chasing noise.
- **No iOS Health Kit**: Parakeet is Android-only. Health Connect is the correct abstraction.
- **No HRV during training**: HRV measurement requires stillness. Intra-session, we use HR only.
- **No calorie tracking or body composition**: Out of scope. Wearable integration is focused on recovery readiness and training load, not nutrition.

## Open Questions

- [ ] Should the composite readiness score (0–100) be surfaced directly to the user, or only used internally by the engine? Showing it risks users anchoring on "the number" rather than trusting the system's adjustments.
- [ ] Should extreme SpO2 drops auto-create a disruption, or just surface a warning that the user must act on? Auto-creation is more protective but removes user agency.
- [ ] What is the minimum data history needed before baselines are reliable? 7 days is standard in sport science, but should the system wait 7 days before using wearable data for adjustments, or start immediately with wider confidence intervals?

## Future Enhancements

- **HRV-correlated MRV calibration**: After accumulating months of data, correlate HRV trends with performance outcomes to auto-tune MRV/MEV targets per muscle group.
- **Overreaching detection**: Multi-day HRV downtrend + rising RHR + declining performance → suggest proactive deload before the system's scheduled deload week.
- **Sleep coaching integration**: Surface sleep quality trends in cycle review. LLM can correlate poor sleep phases with training performance dips and suggest schedule adjustments.
- **HR zone training for conditioning**: Use HR data to prescribe conditioning work in specific heart rate zones (future, if Parakeet expands beyond pure strength training).

## References

- Related Design Docs: [body-state-readiness.md](./body-state-readiness.md), [ai-overview.md](./ai-overview.md), [disruption-management.md](./disruption-management.md)
- Spec: [types-002-biometric-schemas.md](./spec-biometric-schemas.md)
- Spec: [data-008-biometric-tables.md](./spec-biometric-tables.md)
- Spec: [engine-032-wearable-readiness-adjuster.md](./spec-readiness-adjuster.md)
- Spec: [mobile-038-wearable-data-pipeline.md](./spec-data-pipeline.md)
- Spec: [mobile-039-recovery-card-ui.md](./spec-recovery-card-ui.md)
- Spec: [mobile-040-intra-session-hr.md](./spec-intra-session-hr.md)
- External: Plews et al. (2013) "Training Adaptation and Heart Rate Variability in Elite Endurance Athletes"
- External: Flatt & Howells (2019) "Ultra-Short-Term Heart Rate Variability Monitoring for Recovery Assessment in Strength Training"
- External: Gadgetbridge project — https://gadgetbridge.org
- External: Android Health Connect — https://developer.android.com/health-and-fitness/guides/health-connect
