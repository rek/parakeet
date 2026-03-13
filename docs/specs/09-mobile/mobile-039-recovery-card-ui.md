# Spec: Recovery Card UI

**Status**: Planned
**Domain**: UI

## What This Covers

Pre-session UI components that display wearable recovery data on the soreness check-in screen: a RecoveryCard replacing the subjective sleep/energy pickers when wearable data is available, an HRV trend sparkline, and a sleep summary. Phase 3 of the wearable integration.

## Tasks

### RecoveryCard component

**`apps/parakeet/src/modules/wearable/ui/RecoveryCard.tsx`:**

- [ ] `RecoveryCard` component — renders when `useRecoverySnapshot()` returns data:
  - Top row: readiness score badge (circular, color-coded: red <40, amber 40–60, green >60) with label "Recovery Score"
  - Middle: `HrvTrendChart` sparkline
  - Bottom row: `SleepSummary` inline
  - If any signal is concerning (HRV drop >15%, sleep <6h, RHR elevated >10%), show a single-line note below: e.g., "HRV 18% below baseline — session will be adjusted"
  - Card styling: rounded corners, consistent with existing soreness screen card style
  - `accessible={true}`, `accessibilityLabel` describing the score and key signals

### HRV trend sparkline

**`apps/parakeet/src/modules/wearable/ui/HrvTrendChart.tsx`:**

- [ ] `HrvTrendChart` component:
  - Displays 7-day HRV RMSSD trend as a minimal sparkline (no axes, no labels — just the line)
  - Today's data point is an enlarged dot in accent color
  - Baseline shown as a thin horizontal dashed line
  - Data source: fetch last 7 days of `biometric_readings` where `type = 'hrv_rmssd'` (one per day, best morning reading)
  - If fewer than 3 data points, show a "Building baseline..." placeholder text instead of the chart
  - Use `react-native-svg` for the sparkline (already a project dependency via Expo)
  - Height: ~40px. Width: fills card.

### Sleep summary

**`apps/parakeet/src/modules/wearable/ui/SleepSummary.tsx`:**

- [ ] `SleepSummary` component — inline row:
  - Duration: "7h 23m" (formatted from `sleep_duration_min`)
  - Deep sleep: "18% deep" — color-coded (red <15%, green >=15%)
  - REM: "22% REM" — secondary text color
  - Layout: horizontal row, icon + text pairs
  - If sleep data is null, render nothing (component returns null)

### Conditional rendering on soreness screen

**`apps/parakeet/src/modules/session/ui/SorenessCheckin.tsx` (or equivalent):**

- [ ] Below the soreness muscle ratings section:
  - If `useRecoverySnapshot()` returns data → render `<RecoveryCard />`
  - If no snapshot → render existing sleep quality + energy level pill pickers (unchanged)
  - Transition: no animation needed. The screen simply shows one or the other based on data availability.
  - Both paths still render the "Generate Today's Workout" button below.

- [ ] When RecoveryCard is shown, the subjective sleep/energy pickers are hidden — not disabled, hidden. The user does not need to tap anything for readiness; it's automatic from wearable data.

- [ ] The existing `sleepQuality` and `energyLevel` state variables:
  - When RecoveryCard is shown: pass `undefined` to `runJITForSession` for both (engine will use wearable data from the recovery snapshot)
  - When pickers are shown: pass selected values as today (unchanged behavior)

### History / analytics integration (stretch)

**`apps/parakeet/src/modules/history/ui/RecoveryTrend.tsx`:**

- [ ] `RecoveryTrend` component — optional addition to the history tab:
  - 30-day readiness score trend line
  - Overlay training session markers (dots on days with sessions)
  - Helps the lifter see correlation between recovery and training
  - Lower priority — can be deferred to a follow-up

### Settings wearable status indicator

**`apps/parakeet/src/app/(tabs)/settings.tsx`:**

- [ ] Add a row in the settings list: "Wearable" with subtitle showing connection status
  - "Connected — last sync 12m ago" (green dot)
  - "Not connected" (gray dot)
  - "Permissions needed" (amber dot)
  - Taps through to `settings/wearable.tsx` route

## Dependencies

- [mobile-038-wearable-data-pipeline.md](./mobile-038-wearable-data-pipeline.md) — hooks and data must be available
- [mobile-035-enhanced-readiness-checkin.md](./mobile-035-enhanced-readiness-checkin.md) — existing soreness/readiness screen being extended
- [engine-032-wearable-readiness-adjuster.md](../04-engine/engine-032-wearable-readiness-adjuster.md) — engine accepts wearable signals
