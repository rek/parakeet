# Feature: History-Anchored Auxiliary Weights

**Status**: Implemented

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

**Session 1 (no history):** prescription comes from the catalog formula. Standard fatigue discount applies on heavy days. Lifter completes the sets, may adjust weight up or down.

**Sessions 2-3 (blend phase):** prescription is a weighted blend of formula and the emerging rolling-average anchor. Each completed session shifts the blend further toward history. Post-main fatigue discount still applies during this phase since the anchor is not yet fully trusted.

**Session 3+ (anchor established):** prescription is the rolling average of the last 3 completed sessions of this exercise. The catalog formula is no longer consulted. The post-main fatigue discount is dropped — the historical sets were themselves logged after main work, so the fatigue context is already baked in.

**When the lifter manually overrides a weight:** the override and its logged reps are added to the rolling average like any other completed set. **If two consecutive sessions are overridden in the same direction (both above prescribed or both below) and within a tight band of each other, the system snaps the anchor to the override and discards prior rolling history.** This is the "you told me twice — I'm listening" rule.

**When an aux exercise hasn't been done in 8+ weeks:** the rolling-average window is considered stale. The system decays the anchor back toward the formula and prescribes a conservative starting weight rather than asking the lifter to match a number from months ago.

### Adjustment direction

History anchoring changes only the **base** — the number before modifiers. Once the anchor is established (3+ sessions), the modifier stack changes:

- Post-main fatigue discount: **dropped** (history already reflects this context).
- Soreness, readiness, cycle phase, disruption modifiers: **still apply** on top of the anchor (these reflect today's state, which history can't predict).
- MRV cap: **still applies** as a hard gate.

During the cold-start and blend phases, all original modifiers still apply (including the fatigue discount).

### Divergence transparency

When the anchor base and formula disagree by more than 20%, a small note appears on the aux row ("Using your recent 110kg rather than the formula's 150kg"). Tapping the note opens an explainer sheet showing the anchor's source and confidence, how many sessions contributed, the formula's value, the anchor base, today's prescribed weight (which may differ from the anchor base due to main-lift modifiers), and a plain-language rationale. Within ±20% the prescription is presented without commentary.

## User Benefits

**Trust**: The number the system shows matches what the lifter actually did. No more "why is it asking me to do 60kg when I did 80kg last week?"

**Self-correcting**: Manual overrides stop being lost effort — they teach the system. Two overrides in a row is the lifter saying "this is the weight," and the system agrees.

**Individual variance respected**: Lever lengths, machine differences, joint structure, training age — all the things that make per-exercise percentages unreliable — become irrelevant. The lifter's own history is the only authority on what they can lift.

**Strength-aligned**: Consistent with the engine's existing philosophy of treating logged RPE and completed sets as ground truth for the main lifts. Aux work is finally on the same footing.

## Decisions

The following parameters are settled and should drive the spec:

| Decision | Value | Rationale |
| --- | --- | --- |
| Anchor source | Rolling average of last N completed sessions | Smooths noise from any single bad day while remaining responsive. |
| Window size | Fixed: last 3 sessions | Tight enough to track recent capacity, wide enough that one off-day is ~33% of the signal. |
| Handoff curve | Blend formula ↔ anchor across sessions 1–3, full anchor at session 3 | No cliff. History weight rises linearly from 0 to 1 over the first three sessions. |
| Recency horizon | 8 weeks since last completed session | Survives a normal block + deload without losing the anchor; long enough not to nag returning users. |
| Stale-window decay | Anchor weight decays back toward formula past the horizon | Avoids matching a stale PR after a long break. |
| Post-main fatigue discount | Dropped once anchor is established (session 3+) | History was logged in the same fatigue context — applying the discount again would double-count. Kept during cold-start and blend. |
| Override capture | Manual overrides count as normal completed sets in the rolling average | Consistent — the override IS what the lifter did. |
| Override snap rule | Two consecutive same-direction overrides within ~5% of each other → anchor snaps to override, prior history discarded | Honors the user's "I told you twice" signal. Direction = both above or both below prescribed. |
| Session eligibility | Any logged set with weight + reps counts | Maximally inclusive. Partial sessions are still real data. |
| Divergence callout | When anchor diverges from formula by > 20%, show a one-line note with a tappable explainer | Builds trust on large gaps without nagging on small ones. |
| LLM integration | Formula path computes and persists the anchor in `PrescriptionTrace` even when the LLM strategy generated the session; the LLM prompt itself does not currently consume `auxHistory` or surface anchor metadata in aux rows | Keeps anchor-driven post-session calibration intact on LLM/hybrid sessions. Threading anchor data into the LLM prompt is tracked separately. |
| Plate-rounding hysteresis | Don't surface an anchor change unless it moves the prescribed weight by ≥ one plate increment | Avoid "we updated by 1.2kg" notes when rounding swallows the change. |
| Custom exercises | Anchored by exercise slug, not catalog entry | Custom and catalog exercises follow the same path. |

## Edge Cases

- **Bailed sessions** — sessions with only warm-up sets logged should not pollute the anchor; the eligibility rule ("any logged set") implicitly trusts that the lifter logged what they meant to log. If this proves noisy in prod, revisit by requiring at least one set ≥ formula floor.
- **Reset and snap** — when the override snap rule fires, the rolling-average window is reset; the next session starts fresh with the override as session 1 of the new window. The blend phase does not re-run (the snap is itself the "I'm sure" signal).
- **Mixed exercise variants** — paused bench and standard bench are separate slugs and do not share an anchor. Cross-variant inference is out of scope.
- **First session ever for a lifter** — main-lift 1RM may itself be a self-reported estimate. Formula percentages on top of an unverified 1RM are already approximate; the cold-start window is the existing risk surface, not a new one.

## References

- Issue: [GH#221](https://github.com/rek/parakeet/issues/221) — Not updating auxiliary weight
- Related: [GH#144](https://github.com/rek/parakeet/issues/144) — The Learning Machine (existing calibration infrastructure)
- Related: [GH#217](https://github.com/rek/parakeet/issues/217) — Main-lift modifiers propagate to aux (closed) — this design layers on top
- Related Design Docs: [design-types.md](./design-types.md), [../core-engine/design-architecture.md](../core-engine/design-architecture.md), [../core-engine/prescription-trace-integration.md](../core-engine/prescription-trace-integration.md)
- Engine: `packages/training-engine/src/auxiliary/exercise-catalog.ts` (`computeAuxWeight`), `packages/training-engine/src/generator/steps/processAuxExercise.ts`
- Existing infrastructure (per GH#144): `modifier_calibrations` table, `modifier-effectiveness.ts`, `PrescriptionTrace`
