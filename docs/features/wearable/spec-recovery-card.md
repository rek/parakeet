# Spec: Recovery Card UI

**Status**: Planned
**Domain**: UI
**Phase**: 3 (Pre-Session UI)
**Owner**: any executor agent

## What This Covers

Pre-session UI components that surface wearable recovery data on the soreness check-in screen: a `RecoveryCard` that conditionally replaces the existing `ReadinessPillRow` sleep + energy selectors when wearable data is available, an HRV trend sparkline, and a sleep summary. The settings tab also gets a status-aware "Wearable" row.

This spec **does not** introduce a new component called `SorenessCheckin` — none exists. The actual screen is `apps/parakeet/src/app/(tabs)/session/soreness.tsx`, which composes its own UI inline (muscle ratings, two `ReadinessPillRow` components for sleep/energy, generate button).

## Prerequisites

- [spec-pipeline.md](./spec-pipeline.md) — `useRecoverySnapshot`, `useWearableStatus` hooks live; settings sub-route exists.
- [spec-readiness-adjuster.md](./spec-readiness-adjuster.md) — engine accepts wearable signals (so the "session will be adjusted" copy reflects reality).
- [spec-biometric-data.md](./spec-biometric-data.md) — `biometric_readings` populated for sparkline data fetch.

## Existing Surface

`apps/parakeet/src/app/(tabs)/session/soreness.tsx` (verified at scan):

- Renders muscle rating rows (primary + collapsible "other")
- Renders two `ReadinessPillRow` components for `sleepQuality` (5-pill) and `energyLevel` (5-pill)
- Renders cycle phase chip + severe-soreness warning
- Renders "Generate Today's Workout" button → calls `runJIT(ratings)` → `runJITForSession(session, user.id, ratings, sleepQuality, energyLevel, cyclePhase)`
- Local state `sleepQuality` / `energyLevel` (default 2 each)

`ReadinessPillRow` is defined inline in the same file. Do not extract it — Phase 3 hides those rows when the recovery card renders, no need to refactor.

## Tasks

### 1. `RecoveryCard` component

**File:** `apps/parakeet/src/modules/wearable/ui/RecoveryCard.tsx`

```typescript
import { View, Text, StyleSheet } from 'react-native';

import { useRecoverySnapshot } from '../hooks/useRecoverySnapshot';

import { HrvTrendChart } from './HrvTrendChart';
import { SleepSummary } from './SleepSummary';

import { useTheme } from '../../../theme/ThemeContext';            // path matches existing imports
import type { ColorScheme } from '../../../theme';

export function RecoveryCard() {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const { data: snapshot } = useRecoverySnapshot();

  if (!snapshot) return null;

  const score = snapshot.readiness_score;
  const concern = buildConcernNote(snapshot);

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={buildAccessibilityLabel(snapshot)}
    >
      <View style={styles.header}>
        <ScoreBadge score={score} colors={colors} />
        <Text style={styles.title}>Recovery</Text>
      </View>
      <HrvTrendChart />
      <SleepSummary
        durationMin={snapshot.sleep_duration_min}
        deepPct={snapshot.deep_sleep_pct}
        remPct={snapshot.rem_sleep_pct}
      />
      {concern && <Text style={styles.concern}>{concern}</Text>}
    </View>
  );
}

function buildConcernNote(s: NonNullable<ReturnType<typeof useRecoverySnapshot>['data']>): string | null {
  if (s.hrv_pct_change !== null && s.hrv_pct_change <= -15) {
    return `HRV ${Math.abs(Math.round(s.hrv_pct_change))}% below baseline — session will be adjusted`;
  }
  if (s.sleep_duration_min !== null && s.sleep_duration_min < 360) {
    return `Short sleep (${formatHours(s.sleep_duration_min)}) — session will be adjusted`;
  }
  if (s.rhr_pct_change !== null && s.rhr_pct_change >= 10) {
    return `Resting HR ${Math.round(s.rhr_pct_change)}% above baseline — session will be adjusted`;
  }
  return null;
}
```

**Score badge:**
- Circular pill with the integer score, label "Recovery" beneath.
- Colour-coded background: red (score < 40), amber (40–60), green (> 60).
- When `score` is null: render a neutral grey badge with "—".

**Card styling:**
- Match the existing soreness-screen card pattern (`infoCard` / `warningCard` styles in `soreness.tsx`): rounded 12px corners, `paddingVertical: 14`, `paddingHorizontal: 16`, themed background.
- Card width fills the parent.

**Accessibility:**
- `accessible={true}`
- `accessibilityLabel`: `"Recovery score 72 of 100. HRV 4 percent above baseline. Slept 7 hours 30 minutes. 18 percent deep sleep."`
- Avoid emojis (per project conventions).

### 2. `HrvTrendChart` component

**File:** `apps/parakeet/src/modules/wearable/ui/HrvTrendChart.tsx`

- Fetches the last 7 days of `hrv_rmssd` readings — one per day, "best per day" (highest), matching the baseline service convention. Source via a small RQ hook reading from `biometric.repository.fetchReadingsForBaseline(userId, 'hrv_rmssd', 7)`. Define `hrvTrendOptions` in `data/biometric.queries.ts` alongside the recovery queries.
- Renders an SVG sparkline using `react-native-svg` (already a transitive dep via Expo — verify with `npm ls react-native-svg` before building; if absent, add to `apps/parakeet/package.json`).
- Plots the per-day series with a thin solid line.
- Today's data point: enlarged dot in the theme accent colour.
- Baseline (mean of all points): thin dashed horizontal line at the mean y-value.
- Height: 40px. Width: fills card.
- If fewer than 3 daily points exist: render a placeholder `<Text>` "Building baseline..." instead of the chart.
- No axes, no labels — minimalist sparkline.

```typescript
import Svg, { Polyline, Line, Circle } from 'react-native-svg';

interface Props {}

export function HrvTrendChart() {
  // const { data: readings } = useHrvTrend();   // last 7 days, ordered ascending
  // if ((readings?.length ?? 0) < 3) return <Text>Building baseline...</Text>;
  // ... compute polyline points + baseline ...
}
```

**Hook:** `apps/parakeet/src/modules/wearable/hooks/useHrvTrend.ts`

```typescript
import { useQuery, queryOptions } from '@tanstack/react-query';

import { useAuth } from '@modules/auth';
import { fetchReadingsForBaseline } from '../data/biometric.repository';

export function useHrvTrend() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wearable', 'hrv-trend', user?.id],
    queryFn: () => fetchReadingsForBaseline(user!.id, 'hrv_rmssd', 7),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
  });
}
```

(For consistency, define the `queryOptions` factory in `data/biometric.queries.ts` and consume from the hook — matches the recovery queries pattern from spec-pipeline §8.)

### 3. `SleepSummary` component

**File:** `apps/parakeet/src/modules/wearable/ui/SleepSummary.tsx`

```typescript
interface Props {
  durationMin: number | null;
  deepPct: number | null;
  remPct: number | null;
}

export function SleepSummary({ durationMin, deepPct, remPct }: Props) {
  if (durationMin === null && deepPct === null && remPct === null) return null;
  // Inline horizontal row:
  //   "7h 23m"        in colors.text
  //   "18% deep"      in red if deepPct < 15, else colors.textSecondary
  //   "22% REM"       in colors.textTertiary
}

function formatHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}
```

- Layout: `flexDirection: 'row'`, `gap: 12`, `flexWrap: 'wrap'`.
- Returns `null` when all three are null.

### 4. Conditional rendering on `soreness.tsx`

**File:** `apps/parakeet/src/app/(tabs)/session/soreness.tsx`

- Import `RecoveryCard` and `useRecoverySnapshot` from `@modules/wearable`.
- After the muscle ratings + legend, before the cycle chip, render:

```tsx
const { data: snapshot } = useRecoverySnapshot();
const hasWearable = Boolean(snapshot);

// later in JSX:
{hasWearable ? (
  <RecoveryCard />
) : (
  <View style={styles.readinessSection}>
    <ReadinessPillRow ... sleep ... />
    <ReadinessPillRow ... energy ... />
  </View>
)}
```

- When `hasWearable === true`, the screen passes `undefined` for both `sleepQuality` and `energyLevel` to `runJITForSession`:

```tsx
runJITForSession(
  session,
  user.id,
  ratingsToUse,
  hasWearable ? undefined : sleepQuality,
  hasWearable ? undefined : energyLevel,
  cyclePhase ?? undefined
);
```

- `recordSorenessCheckin` continues to receive whatever `sleepQuality`/`energyLevel` state holds (default 2). Acceptable to log the default; if future analytics want to distinguish "user had wearable" vs "user picked default", store an additional flag — out of scope for this spec.

- No animated transition. The screen renders the card OR the pickers based on data presence.

**Hook ordering:** `useRecoverySnapshot()` must be called BEFORE any conditional return in the screen (per `feedback_hooks_before_early_return.md`). Place it alongside the existing `useState` / `useEffect` block at the top of the function body.

### 5. Pre-mount sync nudge (optional but recommended)

When the soreness screen mounts and `useWearableStatus().lastSyncAt` is older than 30 minutes, fire `syncWearableData(user.id)` opportunistically (no spinner — fire-and-forget with `try/catch + captureException`). Reduces the "stale snapshot" risk from spec-pipeline §Risks.

```tsx
useEffect(() => {
  const last = wearableStatus.lastSyncAt;
  if (!last || Date.now() - last > 30 * 60 * 1000) {
    void syncWearableData(user.id).catch(captureException);
  }
}, []);
```

Acceptable to skip if scope-bound; defer to a follow-up if needed.

### 6. Settings tab status row

**File:** `apps/parakeet/src/app/(tabs)/settings.tsx`

Add a row in the existing settings list. Placement: alongside other navigation rows (e.g. after "Volume & Recovery"). Use the existing `Row` component pattern.

```tsx
const { isAvailable, isPermitted, lastSyncAt } = useWearableStatus();

const subtitle =
  !isAvailable    ? 'Not available on this device'
  : !isPermitted  ? 'Tap to connect'
  : lastSyncAt    ? `Last sync ${formatRelativeTime(lastSyncAt)}`
  : 'Connected';

const dotColor =
  !isAvailable   ? colors.textTertiary    // gray
  : !isPermitted ? colors.warning         // amber
  :                colors.success;        // green

<Row
  label="Wearable"
  right={<View style={[styles.statusDot, { backgroundColor: dotColor }]} />}
  onPress={() => router.push('/settings/wearable')}
  styles={styles}
/>
{/* place subtitle inside Row's children if Row supports it; otherwise add a custom row */}
```

If `Row` doesn't accept a subtitle slot, add a small wrapper in this file rather than extending the shared `Row` API — Phase 3 should not refactor the settings primitives.

### 7. Module exports

**File:** `apps/parakeet/src/modules/wearable/index.ts`

Add to the public API:

```typescript
export { RecoveryCard } from './ui/RecoveryCard';
export { HrvTrendChart } from './ui/HrvTrendChart';
export { SleepSummary } from './ui/SleepSummary';
```

`WearableSettings` is already exported from Phase 1.

### 8. (Stretch) History tab recovery trend

**File:** `apps/parakeet/src/modules/history/ui/RecoveryTrend.tsx`

- 30-day readiness score line, sourced via `fetchSnapshotsForRange(userId, startDate, endDate)`.
- Overlay session markers (small dots on dates with completed sessions).

**Defer.** File a follow-up backlog item if not implemented in Phase 3 — do not block the phase on this.

## Validation

- Manual: with `recovery_snapshots` row for today → card renders, sleep/energy pickers hidden.
- Manual: without snapshot → pickers render, card absent.
- Manual: snapshot with all-null physiological fields → card renders with neutral score badge, no concern note, sleep summary returns null (component renders nothing).
- Manual: HRV -18% → concern note "HRV 18% below baseline — session will be adjusted".
- Manual: tap settings tab → wearable row visible with correct dot colour and subtitle.
- Manual: tap row → navigates to `/settings/wearable`.
- Accessibility: VoiceOver/TalkBack reads the recovery card label correctly (test on physical device).
- Type-check: `npx tsc -p apps/parakeet --noEmit` clean.

## Out of Scope

- Snapshot computation — Phase 1.
- Engine adjuster — Phase 2.
- Intra-session HR — Phase 4.
- Per-muscle recovery card — out of scope (wearables don't measure per-muscle state).

## Dependencies

- Upstream: pipeline, readiness-adjuster, biometric-data.
- Downstream: none.

## Domain References

- [domain/athlete-signals.md](../../domain/athlete-signals.md)
