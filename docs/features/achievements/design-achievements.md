# Feature: Achievements & Progress Recognition

**Status**: Planned

**Date**: 2026-02-22

## Overview

Achievements gives users visible recognition for training consistency and performance milestones. This includes session streaks, cycle completion badges, per-workout performance stars (new PRs), and a WILKS score page showing strength relative to body weight. These features reinforce positive training habits and create a sense of progression beyond just the numbers.

## Problem Statement

Strength training is a long game. Week-to-week weight increases are small, and it's easy for lifters to feel like they're not progressing — especially during a difficult block or after a disrupted week. Without visible progress markers, motivation suffers.

**Pain points:**

- Small weight increases (1.25–2.5kg) don't feel like achievements in the moment
- Completing an entire 10–14 week cycle is a major accomplishment that goes unrecognised in most apps
- Lifters don't know their WILKS score or how their strength-to-bodyweight ratio has changed
- Consistency milestones (streaks) are invisible — there's no feedback for showing up every day

**Desired outcome:** Users feel rewarded for consistency and performance, see clear evidence of long-term progress across cycles, and can easily check how strong they are relative to body weight.

## Features

### Cycle Completion Badges

A badge is awarded each time the user completes a full training cycle (activates a program, completes enough of it to be counted as finished).

**Completion threshold:** A cycle is counted as complete when at least 80% of planned sessions are logged (completed or legitimately skipped with a disruption reason). Pure no-shows do not count.

**Badge display:**

- Badge count shown on the Profile tab with an icon (e.g., medal/trophy)
- Each badge shows the cycle number, dates, and a summary stat ("Cycle 3 — 12 weeks — Squat up 12.5kg")
- The first badge is the hardest to earn; the count is a simple, honest measure of commitment

### Session Streak Counter

The streak counter tracks **consecutive program weeks in which every scheduled session was completed**. It's a strict measure of adherence to the plan, not a leniency counter.

**Streak rules:**

- A week counts as "clean" only if `completed === scheduled` — every scheduled session in that week was completed. Partial weeks do not count.
- A disruption-logged skip **breaks** the streak. Disruption reporting preserves honest analytics but does not preserve the streak; the streak rewards execution of the plan.
- A pure miss (no log, no disruption) also breaks the streak.
- The **current in-progress week is frozen** — it neither extends nor breaks the streak until its Sunday end has passed. The pill updates only when a week fully closes out clean.
- Imported historical sessions (`intensity_type = 'import'`, e.g. Strong CSV imports) are **excluded** from streak input — the streak reflects Parakeet-planned training only.
- Weeks with zero scheduled sessions (deload gap, pre-program dates) are skipped — they neither extend nor break.
- Current streak and longest-ever streak are both shown.

**Display:**

- Streak counter visible on the Today tab (e.g., "🔥 7 wk" — 7 consecutive fully-completed weeks)
- Longest streak shown on the Profile tab

### Performance Stars

At the end of each completed session, the app evaluates whether any new personal records were set. Stars are displayed on the session completion screen and logged to the PR history.

**Star types:**

| Star                 | Trigger                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| **Estimated 1RM PR** | This session's estimated 1RM for a lift is the highest ever recorded for that lift                       |
| **Volume PR**        | Total volume (sets × reps × weight) for this lift in a single session is the highest ever                |
| **Rep PR at Weight** | Most reps ever logged at a given weight for a specific lift (e.g., "5 reps at 140kg Squat — new rep PR") |

**Rules:**

- PRs are evaluated per lift (Squat, Bench, Deadlift separately)
- Only sessions with no active Major disruption are eligible (Minor and Moderate disruptions still count — the lifter showed up)
- Stars are displayed at session completion with a brief animation; they are then accessible in lift history
- Multiple stars can be earned in a single session

**Display on session completion:**

- Stars shown as a stack of cards: "⭐ New Squat Estimated 1RM — 152kg"
- If no PR: no star card shown (no "you didn't break any records" message)

### WILKS Score Page

The WILKS score is a formula that normalises powerlifting totals (Squat + Bench + Deadlift best) against body weight, allowing fair comparison across weight classes. Parakeet calculates it using the user's most recent estimated 1RMs and the current cycle's starting body weight.

**Formula:** The app uses the **2020 updated Wilks formula** with sex-specific polynomial coefficients. Female and male lifters have different coefficients, reflecting different strength-to-bodyweight distributions. See [sex-based-adaptations.md](./sex-based-adaptations.md) for the coefficient source and rationale.

**Data sources:**

- Total: sum of the three lifts' most recent estimated 1RMs (from session logs)
- Body weight: the body weight recorded at the start of the current cycle

**Page content:**

- Current WILKS score (large, prominent)
- Historical WILKS score chart — one point per completed cycle, showing trend over time
- Current estimated 1RMs used in the calculation (with last-updated date)
- Body weight used (with option to update current cycle's body weight if it has changed)
- Reference context: "World-class WILKS: 500+. Advanced: 350–450. Intermediate: 250–350."

**Access:** Profile tab → "WILKS Score"

## User Experience

### Session Completion Screen

After tapping "Complete Workout":

1. Standard completion summary (planned vs. actual volume)
2. If any PRs were set: star cards slide up with brief celebration animation
3. Cycle badge granted (if this session was the final one completing a cycle)
4. Streak update: "Week 5 clean ✓" or "Streak reset — remember to log disruptions if you miss"

### Profile Tab

The Profile tab shows at a glance:

- Cycle badge count ("4 cycles completed")
- Current streak and best streak
- Current WILKS score
- PR history per lift (best estimated 1RM, best volume session, best rep-at-weight for key weights)

## Future Enhancements

**Phase 2:**

- Share achievements (individual star card or WILKS score) as a shareable image
- Yearly summary: total sessions, total volume, PRs broken

**Long-term:**

- Leaderboard: opt-in WILKS comparison with other Parakeet users

## References

- Related Design Docs: [performance-logging.md](./performance-logging.md), [program-generation.md](./program-generation.md), [user-onboarding.md](./user-onboarding.md)
- Specs: [engine-022-pr-detection.md](./spec-pr-detection.md), [mobile-019-achievements-screen.md](./spec-screen.md)
