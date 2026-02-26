# Feature: Warmup Calculator

**Status**: Planned

**Date**: 2026-02-22

## Overview

The Warmup Calculator automatically generates a personalised warmup sequence before each working session. Based on the session's working weight and the user's chosen protocol, the app computes exact warmup weights (in kg) and presents them as a checklist above the working sets. The user never needs to calculate warmup percentages manually.

## Problem Statement

Every experienced lifter knows they need to warm up before heavy sets. But calculating 40%, 60%, 75% of 147.5kg in your head — while setting up a squat rack — is unnecessary friction. And warmup needs aren't the same across every session: a heavy day benefits from a longer ramp-up, a recovery day doesn't need six warmup sets.

**Pain points:**
- Mental overhead of calculating warmup weights from percentages during a workout
- Warmup protocols vary by lift preference and training context (heavy vs. recovery day)
- Most training apps don't generate warmup sets at all — users manage this entirely on their own
- The same protocol doesn't suit every lift (a lifter may want Extended for Squat but Minimal for Bench)

**Desired outcome:** The app generates exact warmup weights for every session automatically, adapted to the day's working weight and protocol preference, with zero calculation required from the user.

## Warmup Protocols

Four built-in protocols cover the most common warmup approaches. Users can also define a fully custom protocol per lift.

| Protocol | Steps | Best suited for |
|----------|-------|-----------------|
| **Standard** | 40%×5, 60%×3, 75%×2, 90%×1 | Most sessions — the default |
| **Minimal** | 50%×5, 75%×2 | Recovery sessions, lighter days, time-constrained workouts |
| **Extended** | 30%×10, 50%×5, 65%×3, 80%×2, 90%×1, 95%×1 | Heavy days and near-maximal singles — thorough CNS prep |
| **Empty Bar** | 20kg×10, 50%×5, 70%×3, 85%×1 | Technique focus, beginners, sessions where bar speed matters |
| **Custom** | User-defined steps | Any protocol the user prefers — full control over percentage and reps per step |

All weights are rounded to the nearest 2.5kg with a minimum of 20kg (the empty bar). If two consecutive steps would produce the same rounded weight, the duplicate step is automatically skipped.

**Automatic protocol switching:** The system overrides the user's protocol with Minimal in two situations:
- The session is classified as a recovery session
- The working weight is below 40kg (a full ramp-up isn't meaningful at very light loads)

## User Experience

### User Flows

**During a session:**

1. User taps "Start Workout" and passes the soreness check-in
2. The session screen opens with a collapsible **Warmup** section above the working sets
3. Warmup section shows: "Warmup — [N] sets" header with a chevron
4. Expanded view lists each warmup set as a row: set number, weight in kg, reps, checkbox
5. User taps the checkbox for each warmup set as they complete it
6. Completed sets show a strikethrough; when all warmup sets are checked, the section auto-collapses
7. User continues into the working sets

**Managing warmup settings:**

1. User navigates to Settings → Warmup
2. Three sections: Squat, Bench Press, Deadlift
3. Each section has a protocol picker (Standard / Minimal / Extended / Empty Bar / Custom)
4. Below the picker, a **live preview** card shows the exact warmup sets for that lift at the user's current working weight — e.g., "50kg × 5, 75kg × 3, 90kg × 2, 112.5kg × 1" — updating instantly as the protocol changes
5. Choosing Custom opens an editor: add steps (percentage 1–99, reps 1–10), remove steps, reorder them
6. Changes take effect immediately for the next session

### Visual Design Notes

- Warmup section header: bold "Warmup" label + set count + collapse chevron
- Set rows: set number (small, grey), weight (prominent, black), reps, checkbox on the right
- Empty bar weight shown as a "Bar (20 kg)" pill badge instead of a plain number
- Completed sets: text turns grey with strikethrough
- Auto-collapse: smooth accordion animation when all sets are checked
- Settings preview card: matches the session row style exactly — the user sees their real interface

## User Benefits

**Zero mental math during a workout**: Warmup weights are calculated from the working weight and displayed as a simple list. No percentages to compute under load.

**Protocol matches the session**: Recovery days automatically use fewer warmup sets. Heavy days can use Extended for a thorough ramp-up. The protocol adapts without any extra input from the user.

**Per-lift customisation**: A lifter who prefers a longer warmup for Squat but a faster one for Bench can set different protocols independently. Custom protocols support any approach the user has developed.

**Live preview in Settings**: Changing a protocol immediately shows the exact weights — the user sees the impact of their choice before committing, using their actual current maxes.

## Future Enhancements

**Phase 2:**
- "Skip warmup" shortcut — collapses the warmup section immediately without checking boxes, for cases where the user warmed up elsewhere (e.g., at the end of another session)

**Long-term:**
- Warmup time estimates: show approximate time to complete the warmup based on the number of sets
- Dynamic warmup: bar-speed or subjective readiness input after the first warmup set, adjusting subsequent sets

## References

- Related Design Docs: [program-generation.md](./program-generation.md), [performance-logging.md](./performance-logging.md)
- Specs: [engine-010-warmup-calculator.md](../specs/04-engine/engine-010-warmup-calculator.md), [data-003-warmup-config.md](../specs/05-data/data-003-warmup-config.md), [parakeet-013-warmup-display.md](../specs/09-parakeet/parakeet-013-warmup-display.md)
