# Spec: Unprogrammed Event Flow

**Status**: Implemented
**Domain**: Disruptions

## What This Covers

Extra form behaviour when the user selects "Unplanned Event" as the disruption type — event name capture, post-event soreness selection, and injecting that soreness into the JIT pipeline so future sessions auto-adjust without needing an explicit weight adjustment.

## Why different from other disruption types

Standard disruptions (injury, illness, etc.) adjust session weights directly. An unprogrammed event (Hyrox, team sport, 5k race) doesn't reduce capacity permanently — it leaves the user with acute soreness that fades in 1–3 days. The right treatment is to inject soreness check-in data so JIT picks it up naturally, not to hard-code a % weight reduction.

## Data layer (`lib/disruptions.ts`)

`applyUnprogrammedEventSoreness(userId, soreness)` — inserts a standalone soreness check-in:

- Takes `userId` and `soreness: Record<MuscleGroup, number>` where values are numeric `1–4` (only groups with level > 1)
- Inserts **one JSONB row** into `soreness_checkins`:
  `{ user_id, ratings: { [muscle]: numericLevel }, session_id: null, skipped: false, recorded_at: now() }`
- `session_id: null` — standalone check-in, not tied to a session (migration `20260309000000` made `session_id` nullable)

UI chips map to numeric soreness levels before storage:

| Chip      | Stored value |
|-----------|--------------|
| None      | 1            |
| Mild      | 2            |
| Sore      | 3            |
| Very Sore | 4            |

`MuscleGroup` = `'quads' | 'hamstrings' | 'glutes' | 'lower_back' | 'upper_back' | 'chest'`

## Form UI (`apps/parakeet/src/app/disruption-report/report.tsx`)

When `selectedType === 'unprogrammed_event'`:

- [x] Show an "Event name" text input above the description field (its value is prepended to description: `"${eventName}: ${description}"`)
- [x] Severity selector is hidden; severity is fixed at `'major'` automatically (full deload treatment for affected sessions via `suggestDisruptionAdjustment`)
- [x] Show a "Post-event soreness" section below the lift selector:
  - Six muscle group rows: Quads / Hamstrings / Glutes / Lower Back / Upper Back / Chest
  - Each row has four tap-to-select severity chips: None / Mild / Sore / Very Sore (default: None)
- [x] `handleSubmit`: after `reportDisruption()` resolves, maps chip strings → numeric via `SORENESS_NUMERIC`, then calls `applyUnprogrammedEventSoreness(userId, numericSoreness)`

## Engine

- [x] `suggestDisruptionAdjustment` for `unprogrammed_event` returns `[]` — leave as-is. The soreness injection IS the adjustment. JIT automatically scales affected sessions based on the injected soreness check-in.
- JIT receives `sorenessRatings: Partial<Record<MuscleGroup, SorenessLevel>>` (where `SorenessLevel = 1 | 2 | 3 | 4 | 5`) as part of `JITInput`

## How soreness feeds into JIT

`soreness.tsx` queries the most recent `soreness_checkins` row for the user (`ORDER BY recorded_at DESC LIMIT 1`, regardless of `session_id`) and pre-populates its muscle rating pills with those values. Soreness injected by an unprogrammed event becomes the starting point the user sees before their next workout — they can adjust and confirm before JIT runs.

Implemented via `getLatestSorenessCheckin(userId)` (`data/session.repository.ts` → `services/session.service.ts` → `lib/sessions.ts`), called in parallel with `getSession` in `soreness.tsx`'s bootstrap effect.

## State additions (report.tsx)

```typescript
const [eventName, setEventName] = useState('')
const [eventSoreness, setEventSoreness] = useState<Record<string, SorenessLevel>>({})
```

`eventSoreness` holds the string chip values (`'none' | 'mild' | 'sore' | 'very_sore'`); these are mapped to numeric via `SORENESS_NUMERIC` at submit time.

## Review screen

- [x] If `suggestions.length === 0` and type is `unprogrammed_event`: show "Soreness logged — upcoming sessions will auto-adjust" instead of the generic no-adjustments message

## Dependencies

- [disruptions-001-report.md](./disruptions-001-report.md)
- soreness_checkins table (already exists from mobile-011 soreness check-in spec)
- Migration `20260309000000_nullable_soreness_session_id.sql`
