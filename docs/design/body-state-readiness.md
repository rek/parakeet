# Feature: Body-State Review & Readiness

**Status**: Draft
**Date**: 8 Mar 2026

## Overview

Body-State Review & Readiness closes the feedback loop between what the system predicts a lifter should feel and what they actually feel. It adds three capabilities: (1) an expanded pre-workout readiness check that captures sleep, energy, and full-body soreness, (2) an end-of-week body review that compares predicted fatigue against felt fatigue, and (3) cycle phase–aware workout generation that adjusts load and volume based on menstrual cycle phase.

## Problem Statement

The system currently tracks body-state signals — soreness, training volume, cycle phase, disruptions — but uses them incompletely:

**Pain points:**
- The pre-workout soreness check only asks about the 3 muscles relevant to today's lift. If quads are destroyed from Tuesday's squat session but today is bench day, the system never learns that. Cross-session fatigue accumulation is invisible.
- No subjective readiness signals are captured. Sleep quality and energy level meaningfully affect training capacity but are not part of the system's model.
- Volume predicts fatigue mathematically (sets vs MRV), but the system never asks "does this match how you actually feel?" There is no feedback loop — the lifter cannot tell the system that its predictions are wrong.
- Cycle phase is tracked, displayed as a pill on the Today screen, and stamped on completed sessions — but it never influences workout generation. This is the single largest gap for the female user. Research shows menstrual cycle phase meaningfully affects strength, recovery, and perceived exertion.

**Desired outcome:** The system always has the best possible picture of how the lifter's body feels, so every workout is calibrated — loading or deloading the right things, training what is least sore, and respecting physiological cycles.

## User Experience

### User Flows

**Flow A — Enhanced Pre-Workout Readiness Check-In:**

1. User opens today's session and taps "Start"
2. The existing soreness screen appears with the 3 lift-specific muscles at top (unchanged)
3. Below the legend, a collapsed "Other muscles" section can be expanded to rate the remaining 6 muscles. This is optional — if skipped, those muscles default to 1 (fresh). Expansion persists across sessions (once opened, stays open).
4. Below the muscle section, two quick-tap rows appear:
   - Sleep quality: Poor / OK / Great (3 pills)
   - Energy level: Low / Normal / High (3 pills)
   - Both default to the middle value (OK / Normal). A single tap changes each.
5. User taps "Generate Today's Workout" as before
6. The JIT engine now factors in: all 9 muscles' soreness, sleep quality, and energy level
7. If both sleep and energy are poor, the system reduces volume and intensity automatically (similar to high soreness). If both are great, a small intensity boost is applied.
8. Total added interaction time: ~5 seconds (3 extra taps at most)

**Flow B — End-of-Week Body Review:**

1. User completes the last session of a program week (or every 3rd session in unending mode)
2. After the WorkoutDoneCard screen, a prompt card appears: "End of week — how does your body feel?"
3. User can dismiss (skip) or tap to open the full review screen
4. Full review screen shows all 9 muscle groups, each pre-populated with the system's predicted soreness level based on that week's training volume vs MRV
5. Next to each muscle: a mini volume bar showing sets completed / MRV with percentage
6. User adjusts each muscle rating to match how they actually feel (same 1–5 scale: Fresh / Mild / Moderate / High / Severe)
7. Optional notes field at the bottom
8. On submit:
   - The system highlights mismatches (muscles where felt and predicted differ by 2+ levels)
   - Mismatches are classified: "accumulating fatigue" (felt worse than predicted) or "recovering well" (felt better than predicted)
   - If a muscle consistently shows accumulating fatigue across weeks, the system suggests reducing that muscle's MRV target by 1–2 sets
   - Review data is stored and included in cycle reviews so the AI can reference body-state trends

**Flow C — Cycle Phase–Aware Workout Generation (automatic, no user action):**

1. If cycle tracking is enabled, the system computes the current cycle phase before generating each workout
2. During menstrual and late luteal phases: intensity is automatically reduced ~5% and 1 set is removed. A small informational chip appears on the soreness screen: "Late Luteal — intensity reduced 5%"
3. During follicular and ovulatory phases: no adjustment (neutral — these are peak performance windows, but we don't boost above programmed values)
4. During luteal phase: a subtle ~2.5% intensity reduction
5. The user does not need to take any action. The cycle phase chip is informational only.
6. Adjustments stack with soreness and readiness modifiers (e.g., late luteal + poor sleep = larger reduction)

**Alternative Flows:**
- Skipping the expanded muscles: defaults other muscles to 1. System uses only lift-specific soreness as it does today (backward compatible).
- Skipping the weekly review: no data stored for that week. The prompt does not re-appear until the next qualifying session.
- Cycle tracking disabled: cycle phase adjustments are completely inactive. No UI elements appear.
- Ad-hoc sessions: no weekly review trigger (no week concept). Readiness check-in still applies.

### Visual Design Notes

- **Expanded muscles section**: Collapsible with a subtle chevron and "Other muscles" header. Same pill-row layout as existing muscles. Collapsed by default on first use; remembers expansion state.
- **Sleep/energy pills**: Two horizontal rows of 3 pills each, using the same pill styling as soreness ratings. Color-coded: Poor/Low = amber, OK/Normal = neutral, Great/High = green.
- **Weekly review muscle rows**: Each row has the muscle name, a 1–5 pill selector, and a thin horizontal volume bar below it showing sets/MRV percentage. The bar uses the same color coding as the volume dashboard (blue/green/yellow/red).
- **Mismatch highlights**: Muscles with ≥2-level mismatch are highlighted with a border glow and a small directional arrow (↑ accumulating fatigue, ↓ recovering well).
- **Cycle phase chip**: Small rounded pill on the soreness screen, same style as the Today screen cycle phase pill but with the adjustment note appended (e.g., "Menstrual — −5% intensity, −1 set").

## User Benefits

**More accurate workouts**: Every session uses the fullest possible picture of how the body feels — not just 3 muscles but all 9, plus sleep and energy. The workout is calibrated to what the body can actually handle today.

**Feedback loop**: The weekly review lets the lifter tell the system when its predictions are wrong. Over time, this data helps calibrate MRV targets and gives the cycle review AI concrete evidence of body-state trends.

**Cycle-aware training for women**: Instead of manually adjusting or pushing through phases where capacity is reduced, the system automatically adapts. This is evidence-based and removes the guesswork that currently exists during menstrual and late luteal phases.

**Still fast**: The pre-workout flow adds at most 3 taps (5 seconds). The weekly review is prompted, not required. Cycle phase adjustments are automatic. Nothing slows down the lifter.

## What We Chose NOT To Do

- **No HRV integration**: Hardware-dependent, adds complexity, and the two-user scale doesn't justify it.
- **No automatic MRV adjustment from mismatches**: Suggestions only. The lifter decides whether to change their MRV config based on the mismatch data. Auto-adjusting MRV based on subjective ratings risks chasing noise.
- **No RPE prediction model**: We don't attempt to predict what RPE will feel like based on readiness signals. We adjust load/volume and let the lifter report actual RPE during the session.
- **No boost above programmed values**: Even during follicular/ovulatory phases, we don't increase intensity or volume above what the formula prescribes. Over-programming is riskier than slight under-programming.

## Open Questions

- [ ] Should the weekly review also capture an overall "readiness" rating (1–10) separate from per-muscle soreness? This could be useful for trend analysis.
- [ ] Should cycle phase adjustments apply to auxiliary exercises as well, or only main lifts?

## Future Enhancements

- **Mismatch-driven MRV auto-calibration**: If a muscle shows 3+ consecutive weeks of accumulating fatigue mismatches, automatically lower its MRV by 1 set (with notification to user).
- **Readiness trend visualization**: A chart showing sleep/energy/soreness trends over time, correlated with training performance.
- **Cycle phase performance correlation**: After enough data, show the lifter how their performance (RPE, completion %) varies by cycle phase — validating or challenging the adjustment values.

## References

- Related Design Docs: [volume-mrv-methodology.md](./volume-mrv-methodology.md), [disruption-management.md](./disruption-management.md), [sex-based-adaptations.md](./sex-based-adaptations.md)
- Spec: [engine-028-readiness-adjuster.md](../specs/04-engine/engine-028-readiness-adjuster.md)
- Spec: [engine-029-fatigue-predictor.md](../specs/04-engine/engine-029-fatigue-predictor.md)
- Spec: [engine-030-cycle-phase-jit-adjuster.md](../specs/04-engine/engine-030-cycle-phase-jit-adjuster.md)
- Spec: [mobile-035-enhanced-readiness-checkin.md](../specs/09-mobile/mobile-035-enhanced-readiness-checkin.md)
- Spec: [mobile-036-weekly-body-review.md](../specs/09-mobile/mobile-036-weekly-body-review.md)
- Spec: [data-007-weekly-body-reviews.md](../specs/05-data/data-007-weekly-body-reviews.md)
- External: RP Strength Training Volume Landmarks, McNulty et al. (2020) "The Effects of Menstrual Cycle Phase on Exercise Performance in Eumenorrheic Women: A Systematic Review and Meta‐Analysis"
