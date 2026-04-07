# Spec: Weekly Volume (kg) Chart + Time Range Selector

**Status**: Implemented

**Domain**: UI

## What This Covers

Adds a second chart to the history tab showing weekly volume in kg (weight × reps per lift), below the existing "Weekly Volume (sets)" chart. Also adds a time range selector — 1M / 3M / All — that controls how far back both charts look. Closes rek/parakeet#133.

## Tasks

**`apps/parakeet/src/modules/history/lib/performance.ts`:**

- [x] Add `getWeeklyVolumeKg(userId, weeks)` — same bucketing as `getWeeklySetsPerLift` but computes `sum(weight_grams / 1000 * reps_completed)` per week per lift
  - Filter out sets with missing `weight_grams` or `reps_completed <= 0`
  - Return `{ weekStart: string; lift: Lift; volumeKg: number }[]`
  - For "all time" pass a large `weeks` value (260); the function already computes `fromDate` from it
- [x] Unit tests:
  - Single session with known sets → expected `volumeKg` total
  - Sets with missing weight/reps excluded
  - Multiple lifts in same week bucketed separately

**`apps/parakeet/src/modules/history/utils/chart-helpers.ts`:**

- [x] Add `WeeklyVolKgRow` type: `{ weekStart: string; lift: Lift; volumeKg: number }`
- [x] Add `buildVolumeKgChartData(weeklyData, liftColors, liftFilter?)` — reads `volumeKg` instead of `setsCompleted`
- [x] Add label stepping to both `buildVolumeChartData` and `buildVolumeKgChartData` — show at most 6 x-axis labels regardless of data length (same pattern as `buildLiftChartData`)

**`apps/parakeet/src/modules/history/data/history.queries.ts`:**

- [x] Add `weeklyVolumeKg(userId, weeks)` query factory using `getWeeklyVolumeKg`
  - Query key: `['volume', 'weekly-kg', userId, weeks]`

**`apps/parakeet/src/modules/history/hooks/useHistoryScreen.ts`:**

- [x] Accept `weeks: number` parameter; pass it to both `weeklySetsPerLift` and `weeklyVolumeKg` queries
- [x] Return `volumeKg` and `volumeKgLoading` in addition to existing fields

**`apps/parakeet/src/app/(tabs)/history.tsx`:**

- [x] Add `timeRange` state: `'1m' | '3m' | 'all'` (default `'3m'`)
- [x] Map to weeks: `{ '1m': 4, '3m': 13, 'all': 260 }`
- [x] Render a time range selector row (same chip style as the lift filter) below the lift filter, above the charts
- [x] Pass derived `weeks` to `useHistoryScreen`
- [x] Build `volumeKgChartData` from `volumeKg` using `buildVolumeKgChartData`
- [x] Render second `LineChart` below the sets chart, header "Weekly Volume (kg)"
- [x] `formatYLabel` for kg chart: `Math.round(Number(v))` (values naturally in hundreds)

## Dependencies

- [spec-tab-upgrade.md](./spec-tab-upgrade.md) — existing history tab structure this extends
