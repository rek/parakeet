# mobile-033: Feature Flags

**Status**: Implemented

**Design**: [feature-flags.md](../../design/feature-flags.md)

## Overview

Device-local feature toggle system backed by AsyncStorage. Users can enable/disable optional app features to control complexity.

## Module

`apps/parakeet/src/modules/feature-flags/`

### Files

- `model/features.ts` — Feature registry (`FEATURE_REGISTRY`), categories, default flags, presets (`SIMPLE_PRESET`, `FULL_PRESET`)
- `lib/feature-flags.ts` — AsyncStorage persistence (`getFeatureFlags`, `setFeatureFlag`, `setFeatureFlags`)
- `hooks/useFeatureFlags.ts` — `useFeatureFlags()` (all flags + toggle/preset), `useFeatureEnabled(id)` (single boolean)
- `index.ts` — Public API

### Feature IDs

| ID | Category | Default |
|----|----------|---------|
| `warmups` | training | on |
| `auxiliary` | training | on |
| `restTimer` | training | on |
| `sorenessCheckin` | training | on |
| `adHocWorkouts` | training | on |
| `volumeDashboard` | analytics | on |
| `achievements` | analytics | on |
| `streaks` | analytics | on |
| `aiJit` | ai | on |
| `aiRest` | ai | on |
| `motivationalMessages` | ai | on |
| `formulaSuggestions` | ai | on |
| `disruptions` | health | on |
| `cycleTracking` | health | on |
| `wilks` | advanced | off |
| `developer` | advanced | off |

### Presets

- **Simple**: Only `training` category features enabled
- **Full**: All features enabled
- Applying a preset overwrites all flags; user can customize after

## Screen

`apps/parakeet/src/app/settings/features.tsx`

- Back button + "Features" title + subtitle
- Preset pills at top (Simple / Full / Custom indicator)
- Toggle switches grouped by category
- Changes take effect immediately via React Query optimistic update

## Integration Points

### Settings screen (`settings.tsx`)

- "Features" row in Advanced section links to `/settings/features`
- Achievements section gated on `achievements` / `wilks`
- Volume & Recovery row gated on `volumeDashboard`
- Auxiliary, Warmup, Rest Timer, Volume Config rows gated on respective flags
- Cycle Tracking gated on `cycleTracking` (in addition to existing `biological_sex` check)
- Developer row gated on `developer`
- Formula suggestion dot gated on `formulaSuggestions`

### Today screen (`today.tsx`)

- StreakPill gated on `streaks`
- Cycle phase pill gated on `cycleTracking`
- MRV warning banner gated on `volumeDashboard`
- Disruption chips gated on `disruptions`
- Ovulatory chip gated on `cycleTracking`
- Ad-Hoc Workout button gated on `adHocWorkouts`
- Log a Disruption button gated on `disruptions`
- VolumeCompactCard gated on `volumeDashboard`
- Motivational message query `enabled` gated on `motivationalMessages`

## Storage

- Key: `feature_flags`
- Format: JSON object `Record<FeatureId, boolean>`
- Missing keys fall back to `DEFAULT_FLAGS`
- Query key: `qk.featureFlags.all()`
