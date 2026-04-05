# Feature: Unending Programs

**Status**: Implemented

**Date**: 7 Mar 2026

## Overview

Unending programs are a second program mode alongside the existing fixed-length (scheduled) mode. Instead of a pre-planned week-by-week structure, an unending program generates exactly one workout at a time — the next one. After each session is completed, the next workout is generated fresh from the results of the previous session and the full training history. There is no predetermined end date.

## Problem Statement

The current program model assumes a fixed training cycle of 10–14 weeks. This serves athletes preparing for a specific meet or who prefer structured programming. But some athletes train continuously without fixed cycles — they want the adaptive, data-driven session generation that Parakeet provides without being locked to a calendar.

**Pain points:**
- A lifter who trains year-round has to create and abandon programs repeatedly just to keep the app functional
- The program view showing a 10-week grid feels meaningless when the lifter isn't following a planned peaking cycle
- There is no "just train" mode — every program implies a fixed structure, fixed end date, and explicit cycle completion event

**Desired outcome:** A lifter can choose "Unending" at program creation and train indefinitely. The app generates each workout fresh, based on what actually happened last time. The program view shows only the next session. When the lifter decides to stop (before a competition, a break, or switching programs), they end the program manually — which triggers a cycle review summarizing everything since the start.

## User Experience

### User Flows

**Creating an Unending Program:**

1. User reaches the Program Settings screen (onboarding or after ending a program)
2. Under **Program Style**, user taps "Unending" (vs the default "Scheduled")
3. The Duration picker is hidden — no week count is needed
4. User completes remaining settings (days/week, gender, etc.) and taps Generate
5. Program is created with no pre-generated schedule — the first session is created immediately (Squat, Heavy, Block 1)
6. Today tab shows the first session card

**Daily Workout Flow (Unending):**

1. User taps "Start" on Today's session card — same soreness check-in flow
2. JIT generator runs — session weights, sets, reps generated from current state
3. User completes the session
4. On next app open (or Today refresh), a new session is generated automatically:
   - Next lift in the rotation (e.g., Bench after Squat; Deadlift; then back to Squat)
   - Block cycles 1→2→3→1→2→3… indefinitely based on total sessions completed (same 3-week block cadence as scheduled programs)
   - Deload sessions inserted at the same cadence as scheduled programs (every 4th week equivalent)
   - Weights and volume adjusted from the just-completed session's RPE, soreness, and MRV state

**Missed Sessions (Unending):**

Unending programs have no future-dated sessions — the next session is always created for today. As a result, there are no sessions that can become "missed" passively. If the user doesn't train for several days, the same next session remains available. The JIT generator accounts for the gap via `daysSinceLastSession` input, applying a conservative load if the gap is unusually long.

**Program Tab (Unending):**

- No week/block grid is shown
- Header shows: **"My Program · Unending"** and a session counter ("Session 14")
- A single card shows the upcoming session: lift, intensity type, block
- "End Program" button at top right

**Ending an Unending Program:**

1. User taps "End Program" on the Program tab
2. Alert: "End Program — This will close your program and generate a full cycle review."
3. User confirms → program is archived → cycle review is generated automatically (same as when a scheduled program reaches completion)
4. If the user starts a new program afterwards, the same auto-max estimation flow applies — the system pre-fills estimated 1RMs from qualifying sets across the ended program
5. History tab shows the archived program with the Review button

**Ending a Scheduled Program Early:**

"Abandon" is renamed to "End Program" for all program types. For scheduled programs the behavior is unchanged: the program is archived with no automatic cycle review (the 80%-completion auto-review already handles normal cycle completion).

### Visual Design Notes

- **Program Style toggle** on Program Settings: segmented control with "Scheduled" and "Unending" options; selecting Unending collapses the Duration picker
- **Program tab (unending)**: Replaces the week-grid ScrollView with a single session card (lift name, intensity badge, block indicator). Subtitle shows "Block N · Session M" where N cycles 1–3 and M is the total sessions completed since program start.
- **"End Program" button**: Red/danger color, same position as current "Abandon" — applies to all programs regardless of mode

## User Benefits

**No artificial end dates**: Train continuously. The program grows with the lifter without requiring manual cycle management.

**Always adaptive**: Each session is generated from the actual outcome of the previous one — the same JIT intelligence that drives scheduled programs applies here, session after session.

**Manual cycle reviews on demand**: When the lifter decides to end the program (before a meet, a training break, or just a reset), a full cycle review is generated covering the entire unending program — the same review report as a completed scheduled cycle.

## Lift Rotation — History-Based (updated 13 Mar 2026)

The original implementation derived the next lift purely from `sessionCounter % 3` → `LIFT_ORDER[idx]`. This was fragile: if the counter drifted (session skipped, duplicate generation, app crash mid-creation), lifts could repeat or skip with no self-correction.

**Current approach:** The next lift is derived from the last *completed* lift in the program, advancing one position in the squat→bench→deadlift rotation. The counter continues to drive periodization (week number, block number, intensity type, deload cycle). When no completed session exists yet (first session), the counter-based fallback is used.

This is self-correcting: if sessions are skipped, abandoned, or deleted, the next lift is always correct based on what was actually trained. The `nextUnendingSession()` pure function accepts an optional `lastCompletedLift` parameter; the app layer fetches the last completed lift from the DB and passes it through.

## Open Questions

None.

## References

- Related Design Docs: [program-generation.md](./program-generation.md)
- Specs: [programs-005-unending-program-mode.md](../specs/06-programs/programs-005-unending-program-mode.md), [mobile-028-unending-program-ui.md](../specs/09-mobile/mobile-028-unending-program-ui.md)
