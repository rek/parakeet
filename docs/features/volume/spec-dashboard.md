# Spec: Volume Dashboard

**Status**: Implemented
**Domain**: parakeet

## What This Covers

A visual display of weekly training volume per muscle group versus each muscle's MEV and MRV thresholds. Accessible from the Today tab and Settings. Helps the user understand their recovery state at a glance.

## Tasks

**Screen: `apps/parakeet/app/(tabs)/today.tsx` (volume section)** — inline card at the bottom of the Today screen

**Full screen: `apps/parakeet/app/volume.tsx`** — accessible by tapping the card or from Settings

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

**Full volume dashboard (`apps/parakeet/src/app/volume.tsx`):**
- One bar per muscle group (all 9)
- Bar fills from 0 to MRV (right edge = MRV)
- MEV marker: white tick at the MEV position — always visible over any fill color
- MRV marker: grey tick at the right end of the bar track
- Legend shows both MEV and MRV tick samples
- Right-side label: `{sets}` (bold) `/{mrv}` (muted) — e.g., "12/20"
- Subtitle: "Sets completed this week · numbers show sets / MRV target"
- Color coding:
  - Below MEV: teal/info (not enough stimulus yet)
  - In range: green
  - Approaching MRV (within 2 sets): amber/warning
  - At MRV: red
  - Exceeded MRV: red with ⚠ icon

**Set counting:**
- Weekly sets come from `set_logs` (one row per confirmed set, linked to a completed session via `session_id`). Post-durability-rollout (backlog #16, 2026-04-18) the JSONB `session_logs.actual_sets` is placeholder-only and not read.
- A `session_log` row only exists for completed sessions, so `set_logs` rows for those sessions are the authoritative weekly-volume input.
- Previous filter (`reps_completed > 0`) was removed as it under-counted when users didn't enter every rep.

**React Query hook:**
```typescript
// apps/parakeet/hooks/useWeeklyVolume.ts
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

- [engine-006-mrv-mev-calculator.md](./spec-mrv-mev.md)
- [data-001-muscle-volume-config.md](./spec-volume-config.md)
- [parakeet-008-supabase-client-setup.md](./parakeet-008-supabase-client-setup.md)
