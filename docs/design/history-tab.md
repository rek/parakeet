# Feature: History Tab

**Status**: Implemented

**Date**: 2026-03-01 (upgraded 2026-03-07)

## Overview

Upgrade the History tab from a static snapshot view (text arrows, 20-session list) into a real analytics screen. Users can see 1RM progression charted over time, weekly volume load per lift, and drill into per-lift history with intensity breakdown.

## Problem Statement

The History tab shows estimated 1RM as a single number with a direction arrow (↑/→/↓). There is no chart, no time axis, and no way to see how 1RM has changed across sessions. Weekly volume is shown nowhere in the tab. There is no way to browse sessions by lift.

**Pain points:**

- Can't see if squat 1RM is trending up over the last 8 weeks or just one good session
- Can't see whether weekly sets are approaching MRV targets across lifts
- Can't compare Heavy vs Rep performance for the same lift over time
- Session list is unfiltered — bench and squat sessions mixed together

**Desired outcome:** History tab feels like a real training log — queryable, charted, actionable.

## User Experience

### History Tab (main screen)

**1RM section** — three lift cards (Squat / Bench / Deadlift):
- Shows current estimated 1RM + trend direction (unchanged from current)
- Cards are now tappable → navigates to per-lift drill-down

**Volume section** (new):
- `LineChart` (react-native-chart-kit): x-axis = week label (last 8 weeks), y-axis = sets completed
- Three bars per week group, one per lift, colour-coded
- Lets users see at a glance when volume was high/low and which lift drove it

**Recent Sessions section**:
- Filter chips: All / Squat / Bench / Deadlift — filters the session list in-component
- Otherwise unchanged (date, intensity, cycle phase tag, Done badge)

### Per-Lift Drill-Down (`/history/lift/[lift]`)

**Header**: lift name + current estimated 1RM

**1RM chart**:
- `LineChart` (react-native-chart-kit): x = session date, y = estimated 1RM in kg
- All historical sessions for that lift (no cutoff)
- Tooltip/label on data points showing date + value

**Intensity filter chips**: Heavy / Explosive / Rep / Deload / All
- Filters the session list below the chart
- Chart always shows all sessions (filter only affects the list)

**Session list**:
- Date, intensity type, estimated 1RM for that session, session RPE
- Ordered most recent first

## Technical Approach

- **Charting library**: `react-native-chart-kit` (peer dep on `react-native-svg` already installed)
- **1RM drill-down data**: `getPerformanceByLift(userId, lift)` — returns `LiftHistoryEntry[]` with date + 1RM + RPE per session
- **Volume chart data**: new `getWeeklySetsPerLift(userId, weeks?)` in `lib/performance.ts` — groups completed session_logs by ISO week + lift
- **Routing**: new Expo Router dynamic route `app/history/lift/[lift].tsx`

## Delivery

Single phase — spec: [mobile-026-history-tab-upgrade.md](../specs/09-mobile/mobile-026-history-tab-upgrade.md)

## Additional Enhancements (2026-03-07)

- **Completion time shown**: all three history surfaces (session list, session detail, lift detail) now display `HH:MM` completion time alongside the date (e.g. "7 Mar · 09:30")
- **Only completed sets stored**: fixed a bug where `completeSession` was saving *all* sets (including skipped/incomplete ones) to `session_logs.actual_sets` and `auxiliary_sets`. Now only sets with `is_completed === true` are persisted. The `completion_pct` and `performance_vs_plan` calculations were already correct (they used `is_completed` before the bug); only the stored set arrays were affected.
- **Session detail shows only completed sets**: `history/[sessionId].tsx` naturally shows what was actually performed, since the source data is now clean.

## References

- Related Design Docs: [cycle-review-and-insights.md](./cycle-review-and-insights.md)
- Specs: [mobile-020-history-screen.md](../specs/09-mobile/mobile-020-history-screen.md), [mobile-026-history-tab-upgrade.md](../specs/09-mobile/mobile-026-history-tab-upgrade.md)
