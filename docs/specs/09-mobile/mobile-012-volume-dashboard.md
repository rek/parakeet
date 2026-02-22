# Spec: Volume Dashboard

**Status**: Planned
**Domain**: Mobile

## What This Covers

A visual display of weekly training volume per muscle group versus each muscle's MEV and MRV thresholds. Accessible from the Today tab and Settings. Helps the user understand their recovery state at a glance.

## Tasks

**Screen: `apps/mobile/app/(tabs)/today.tsx` (volume section)** — inline card at the bottom of the Today screen

**Full screen: `apps/mobile/app/volume.tsx`** — accessible by tapping the card or from Settings

**Data source:**
- `weeklyVolumeToDate` computed by calling `computeWeeklyVolume()` from `packages/training-engine` on current week's `session_logs`
- `mrvMevConfig` fetched via `getMrvMevConfig()` from `lib/volume-config.ts`
- `classifyVolumeStatus()` determines the bar color per muscle

**Compact view (Today screen card):**
```
  ┌──────────────────────────────────────┐
  │  Weekly Volume          [View All →] │
  │                                      │
  │  Quads     ████████░░░░  12/20 sets  │
  │  Chest     ██████░░░░░░   8/22 sets  │
  │  Hamstrings████████████  20/20 ⚠ MRV│
  └──────────────────────────────────────┘
```

**Full volume dashboard:**
- One bar per muscle group (all 9)
- Bar fills from 0 to MRV
- MEV marker line shown at MEV position
- Color coding:
  - Below MEV: orange (not enough stimulus yet)
  - In range: green
  - Approaching MRV (within 2 sets): yellow
  - At MRV: red
  - Exceeded MRV: red with ⚠ icon

**React Query hook:**
```typescript
// apps/mobile/hooks/useWeeklyVolume.ts
export function useWeeklyVolume() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['volume', 'weekly', userId, currentWeekStart()],
    queryFn: async () => {
      const [logs, config] = await Promise.all([
        getCurrentWeekLogs(userId),
        getMrvMevConfig(userId),
      ])
      const weekly = computeWeeklyVolume(logs, createMuscleMapper())
      const status = classifyVolumeStatus(weekly, config)
      const remaining = computeRemainingCapacity(weekly, config)
      return { weekly, status, remaining, config }
    },
    staleTime: 1000 * 60,  // refresh every minute during a workout
  })
}
```

**Volume warnings on Today screen:**
If any muscle is `at_mrv` or `exceeded_mrv`, show a banner above the session card:
"Your [quads] have reached their weekly MRV. Today's squat volume has been automatically reduced."

## Dependencies

- [engine-006-mrv-mev-calculator.md](../04-engine/engine-006-mrv-mev-calculator.md)
- [data-001-muscle-volume-config.md](../05-data/data-001-muscle-volume-config.md)
- [mobile-008-supabase-client-setup.md](./mobile-008-supabase-client-setup.md)
