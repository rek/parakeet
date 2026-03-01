# Spec: Unprogrammed Event Flow

**Status**: Implemented
**Domain**: Disruptions

## What This Covers

Extra form behaviour when the user selects "Unplanned Event" as the disruption type — event name capture, post-event soreness selection, and injecting that soreness into the JIT pipeline so future sessions auto-adjust without needing an explicit weight adjustment.

## Why different from other disruption types

Standard disruptions (injury, illness, etc.) adjust session weights directly. An unprogrammed event (Hyrox, team sport, 5k race) doesn't reduce capacity permanently — it leaves the user with acute soreness that fades in 1–3 days. The right treatment is to inject soreness check-in data so JIT picks it up naturally, not to hard-code a % weight reduction.

## Data layer (`lib/disruptions.ts`)

`applyUnprogrammedEventSoreness(userId, soreness)` — new function:

- [x] Takes `userId` and `soreness: Record<MuscleGroup, SorenessLevel>` (only groups with level > 'none')
- [x] Inserts one row per muscle group into `soreness_checkins`: `{ user_id, muscle_group, level, checkin_date: today, session_id: null }`
- [x] `session_id: null` means it is a standalone check-in, not tied to a session — JIT already queries latest soreness regardless of session_id

`SorenessLevel` = `'none' | 'mild' | 'sore' | 'very_sore'` (matches existing soreness_checkins schema)

`MuscleGroup` = `'quads' | 'hamstrings' | 'glutes' | 'lower_back' | 'upper_back' | 'chest'`

## Form UI (`apps/parakeet/src/app/disruption-report/report.tsx`)

When `selectedType === 'unprogrammed_event'`:

- [x] Show an "Event name" text input above the description field (its value is prepended to description: `"${eventName}: ${description}"`)
- [x] Severity selector is hidden; severity is fixed at `'major'` automatically (full deload treatment for affected sessions via `suggestDisruptionAdjustment`)
- [x] Show a "Post-event soreness" section below the lift selector:
  - Six muscle group rows: Quads / Hamstrings / Glutes / Lower Back / Upper Back / Chest
  - Each row has four tap-to-select severity chips: None / Mild / Sore / Very Sore (default: None)
- [x] `handleSubmit` extended: after `reportDisruption()` resolves, call `applyUnprogrammedEventSoreness(userId, sorenessMap)` if any soreness > 'none'

## Engine

- [x] `suggestDisruptionAdjustment` for `unprogrammed_event` returns `[]` — leave as-is. The soreness injection IS the adjustment. JIT will automatically scale affected sessions based on the injected soreness check-in.

## State additions (report.tsx)

```typescript
const [eventName, setEventName] = useState('')
const [eventSoreness, setEventSoreness] = useState<Record<string, SorenessLevel>>({})
```

## Review screen

- [x] If `suggestions.length === 0` and type is `unprogrammed_event`: show "Soreness logged — upcoming sessions will auto-adjust" instead of the generic no-adjustments message

## Dependencies

- [disruptions-001-report.md](./disruptions-001-report.md)
- soreness_checkins table (already exists from mobile-011 soreness check-in spec)
