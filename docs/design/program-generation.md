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

**At workout time:** When the user opens a session (after the soreness check-in), the JIT generator runs and computes:
- Base sets/reps/weight from the formula config and current 1RM
- Adjustments based on soreness ratings
- Volume caps from MRV status
- Intensity adjustments based on recent RPE trends
- Auxiliary exercises for the block

This means the program adapts automatically as the user's state changes across the cycle. A high-soreness day gets lighter volume; a week where the lifter has already accumulated a lot of volume gets capped automatically.

## User Experience

### User Flows

**Primary Flow:**

1. User enters 1RM or 3RM for Squat, Bench, Deadlift (all in kg)
2. User selects program length (10/12/14 weeks) and training days (3 or 4/week)
3. User selects start date
4. App shows a preview of Week 1 — session types and auxiliary exercises (no weights, since those are JIT)
5. User activates the program → Today tab shows the first upcoming session

**Daily Workout Flow:**

1. User taps "Start Today's Session" on the Today tab
2. Soreness check-in screen appears — user rates 3 muscle groups on a 1–5 scale
3. User taps "Generate Today's Workout" — JIT generator runs (< 1 second)
4. Session screen opens with concrete sets, weights, and reps
5. User logs each set (weight in kg, reps, optional RPE)
6. Session completes → performance metrics computed locally → written to Supabase

**Regeneration Flow:**

1. User updates their maxes after completing a training cycle
2. User taps "New Program" from Settings
3. App generates a new program version using updated maxes
4. Previous program is archived (full history preserved)
5. User previews and activates

### Visual Design Notes

- Program grid: each session cell shows lift name and intensity badge (Heavy/Explosive/Rep/Deload)
- Block color coding: Block 1 = blue, Block 2 = orange, Block 3 = red, Deload = grey
- Sessions without JIT data show a "not yet generated" state — no weight preview
- Sessions with JIT data (already opened) show a summary of the generated sets
- All weights displayed in kg throughout the app

## User Benefits

**Adaptive weights**: Planned weights adjust automatically to the lifter's current state — no manual recalculation when tired, sore, or on a recovery week.

**Zero calculation required**: The app handles all percentage-to-weight conversions, rounding to the nearest 2.5kg, progressive loading changes, and MRV/MEV capping.

**Transparent methodology**: Every session shows why adjustments were made: "Moderate soreness — reduced 1 set", "Approaching MRV for quads — volume capped at 3 sets".

**Full history preserved**: Each program generation creates a new versioned record. All completed sessions and their actual weights are kept permanently.

## Auxiliary Exercise Rotation

Each main lift has a pool of 8 auxiliary exercises. Two are active each block, rotating sequentially through the pool across programs:
- Block 1: exercises 1+2
- Block 2: exercises 3+4
- Block 3: exercises 5+6
- Next program Block 1: exercises 7+8, then wraps

Users can reorder the pool (Settings → Auxiliary Exercises) or lock individual block assignments.

## Implementation Status

### Planned

- 1RM and 3RM input with live Epley estimation (kg)
- Structural program generation (no planned sets at creation)
- JIT session generation at workout time
- Soreness check-in gates JIT generation
- MRV/MEV-aware volume capping
- Auxiliary exercise pool + block rotation
- Performance-adjusted intensity (RPE trend detection)
- Program preview before activation
- Program versioning and history

## Future Enhancements

**Phase 2:**
- Auto-regeneration prompt after each completed block with suggested max increases
- Competition date targeting (auto-calculate program length to peak on a specific date)

**Long-term:**
- Support for alternative programming systems (5/3/1, GZCLP, Juggernaut)

## Open Questions

- [ ] Should the app support programs shorter than 10 weeks (e.g., a 6-week mini-cycle)?
- [ ] What should happen if the user doesn't complete all sessions in a week — does the next week start anyway, or does it wait?

## References

- Related Design Docs: [user-onboarding.md](./user-onboarding.md), [formula-management.md](./formula-management.md), [volume-management.md](./volume-management.md)
- External: Brandon Lilly's Cube Method (10-week concurrent periodization)
- Specs: [engine-007-jit-session-generator.md](../specs/engine-007-jit-session-generator.md), [engine-004-program-generator.md](../specs/engine-004-program-generator.md)
