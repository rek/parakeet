# Spec: History Tab Upgrade

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Adds charted 1RM history (per-lift drill-down) and weekly volume line chart to the History tab. Adds lift filter chips to the session list.

## Dependencies

- [mobile-020-history-screen.md](./mobile-020-history-screen.md) — base history screen
- `react-native-svg` (already installed) — peer dep for react-native-chart-kit
- `react-native-chart-kit` — installed; used for LineChart
- `getPerformanceByLift` in `lib/performance.ts` (already implemented)
- `getCompletedSessions` in `lib/sessions.ts` (already implemented)

## Tasks

### ✅ 1. Install react-native-chart-kit

`victory-native` was evaluated but required Skia/Reanimated (not installed). Used `react-native-chart-kit` instead — peer dep is only `react-native-svg` (already present).

```bash
npm install react-native-chart-kit
```

---

### ✅ 2. `apps/parakeet/src/modules/history/lib/performance.ts` — add `getWeeklySetsPerLift`

Implemented. Queries `session_logs` joined with `sessions`, groups by ISO week start (Monday) + `primary_lift`, sums `actual_sets` array length per group. Returns sorted by `weekStart` ASC.

```ts
export async function getWeeklySetsPerLift(
  userId: string,
  weeks = 8
): Promise<{ weekStart: string; lift: Lift; setsCompleted: number }[]>
```

---

### ✅ 3. `apps/parakeet/src/app/(tabs)/history.tsx` — update

**Trend cards**: wrapped in `TouchableOpacity` → `router.push('/history/lift/${lift}')`. "Details ›" label added.

**New "Weekly Volume" section**: `LineChart` (react-native-chart-kit) with 3 datasets (squat=lime, bench=orange, deadlift=teal), last 8 weeks, colour legend below. Requires 2+ weeks of data; shows placeholder text otherwise.

**Recent Sessions filter chips**: All / Squat / Bench / Deadlift — filters session list in-component. Phase tags preserved.

**New React Query key**: `['volume', 'weekly', user?.id]` → `getWeeklySetsPerLift`.

All colours via `palette` theme tokens (no hardcoded hex).

---

### ✅ 4. New: `apps/parakeet/src/app/history/lift/[lift].tsx`

Implemented. Dynamic route under `history/lift/` segment.

- **Header**: `← History` back button + lift name + current 1RM badge (from trends query, staleTime 60s)
- **1RM chart**: `LineChart` coloured per lift; x-axis sparse labels (max 6); y-axis in kg; dots shown; requires 2+ data points
- **Intensity filter chips**: All / Heavy / Explosive / Rep / Deload — filters session list only (chart always shows all)
- **Session list**: date + intensity badge + estimated 1RM + RPE; most recent first

---

---

### ✅ 5. Completion time display (2026-03-07)

Added `formatTime(input)` to `apps/parakeet/src/shared/utils/date.ts` — returns `HH:MM` in device local time, empty string for null/invalid.

Three surfaces updated to show time alongside date:

- `history.tsx` `SessionRow`: `"7 Mar · 09:30"`
- `history/[sessionId].tsx` subtitle: `"Week 3 · Block 1 · 7 Mar · 09:30"`
- `history/lift/[lift].tsx` session rows: `"7 Mar · 09:30"`

Time is omitted (no separator) when `completed_at` is null.

---

### ✅ 6. Fix: only completed sets saved to session log (2026-03-07)

**Bug**: `completeSession` in `modules/session/application/session.service.ts` was storing all sets in `actual_sets`/`auxiliary_sets` — including those the user never completed — because `is_completed` was stripped before the insert without filtering first.

**Fix**: filter `normalizedSets` and `normalizedAuxiliarySets` to `is_completed === true` before stripping the flag and inserting. The `completion_pct` / `performance_vs_plan` calculation is unaffected (computed before the filter). Offline sync path goes through the same `completeSession` function; no separate fix needed.

Files changed:
- `apps/parakeet/src/modules/session/application/session.service.ts` — lines 242–247

---

## Acceptance Gates

- Volume chart renders with 3 coloured lines; legend shows Squat/Bench/Deadlift
- Empty state shown when < 2 weeks of data
- Trend cards navigate to `/history/lift/[lift]` on tap
- Drill-down renders 1RM line chart coloured per lift
- Intensity chips filter the session list; chart unaffected
- Lift filter chips on history tab narrow session list correctly
- No regressions on programs section, cycle patterns button, or session rows

## Screen Layout Reference

### History tab (updated)

```text
History

ESTIMATED 1RM
[Squat ↑  Details ›]  [Bench →  Details ›]  [Deadlift ↑  Details ›]

WEEKLY VOLUME
[line chart — 8 weeks, 3 coloured lines]
● Squat  ● Bench  ● Deadlift

COMPLETED PROGRAMS
...

RECENT SESSIONS
[All] [Squat] [Bench] [Deadlift]
Squat — Heavy              Feb 28   Done
...
```

### Per-lift drill-down

```text
← History

Squat                              187.5 kg

1RM PROGRESSION
[line chart — 1RM over time, lime colour]

SESSIONS
[All] [Heavy] [Explosive] [Rep] [Deload]

Feb 28  [Heavy]   187.5 kg   RPE 8
Feb 21  [Rep]     184.0 kg   RPE 7.5
...
```
