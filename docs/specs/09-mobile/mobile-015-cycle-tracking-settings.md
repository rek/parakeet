# Spec: Cycle Tracking Settings Screen

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Settings screen for managing menstrual cycle tracking. Only shown for users with `biological_sex = 'female'` (or who explicitly navigate here). Allows enabling/disabling the feature, setting cycle length, and logging the last period start date.

Also covers the optional prompt shown at the end of onboarding for female users.

## Tasks

### Settings Screen

**`apps/parakeet/src/app/settings/cycle-tracking.tsx`:**

- **Header**: "Cycle Tracking" + back button
- **Toggle row**: "Track menstrual cycle" — on/off switch
  - When off: all sub-fields are grayed out / non-interactive
  - When turned on for the first time: auto-prompts for last period start date
- **Cycle length**: stepper (24–35 days, default 28). Label: "Avg cycle length: {N} days"
- **Last period start**: date picker row — "Last period started: {date}" with "Update" link
  - On tap: show `DateTimePicker` (iOS inline or Android modal)
  - After update: saves + triggers invalidation of `['cycle', 'phase']` query
- **Current phase display** (when enabled + period date set):
  - Shows: "Currently: {Phase} · Day {N}"
  - Phase names: Menstrual / Follicular / Ovulatory / Luteal / Late Luteal
  - Subtle color coding: ovulatory = amber background (awareness only)
- **Phase calendar** (when enabled): 28-row or cycle-length-row visual showing upcoming phases by day number
  - Simple: colored dots/bars for each phase span
  - "Next period expected: {date}" at bottom

**Save behavior:** auto-save on each field change (no explicit Save button needed — each toggle/picker triggers `updateCycleConfig()` immediately).

### Settings Route

**`apps/parakeet/src/app/(tabs)/settings.tsx`:** add under Advanced section:
```
Row label: "Cycle Tracking"  →  /settings/cycle-tracking
Only rendered if user.biological_sex === 'female'
```

**`apps/parakeet/src/app/settings/_layout.tsx`:** already exists as Stack — no changes needed.

### Onboarding Prompt (Optional)

**`apps/parakeet/src/app/(auth)/onboarding/program-settings.tsx`:**

After the birth year field, if `biologicalSex === 'female'`, show an optional prompt:
```
"Would you like to track your menstrual cycle?
This helps us understand your training patterns — no symptoms required.
You can enable it later in Settings."

[Enable Cycle Tracking]  toggle or checkbox, default OFF
```

If enabled: show cycle length stepper + last period date picker inline (same fields as settings screen, just smaller). These values are saved via `updateCycleConfig()` during `handleGenerate()`.

If the user skips: no data saved for cycle tracking; can be enabled later via Settings.

## Dependencies

- [data-005-cycle-tracking.md](../05-data/data-005-cycle-tracking.md)
- [engine-014-cycle-phase-calculator.md](../04-engine/engine-014-cycle-phase-calculator.md)
- [data-004-athlete-profile.md](../05-data/data-004-athlete-profile.md) — `biological_sex` gates visibility
