# Feature: History-Anchored Auxiliary Weights

**Status**: Draft

**Date**: 2026-05-23

**Issue**: [GH#221](https://github.com/rek/parakeet/issues/221)

> **Design Doc Philosophy**: This document describes WHAT the feature does and WHY, from a user perspective. Technical implementation details (HOW) are tracked in specs.

## Overview

Auxiliary exercise weight should be anchored to the lifter's own recent performance on that specific exercise, not derived purely from a static percentage of their main-lift 1RM. The system already knows what the lifter actually lifted last time — it should use that as the source of truth, with the formula serving only as a cold-start fallback.

## Problem Statement

Today the JIT generator computes every aux weight as `oneRmKg × catalog.weightPct`, modulated by main-lift fatigue and main-lift modifiers. It never reads the lifter's prior set logs for the aux exercise itself. The result:

- A lifter who can comfortably do CGBP at 90kg but whose bench 1RM puts the formula at 75kg is forever under-prescribed.
- A lifter whose leg press the formula prescribes at 150kg but whose history shows they can only complete sets at 110kg is forever over-prescribed.
- Manual session-time overrides are logged but discarded — the next session repeats the same wrong number.
- Aux exercises have wildly different individual variance (lever lengths, joint structure, machine differences) that no global percentage can capture.

@Takpapp's report captures the user experience: *"For two sessions in a row I've manually adjusted them. I would expect the program to look at my last successful lifts of that type to determine the weight."*

## Core Principle

**User history always trumps formula.** Once the system has enough completed sets on an aux exercise for a given lifter, the formula percentage is no longer load-bearing — it becomes the bootstrap value used only until real history exists.

This is the same philosophy the engine already applies to main lifts (working 1RM is calibrated from actual logged sets, not assumed) — extended to accessories.

## User Experience

### What the lifter sees

**First session with a new aux exercise:** prescription comes from the catalog formula (current behavior). Lifter completes the sets, may adjust weight up or down.

**Second session onward:** prescription is anchored to the most recent completed sets of that exercise, adjusted for the current session's main-lift load context (heavy day = small fatigue discount, deload = full prescription, etc.). The number on the screen reflects what they actually did last time, not what the formula thinks they should do.

**When the lifter manually overrides a weight:** the override is treated as a strong signal. Next session's prescription respects the override direction. Two consecutive overrides in the same direction = the system fully adopts the lifter's number; the formula effectively stops contributing.

**When an aux exercise hasn't been done in a long time:** if the gap exceeds a recency horizon (e.g. > 4 weeks since last completed), the system falls back toward the formula and surfaces a conservative starting weight so the lifter isn't asked to match a number from months ago.

### Adjustment direction

History anchoring **does not** disable other signals — it changes what the modifiers apply to:

- Main-lift fatigue discount (post-main multiplier) still applies, on top of the history-derived anchor.
- Soreness/disruption escalation can still suppress or scale aux work.
- The MRV cap still skips aux when weekly volume is saturated.

The change is purely the **base** — the number before modifiers — moves from `1RM × pct` to `last completed weight at this exercise`.

### RPE feedback

If logged RPE on the aux ran consistently above target (overprescribed), the next anchor is the lighter of the recent set weights, not the heaviest. If RPE ran below target (underprescribed), the next anchor trends toward the heavier sets. This mirrors the main-lift RPE rule but acts on the per-exercise anchor instead of the 1RM.

## User Benefits

**Trust**: The number the system shows matches what the lifter actually did. No more "why is it asking me to do 60kg when I did 80kg last week?"

**Self-correcting**: Manual overrides stop being lost effort — they teach the system. Two overrides in a row is the lifter saying "this is the weight," and the system agrees.

**Individual variance respected**: Lever lengths, machine differences, joint structure, training age — all the things that make per-exercise percentages unreliable — become irrelevant. The lifter's own history is the only authority on what they can lift.

**Strength-aligned**: Consistent with the engine's existing philosophy of treating logged RPE and completed sets as ground truth for the main lifts. Aux work is finally on the same footing.

## Edge Cases

- **No history yet** — formula bootstraps the first session; system marks the anchor as "exploring" until N completed sets exist.
- **Long gap (decay)** — beyond a configurable recency horizon, anchor weight is biased downward toward the formula to avoid asking the lifter to match a stale PR.
- **Catastrophic deviation** — if the formula and history disagree by more than a threshold (e.g. history is 50% of formula), surface a small note ("we're using your recent 110kg as the anchor — that's below the formula's 150kg estimate") so the lifter understands.
- **Plate rounding** — small calibration shifts may not move the prescribed weight at all. The system should not show "we adjusted by 1.2kg" if rounding swallowed the change. Hysteresis applies: don't surface an anchor change unless it moves at least one increment.
- **Confidence levels** — borrow from existing `modifier_calibrations` infrastructure (exploring → low → medium → high). After N consecutive sessions with consistent anchor, confidence rises; the formula is no longer consulted.
- **Custom exercises** — same logic applies. History anchors do not require a catalog entry; the exercise slug is the key.
- **Aux skipped sets** — completed sets at lower-than-prescribed weight or reps still inform the anchor (they're real data), but flagged differently from full completions so the system can detect "the lifter kept failing this" patterns.

## Open Questions

- [ ] How many completed sets are required before the anchor takes over from the formula? (Suggest: ≥1 full session, but increase confidence over 3+ sessions.)
- [ ] Should the anchor be the most-recent set, a rolling average, or the best recent set? Each has different failure modes when the lifter has a bad day.
- [ ] Does the post-main fatigue discount still apply on top of a history anchor that already reflects post-main fatigue from prior sessions? (Likely no — the history already encodes that context.)
- [ ] How does this interact with `jit-pipeline/spec-llm-strategy.md` — should the LLM see the per-exercise history as additional context, or does the formula path own the anchor and the LLM gets a pre-anchored base?
- [ ] Recency horizon — fixed (4 weeks) or proportional to typical aux rotation cadence?

## References

- Issue: [GH#221](https://github.com/rek/parakeet/issues/221) — Not updating auxiliary weight
- Related: [GH#144](https://github.com/rek/parakeet/issues/144) — The Learning Machine (existing calibration infrastructure)
- Related: [GH#217](https://github.com/rek/parakeet/issues/217) — Main-lift modifiers propagate to aux (closed) — this design layers on top
- Related Design Docs: [design-types.md](./design-types.md), [../core-engine/design-architecture.md](../core-engine/design-architecture.md), [../core-engine/prescription-trace-integration.md](../core-engine/prescription-trace-integration.md)
- Engine: `packages/training-engine/src/auxiliary/exercise-catalog.ts` (`computeAuxWeight`), `packages/training-engine/src/generator/steps/processAuxExercise.ts`
- Existing infrastructure (per GH#144): `modifier_calibrations` table, `modifier-effectiveness.ts`, `PrescriptionTrace`
