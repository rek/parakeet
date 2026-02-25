# Feature: Program Generation

**Status**: Planned

**Date**: 2026-02-22

## Overview

Parakeet generates a structural training program from three inputs: 1-rep max (or 3-rep max) values for Squat, Bench, and Deadlift, a desired program length, and training frequency. The program follows Brandon Lilly's Cube Method periodization structure. Actual training weights are **not** pre-calculated — they are generated Just-In-Time (JIT) when the user opens each session, using all available data at that moment.

## Problem Statement

Intermediate powerlifters understand periodization concepts but struggle to translate them into precise week-by-week loading schemes. Pre-generated programs become stale when circumstances change (soreness, fatigue, performance trend).

**Pain points:**
- Pre-generated weights don't account for how the lifter feels on a given day
- Changing one input (e.g., updating a max) requires recalculating the entire program
- Generic programs can push athletes toward or past their max recoverable volume
- No easy way to see the full program structure at a glance before committing to it

**Desired outcome:** A lifter enters three numbers and receives a complete program structure. Each workout, the app generates precise weights, sets, and reps based on current state — soreness, recent performance, weekly volume — rather than a static pre-calculated plan.

## JIT vs Pre-Generated: The Key Distinction

**At program creation:** The app generates **structural scaffolding** only — session placeholders with metadata (week, block, lift, intensity type, planned date) but no planned sets.

**At workout time:** When the user opens a session (after the soreness check-in), the JIT generator runs and computes a complete workout from ~43 inputs: the current 1RM, block/intensity type, soreness per muscle, accumulated weekly volume, recent RPE history, time since last session of this lift, active disruptions, menstrual cycle phase (if tracked), and more.

The JIT generator is a **pluggable strategy system** — formula-based, LLM-based, and hybrid implementations can be run and compared independently. See [training-engine-architecture.md](./training-engine-architecture.md) for the full architecture, variable inventory, and strategy descriptions.

**Why JIT, not pre-generated weights:** Pre-generated percentages assume a static lifter. In reality, all three dimensions of progressive overload — load, volume, and time between work — vary session to session. A lifter who trained 5 days ago, slept well, and rates soreness as 1 should receive a materially different session than the same lifter who trained 12 days ago with soreness of 4. Pre-generated programs ignore this; JIT generation uses it as primary input. See [training-engine-architecture.md](./training-engine-architecture.md#progressive-overload-theoretical-assumptions) for the research basis.

This means the program adapts automatically as the user's state changes across the cycle. A high-soreness day gets lighter volume; a week where the lifter has already accumulated a lot of volume gets capped automatically.

## User Experience

### User Flows

**Primary Flow:**

1. User enters 1RM or 3RM for Squat, Bench, Deadlift (all in kg)
2. User selects program length (6–14 weeks) and training days (3 or 4/week)
3. User selects start date
4. App shows a preview of Week 1 — session types and auxiliary exercises (no weights, since those are JIT)
5. User enters body weight (kg) — recorded as the starting body weight for this cycle
6. User activates the program → Today tab shows the first upcoming session

**Daily Workout Flow:**

1. User taps "Start Today's Session" on the Today tab
2. Soreness check-in screen appears — user rates 3 muscle groups on a 1–5 scale
3. User taps "Generate Today's Workout" — JIT generator runs (< 1 second)
4. Session screen opens with concrete sets, weights, and reps
5. User logs each set (weight in kg, reps, optional RPE)
6. Session completes → performance metrics computed locally → written to Supabase

**Missed Session Handling:**

- If a user misses a session (e.g., misses Monday's squat), they can still complete that workout **any day within the same week, up until the next scheduled session of the same lift type**
- Example: missed Monday squat → can make it up Tuesday, Wednesday, or Thursday if the next squat isn't until Friday
- If the makeup window passes and the session was not completed, it is marked as missed
- The JIT generator accounts for missed sessions when computing the next session of that lift type: it factors in how long ago the last successful session was, how much volume was accumulated, and conservatively limits the load increment for the next session (a missed session cannot be treated as a full recovery week). **Research basis:** After ~7+ days without stimulus, the supercompensation window passes and the lifter returns to near-baseline for that lift (Selye, 1950 — GAS model). Treating a 10-day gap as equivalent to a 3-day gap would apply the wrong intensity, risking failure or injury.
- Weeks do not "wait" — the calendar advances normally regardless of whether sessions were completed

**Regeneration Flow:**

When the user completes a training cycle, the system automatically estimates new maxes from actual performance data collected throughout the cycle — the user does not need to recall or input maxes from memory.

**How auto-max estimation works:**

1. For each lift, the system collects all qualifying sets from the completed cycle — sets where:
   - RPE was logged at ≥ 8.5, **or**
   - The set was the final working set of a heavy day (treated as near-maximal by definition)
   - No active disruption was flagged on that session
   - Cumulative sets that day were within a normal range (not excessively fatigued)
   - Soreness check-in score was ≤ 2 for the primary muscle group
2. Each qualifying set produces an estimated 1RM (Epley + RPE confidence scaling — see [performance-logging.md](./performance-logging.md))
3. The highest-confidence estimates are averaged, weighted toward the most recent sessions in the cycle
4. This produces a **system-estimated 1RM** for each lift

When the user taps "New Program":
1. App shows the estimated new maxes pre-populated ("Based on your training this cycle: Squat 145kg, Bench 105kg, Deadlift 170kg")
2. User can confirm or manually adjust any value before generating the new program
3. App generates the new program version using the confirmed maxes
4. Previous program is archived (full history preserved)
5. User previews and activates
6. App asks for current body weight (kg) again — recorded as the starting body weight for the new cycle

### Visual Design Notes

- Program grid: each session cell shows lift name and intensity badge (Heavy/Explosive/Rep/Deload)
- Block color coding: Block 1 = blue, Block 2 = orange, Block 3 = red, Deload = grey
- Sessions without JIT data show a "not yet generated" state — no weight preview
- Sessions with JIT data (already opened) show a summary of the generated sets
- All weights displayed in kg throughout the app
- Missed sessions are shown with a grey overlay and "Missed" badge; makeup sessions (within window) show an amber "Makeup" badge

## User Benefits

**Adaptive weights**: Planned weights adjust automatically to the lifter's current state — no manual recalculation when tired, sore, or on a recovery week.

**Zero calculation required**: The app handles all percentage-to-weight conversions, rounding to the nearest 2.5kg, progressive loading changes, and MRV/MEV capping.

**Transparent methodology**: Every session shows why adjustments were made: "Moderate soreness — reduced 1 set", "Approaching MRV for quads — volume capped at 3 sets", "Last squat was 9 days ago — conservative load applied".

**Auto-estimated maxes**: At the end of each cycle, maxes are pre-filled from actual performance data. No spreadsheets, no guessing — the system already knows what the user lifted.

**Full history preserved**: Each program generation creates a new versioned record. All completed sessions and their actual weights are kept permanently.

## Auxiliary Exercise Rotation

Each main lift has a pool of 8 auxiliary exercises. Two are active each block, rotating sequentially through the pool across programs:
- Block 1: exercises 1+2
- Block 2: exercises 3+4
- Block 3: exercises 5+6
- Next program Block 1: exercises 7+8, then wraps

Users can reorder the pool (Settings → Auxiliary Exercises) or lock individual block assignments.

## Program Length

Supported lengths: **6 to 14 weeks**, in 2-week increments (6, 8, 10, 12, 14). The default is 10 weeks (standard Cube Method cycle). Shorter programs (6–8 weeks) function as mini-cycles or bridge programs and use a compressed block structure:
- 6 weeks: 1 block per lift type (2 weeks each) + 2-week deload optional
- 8 weeks: ~2.5 weeks per block + deload

The JIT generator adapts to the program length — it knows which block the session belongs to and applies the appropriate formula config regardless of total cycle length.

## Implementation Status

### Planned

- 1RM and 3RM input with live Epley estimation (kg)
- Program length selector: 6–14 weeks (2-week increments)
- Structural program generation (no planned sets at creation)
- JIT session generation at workout time with recency factor (time since last lift of this type)
- Soreness check-in gates JIT generation
- MRV/MEV-aware volume capping
- Auxiliary exercise pool + block rotation
- Performance-adjusted intensity (RPE trend detection)
- Missed session detection + within-week makeup window
- Conservative load adjustment after missed sessions (recency factor)
- Program preview before activation
- Program versioning and history
- Auto-max estimation from cycle data at regeneration time
- Body weight capture at cycle start

## Future Enhancements

**Phase 2:**
- Competition date targeting (auto-calculate program length to peak on a specific date)

**Long-term:**
- Support for alternative programming systems (5/3/1, GZCLP, Juggernaut)

## References

- Related Design Docs: [user-onboarding.md](./user-onboarding.md), [formula-management.md](./formula-management.md), [volume-management.md](./volume-management.md), [performance-logging.md](./performance-logging.md)
- External: Brandon Lilly's Cube Method (10-week concurrent periodization)
- Specs: [engine-007-jit-session-generator.md](../specs/04-engine/engine-007-jit-session-generator.md), [engine-004-program-generator.md](../specs/04-engine/engine-004-program-generator.md)
- Architecture: [training-engine-architecture.md](./training-engine-architecture.md)
