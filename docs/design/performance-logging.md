# Feature: Performance Logging

**Status**: Planned

**Date**: 2026-02-22

## Overview

Performance Logging lets users record their actual workout results — weights lifted, reps completed, and perceived effort (RPE) — directly within the context of their planned session. The logged data drives program adaptation suggestions and long-term progress tracking.

## Problem Statement

Paper training logs and generic note apps are disconnected from the planned program. Users can't easily see how they performed against the plan, and without structured data, there is no basis for intelligent program adjustments over time.

**Pain points:**
- Writing notes in a generic app doesn't capture the plan vs. actual comparison
- Users forget what they lifted last week, making progressive overload guesswork
- No structured RPE tracking means the system can't detect when loading is too high or too low
- Completed sessions are siloed from future program planning

**Desired outcome:** A friction-free logging experience that captures what matters (weight, reps, RPE) without interrupting the flow of a workout, and makes that data immediately useful for tracking and adaptation.

## User Experience

### User Flows

**Primary Flow (logging a session):**

1. User opens the app and sees "Today" screen with the session card for the current day
2. User taps "Start Workout"
3. App shows the session screen: lift name, intensity type, and all planned sets pre-filled with target weight, reps, and RPE
4. User completes set 1 → taps the checkmark on the set row
5. If weight or reps differed from plan, user edits the values inline (tap to edit, numeric keyboard)
6. User optionally sets RPE via a slider (6.0 to 10.0, increments of 0.5)
7. User repeats for all sets
8. User taps "Complete Workout"
9. App shows a completion summary: planned vs. actual volume, session RPE, any performance flags
10. App navigates back to Today screen (next session shown)

**Alternative Flows:**

- User starts logging mid-session (forgot to tap Start): user can still log all sets and submit; `started_at` defaults to the first set entry time
- User dropped the weight mid-session: simply edit the weight field on the affected set before checking it off
- User did more reps than planned (e.g., did 8 instead of 5 on a rep day): enter actual reps; the system notes this as over-performance
- User skips a session: tap "Skip" with an optional reason; session is marked skipped and the next planned session surfaces on Tomorrow

### Visual Design Notes

- Set rows: each row shows set number, planned weight (grey), actual weight input (black/white), planned reps, actual reps input, RPE selector
- Completion state: checked sets turn green with a subtle strikethrough on planned values
- RPE selector: horizontal slider with half-point increments, shows label ("Easy", "Hard", "Max effort") at key values
- Session summary card: large planned vs. actual volume bars (visual), completion percentage badge, note field for free text
- Active edge case banner (if any): amber banner at top of session screen ("Knee issue active — Squat weight auto-reduced 20%")

## User Benefits

**In-context logging**: Planned weights are pre-filled; the user only needs to record what changed, not transcribe the entire plan.

**Immediate feedback**: The completion summary shows performance vs. plan at a glance — no mental math required.

**Foundation for adaptation**: Every logged session contributes to the performance data the system uses to suggest formula adjustments, making the program smarter over time.

**Searchable history**: All past sessions are accessible in the History tab, filterable by lift and date, with planned vs. actual shown for each.

## Implementation Status

### Planned

- Pre-filled set rows from planned session data
- Inline weight and rep editing per set
- RPE slider per set (optional) and per session (summary)
- Session start/end timestamp capture
- Planned vs. actual volume computation on completion
- Session skip with reason
- History view with lift and date filters

## Future Enhancements

**Phase 2:**
- Rest timer between sets (configurable per intensity type)
- Barbell plate calculator overlay (shows which plates to load for a given weight)

**Long-term:**
- Video form logging (attach a clip to a set)
- Velocity tracking integration (via barbell velocity trackers)
- Correlation overlay on history view (e.g., show sleep score for that day alongside performance)

## Open Questions

- [ ] Should RPE be required or optional per set? (Current plan: optional per set, optional summary RPE)
- [ ] How many days back can a user backfill a missed session log?

## References

- Related Design Docs: [program-generation.md](./program-generation.md), [disruption-management.md](./disruption-management.md)
