# Feature: Change Training Days

**Status**: Draft
**Date**: 16 Mar 2026

## Overview

Let users change which days of the week they train without creating a new program. Currently training days can only be set during onboarding/program creation. Life happens — work schedules change, gyms adjust hours, partners shift routines — and users shouldn't need to abandon a program to move from Mon/Wed/Fri to Tue/Thu/Sat.

## Problem Statement

**Pain points:**
- Training days are locked at program creation. The only way to change them is to end the current program and start a new one, losing progress context.
- A user whose gym closes on Wednesdays starting next month has no recourse within the app.
- The system already stores per-program training days and all date-computation functions accept arbitrary day arrays — the constraint is purely a missing UI.

**Desired outcome:** Users open Settings, pick new weekdays, and their upcoming sessions shift to match. Completed sessions are unaffected.

## User Experience

### User Flows

**Primary Flow — Change days (any program mode):**

1. User navigates to Settings › Training Days
2. Screen shows the current training days as selectable weekday pills (Mon–Sun), with active days highlighted
3. User taps to toggle days on/off
4. Day count must match the program's `training_days_per_week` — toggling a day on automatically deselects another (or: user must deselect one first). The total count is fixed.
5. User taps "Save"
6. **Scheduled programs:** A confirmation prompt explains that upcoming session dates will shift. On confirm, all future `planned` sessions get new dates. In-progress and completed sessions are untouched.
7. **Unending programs:** Change applies immediately with no confirmation needed — the next lazily-generated session will land on the new day.

**Alternative Flows:**
- If no program is active, the setting is hidden or disabled with an explanation.
- If the user picks the same days they already have, the save button is disabled.

### Visual Design Notes

- **Weekday pills:** Row of 7 pills (Mon–Sun), same style as existing readiness pills. Active days use the primary color fill; inactive are outlined.
- **Placement:** Settings › Training section, below "Bar Weight" and above "Manage Formulas".
- **Confirmation (scheduled only):** A bottom sheet showing "This will update dates for N upcoming sessions. Completed sessions won't change." with Cancel / Update buttons.

## What Already Works

- `programs.training_days` column exists (SMALLINT array, weekday indices 0=Sun..6=Sat)
- `calculateSessionDate()` accepts arbitrary day offsets — no engine changes needed
- `nextTrainingDate()` already reads `training_days` dynamically for unending programs
- `computeDayOffsets()` converts weekday indices to session offsets
- Onboarding review screen already has weekday selection UI that can be reused

## What We Chose NOT To Do

- **No changing the number of training days.** That changes the lift rotation, block structure, and session count — it's a fundamentally different program. Users should create a new program for that.
- **No retroactive date changes.** Completed and in-progress sessions keep their original dates. Only `planned` sessions shift.
- **No per-week overrides.** This is a program-level setting, not "skip Wednesday this week." One-off schedule changes are handled by the existing skip/reschedule flow.

## Scheduled vs Unending Behavior

| Aspect | Scheduled | Unending |
|--------|-----------|----------|
| Session rows exist? | Yes — all pre-generated | Only the next one |
| Date update needed? | Yes — recompute `planned_date` for all future `planned` sessions | No — `nextTrainingDate()` reads the new days at generation time |
| Confirmation prompt? | Yes — user should know dates are shifting | No — change is invisible until next session |
| Complexity | Medium — bulk update with date recalculation | Low — column update only |

## Blast Radius (~5 files)

This is a small feature. The engine and date-computation layer require no changes.

| Layer | Files | Change |
|-------|-------|--------|
| Settings UI | `app/settings/training-days.tsx` (new) | Weekday picker screen |
| Settings hub | `app/(tabs)/settings.tsx` | Add "Training Days" row |
| Settings layout | `app/settings/_layout.tsx` | Add route |
| Program service | `modules/program/application/program.service.ts` | `updateTrainingDays()` — update column + recompute scheduled dates |
| Program repository | `modules/program/data/program.repository.ts` | `updateProgramTrainingDays()` — DB write |

## Spec Breakdown

| Spec ID | Title | Layer |
|---------|-------|-------|
| programs-006 | Update training days service | program module |
| mobile-042 | Training days settings screen | mobile |

## Open Questions

None — resolved during design review.

## Future Enhancements

- **Quick reschedule from Today screen:** "Not training today? Move to tomorrow" — single-session date override without changing the program pattern.
- **Changing training day count:** Would require program restructuring (add/remove sessions, adjust lift rotation). Separate feature.

## References

- Related specs: [engine-002](../specs/04-engine/engine-002-cube-method-scheduler.md), [programs-005](../specs/06-programs/programs-005-unending-program-mode.md)
- Related design: [four-day-ohp.md](./four-day-ohp.md) (shares training day concepts)
