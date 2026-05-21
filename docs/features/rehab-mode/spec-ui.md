# Spec: Rehab Mode UI

**Status**: Planned
**Domain**: parakeet App

## What This Covers

User-facing surfaces: settings management screen for enabling/editing/disabling caps, the Today screen chip + bottom-sheet modal, the in-session pain-limited RPE toggle, and the "capped by Rehab Mode" footnote on the working-weight display.

## Tasks

**Settings management: `apps/parakeet/app/settings/rehab-mode.tsx`**

- [ ] Route added to Settings tab.
- [ ] Lists the three main lifts (Squat, Bench, Deadlift). For each:
  - If active cap: shows cap kg, optional note, "Started DD MMM YYYY", planned end date (if any), "Edit" and "End" actions
  - If no active cap: shows "Enable Rehab Mode" button
- [ ] Enable flow: opens `EnableRehabCapForm` (modal or pushed screen):
  - Cap weight input (numeric, kg suffix). Default value = `round(currentOneRm * 0.5, 2.5)` from the lifter's stored 1RM.
  - Note input (multiline, optional)
  - Planned end date input (date picker with "None" toggle)
  - Submit calls `useRehabModeMutations().enable`. Error toast if unique-constraint error fires.
- [ ] Edit flow: same form pre-filled. Submit calls `update`.
- [ ] End flow: confirm Alert ("End Rehab Mode for {lift}? Future sessions will resume normal weights."), then `useRehabModeMutations().end`.
- [ ] Link to Settings → Training section so the screen is reachable from the existing settings navigation.

**Today chip row: `apps/parakeet/src/modules/rehab-mode/ui/RehabCapChipsRow.tsx`**

- [ ] Horizontal scrollable row of chips, one per active cap (mirrors `DisruptionChipsRow`).
- [ ] Chip: `🩹 {Lift} — Rehab` with slate-blue border + dot.
- [ ] Tap → opens `RehabCapBottomSheet` showing the cap, note, planned end date, "Edit" and "End Rehab Mode" actions.
- [ ] Reads from `useActiveRehabCaps(userId)`.
- [ ] Rendered in `today.tsx` next to the disruption chip row (above the WorkoutCard, same vertical band).

**Bottom sheet: `apps/parakeet/src/modules/rehab-mode/ui/RehabCapBottomSheet.tsx`**

- [ ] Same modal pattern as the disruption bottom sheet (`DisruptionDetailSheet`).
- [ ] Shows lift, cap kg, note (if any), started date, planned end date.
- [ ] "Edit cap" action → navigates to `/settings/rehab-mode` pre-scrolled to that lift.
- [ ] "End Rehab Mode" destructive action with confirmation Alert.

**In-session RPE pain-limited toggle: `apps/parakeet/src/modules/session/ui/RpePicker.tsx`** (or wherever the picker lives)

- [ ] When `useRehabCapForLift(userId, session.primary_lift)` returns a cap, render a small `🩹 Pain-limited` pill below the 6–10 row.
- [ ] State: per-set local boolean, default `false`. Tap toggles. Default-to-on heuristic: if the previous set in this session was tagged pain-limited, default this one to on too (saves taps in the common case).
- [ ] On set submit, pass `pain_limited: boolean` through to the set-log mutation.
- [ ] When no rehab cap is active for the current lift, the pill is not rendered at all (zero visual weight for the 99% case).

**Working-weight footnote: `apps/parakeet/src/modules/session/ui/MainSetCard.tsx`** (or equivalent)

- [ ] When `JITOutput.cappedByRehab === true`, render a subtle footnote line below the weight: "Capped by Rehab Mode ({capKg} kg)".
- [ ] Style: small text, secondary color. Not alarming — informational.

**Today-screen footer text** (optional polish)

- [ ] If the day's session is for a lift with an active rehab cap, the WorkoutCard subtitle reads "Rehab Mode — capped at {capKg} kg" instead of the normal subtitle. Tap → opens the bottom sheet.

**Visual/UX details**

- [ ] Bandage emoji `🩹` is the rehab-mode marker across all surfaces (chip, RPE pill, footnote). Consistent visual signature.
- [ ] Color: slate-blue (neither alarming red nor cheerful green) — communicates "deliberate, ongoing" rather than "warning" or "good".
- [ ] All text via `tokens.typography` and `colors.*` per theme (no raw hex; see [code-style.md](../../guide/code-style.md)).
- [ ] Accessibility: chip and pill both have descriptive `accessibilityLabel`s ("Squat is in Rehab Mode, capped at 80 kilograms").

**Smoke tests (Maestro or per-screen RNTL)**

- [ ] Enable cap → chip appears on Today screen → start squat session → working weight is capped → RPE picker shows pain-limited pill → tap pill → submit set → set log has `pain_limited: true` and `during_rehab: true`
- [ ] End cap → chip disappears → next squat session prescribed without cap → RPE pill no longer renders

## Dependencies

- [spec-data.md](./spec-data.md) — DB writes
- [spec-app.md](./spec-app.md) — service, hooks, JIT input wiring
- [spec-engine.md](./spec-engine.md) — `cappedByRehab` flag in `JITOutput`
- [features/disruptions/spec-screen.md](../disruptions/spec-screen.md) — chip + bottom sheet patterns to mirror
- [guide/code-style.md](../../guide/code-style.md) — theme, typography conventions

## Domain References

- [domain/athlete-signals.md](../../domain/athlete-signals.md) — RPE signal (pain-limited toggle is a new dimension)
