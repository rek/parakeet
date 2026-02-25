# Feature: Performance Logging

**Status**: Planned

**Date**: 2026-02-22

## Overview

Performance Logging lets users record their actual workout results — weights lifted, reps completed, and perceived effort (RPE) — directly within the context of their planned session. The logged data drives program adaptation suggestions, 1RM estimation, and long-term progress tracking.

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
3. App shows the session screen: lift name, intensity type, and all planned sets pre-filled with target weight, reps, and RPE target
4. User completes set 1 → taps the checkmark on the set row
5. If weight or reps differed from plan, user edits the values inline (tap to edit, numeric keyboard)
6. User optionally sets RPE via a slider (6.0 to 10.0, increments of 0.5)
7. User repeats for all sets
8. User taps "Complete Workout"
9. App shows a completion summary: planned vs. actual volume, session RPE, any performance flags, and any stars earned (new PRs)
10. App navigates back to Today screen (next session shown)

**Alternative Flows:**

- User starts logging mid-session (forgot to tap Start): user can still log all sets and submit; `started_at` defaults to the first set entry time
- User dropped the weight mid-session: simply edit the weight field on the affected set before checking it off
- User did more reps than planned (e.g., did 8 instead of 5 on a rep day): enter actual reps; the system notes this as over-performance
- User skips a session: tap "Skip" with an optional reason; session is marked skipped and the next planned session surfaces

**RPE Policy:**

RPE is **optional per set** and optional at the session summary level. The system uses RPE data when available to improve 1RM estimates and detect loading trends, but never blocks progress if RPE is not entered. When RPE is not logged for a set, the set is still counted toward volume.

**No Backfill:**

Sessions can only be logged on the day they are scheduled (or makeup days within the same week — see program-generation). There is no mechanism to retroactively log a session for a past date.

**Why RPE Matters for Progressive Overload:**

RPE (Rate of Perceived Exertion) serves two distinct roles in progressive overload. First, it is an **autoregulatory signal** — if a lifter reports RPE 9.8 on a set prescribed at RPE 8.5, the actual load exceeds intended load, and intensity should decrease on the next session of that lift. Helms et al. (2016) and Zourdos et al. (2016) validated the RIR (Reps in Reserve)-based RPE scale as an accurate proxy for daily readiness that allows individualised load adjustment without daily max testing. Second, RPE enables **1RM estimation without singles testing** — the Epley formula converts any set's weight and reps into an estimated 1RM, scaled by RPE confidence. This is the foundation of Parakeet's automatic max tracking.

**RPE-Based 1RM Estimation:**

When a set is logged with a high RPE (≥ 8.5) and the system determines conditions are reliable (no active disruption, soreness ≤ 2, the day's total completed sets are within normal range), that set is used as a strong signal for 1RM estimation:

- Estimated 1RM = `weight × (1 + reps / 30)` (Epley formula), scaled by RPE confidence factor
- A set at RPE 10 with 1 rep = direct 1RM measurement (highest confidence)
- A set at RPE 8.5 with 5 reps = high-confidence estimate
- Multiple qualifying sets per session are averaged, weighted by confidence

This estimated 1RM is stored alongside the session log and used to pre-populate maxes when the user starts a new program cycle — eliminating the need to manually re-enter or remember their best lifts.

### Visual Design Notes

- Set rows: each row shows set number, planned weight (grey), actual weight input (black/white), planned reps, actual reps input, RPE selector
- Completion state: checked sets turn green with a subtle strikethrough on planned values
- RPE selector: horizontal slider with half-point increments, shows label ("Easy", "Hard", "Max effort") at key values
- Session summary card: large planned vs. actual volume bars (visual), completion percentage badge, note field for free text, stars earned for any new PRs
- Active edge case banner (if any): amber banner at top of session screen ("Knee issue active — Squat weight auto-reduced 20%")

## User Benefits

**In-context logging**: Planned weights are pre-filled; the user only needs to record what changed, not transcribe the entire plan.

**Immediate feedback**: The completion summary shows performance vs. plan at a glance — no mental math required.

**Foundation for adaptation**: Every logged session contributes to the performance data the system uses to suggest formula adjustments, making the program smarter over time.

**Automatic max tracking**: The system continuously estimates 1RM from logged sets. Users never need to remember or recalculate their maxes manually.

**Searchable history**: All past sessions are accessible in the History tab, filterable by lift and date, with planned vs. actual shown for each.

## Implementation Status

### Planned

- Pre-filled set rows from planned session data
- Inline weight and rep editing per set
- RPE slider per set (optional) and per session (summary, also optional)
- Session start/end timestamp capture
- Planned vs. actual volume computation on completion
- Session skip with reason
- RPE-based 1RM estimation per set (with confidence gating)
- History view with lift and date filters
- PR detection and star display at session completion (see [achievements.md](./achievements.md))

## Future Enhancements

**Phase 2:**
- Rest timer between sets → see [rest-timer.md](./rest-timer.md) for full design
- Barbell plate calculator overlay (shows which plates to load for a given weight)

**Long-term:**
- Video form logging (attach a clip to a set)
- Velocity tracking integration (via barbell velocity trackers)
- Correlation overlay on history view (e.g., show sleep score for that day alongside performance)

## References

- Related Design Docs: [program-generation.md](./program-generation.md), [disruption-management.md](./disruption-management.md), [achievements.md](./achievements.md)
- Helms, E.R. et al. (2016) — "Application of the Repetitions in Reserve-Based Rating of Perceived Exertion Scale for Resistance Training" *Strength Cond J*
- Zourdos, M.C. et al. (2016) — "Novel Resistance Training-Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve" *J Strength Cond Res*
- Epley, B. (1985) — 1RM prediction equation (Epley formula)
- Architecture: [training-engine-architecture.md](./training-engine-architecture.md#progressive-overload-theoretical-assumptions)
