# Spec: Rest Timer Settings Screen

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Settings → Training → Rest Timer. Lets users override formula rest defaults per intensity type and configure timer alerts.

## Tasks

### Screen

**`apps/parakeet/app/settings/rest-timer.tsx`:**

Layout:
```
Settings › Training › Rest Timer

Rest Durations
──────────────────────────────────────
Heavy sets      [3 min 00 s]  ← picker
Explosive sets  [2 min 30 s]
Rep sets        [2 min 00 s]
Deload sets     [1 min 30 s]
                         [Reset to defaults]

Auxiliary
──────────────────────────────────────
Auxiliary sets  [1 min 30 s]

Alerts
──────────────────────────────────────
Audio alert at 0:00        [●] On
Haptic alert at 0:00       [●] On
AI rest suggestions        [●] On
  (requires AI workout generation)
```

**Duration picker:** Tap any row → inline scroll picker (minutes 0–9, seconds 0/15/30/45). Minimum 30s, maximum 10 min. Value shown as "M min SS s" or "M min" if seconds = 0.

**Granularity:** Overrides apply to all lifts uniformly (no per-lift overrides in v1). The `rest_configs` table supports per-lift rows, but the UI only writes `lift = NULL` rows for now.

**"Reset to defaults":** Calls `resetRestOverrides(userId)` → clears all rows for this user → formula defaults resume on next JIT run.

**Alerts toggles:** Persisted to Async Storage (not Supabase — device-local preference):
```typescript
// apps/parakeet/src/lib/settings.ts
const REST_TIMER_PREFS_KEY = 'rest_timer_prefs'

interface RestTimerPrefs {
  audioAlert: boolean      // default true
  hapticAlert: boolean     // default true
  llmSuggestions: boolean  // default true
}
```

`RestTimer` component reads these prefs via a `useRestTimerPrefs()` hook before rendering.

---

### Navigation

Add route to `apps/parakeet/app/settings/_layout.tsx`:
- Entry: `Settings → Training → Rest Timer`
- `Settings` screen already has a Training section — add "Rest Timer" row there

---

### Live Preview

Below the duration inputs, a small preview card shows what the timer would look like for the user's current squat Block 2 Heavy session:

```
Preview — Block 2 · Heavy Squat
"Rest timer will start at  3:30  after each set"
```

Updates live as the user changes the inputs. Reads `user.currentProgram.blockNumber` + `intensityType` to pick the relevant row. Falls back to "Heavy sets" if program state is unavailable.

## Dependencies

- [data-006-rest-config.md](../05-data/data-006-rest-config.md) — `setRestOverride`, `resetRestOverrides`
- [mobile-017-rest-timer.md](./mobile-017-rest-timer.md) — reads prefs at render time
