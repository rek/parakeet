# Feature: Intra-Session Adaptation

**Status**: Draft

**Date**: 11 Mar 2026

> **Design Doc Philosophy**: This document describes WHAT the feature does and WHY, from a user perspective. Technical implementation details (HOW) are tracked in specs for granular task management. Keep this doc user-focused, concise, and free of code/implementation specifics.

## Overview

When a lifter fails a set mid-session, the remaining sets stay unchanged — leaving the lifter to grind through targets their body just told them it cannot hit. Intra-Session Adaptation treats a failed set as a body-state signal and responds immediately: extended rest, then weight reduction, then set capping. The system adapts the rest of the session in real time rather than waiting until the next workout.

## Problem Statement

Failure is only addressed retroactively today. The performance adjuster acts after the session ends, adjusting future sessions. Nothing happens to the sets that remain in the current session, even though the body has already signalled that the planned load is wrong for today.

**Pain points:**
- After failing a set, the lifter faces a choice with no good options: push through knowing they'll fail again, or self-manage by eye with no system support
- Grinding through repeated failed attempts produces junk volume — high fatigue, low stimulus — the opposite of productive training
- The disconnect between what just happened and what the system is still asking erodes trust in the program
- The current architecture already treats soreness, disruptions, and RPE history as body-state signals that should produce an immediate response. A failed set is the same class of signal and should be handled the same way

**Desired outcome:** The session responds to what is actually happening in the gym, not only to what was planned before the lifter walked in.

## User Experience

### User Flows

**Primary Flow — progressive fallback after a failed set:**

1. Lifter logs fewer reps than planned for a set (e.g., plans 5, hits 4)
2. The system recognises this as a failure and enters Tier 1
3. **Tier 1 — Extended rest**: The next set's rest period is automatically extended (+60 seconds). A brief rationale appears ("Extra rest — your body may need more recovery"). Many failures are fatigue, not a capacity ceiling; the extended rest gives the lifter a chance to hit the target on the next attempt
4. Lifter attempts the next set
5. If the lifter hits the target: the session continues normally; the extended rest was enough
6. If the lifter fails again: the system moves to Tier 2
7. **Tier 2 — Weight reduction**: The weight on all remaining sets is reduced by approximately 5% and the rep target is kept. A rationale appears ("Weight reduced — today's planned load is too heavy"). This is standard autoregulation: the body is telling us the load is wrong for today
8. Lifter continues through remaining sets at the reduced weight
9. If the lifter accumulates 3 or more consecutive failures across the session: the system moves to Tier 3
10. **Tier 3 — Set capping**: Remaining sets are marked optional. A rationale appears ("Remaining sets optional — continuing risks more fatigue than benefit"). The lifter can choose to stop the main lift and move to auxiliary work

**Alternative Flows:**

- Lifter fails only one set and recovers after extended rest: session continues at original plan; Tier 1 is the full response; no permanent changes to the session
- Lifter opts out of an optional set (Tier 3): the set is logged as skipped with an adaptation note; it is not counted as a failure in future performance analysis
- Multiple lifts in the same session: each main lift tracks its own failure state independently; a failure on squat does not trigger Tier 2 on bench press

### Visual Design Notes

- Tier 1 indicator: the rest timer displays the extended duration with a subtle visual difference from a normal rest (e.g., an "extended" label); the rationale is shown as a short line beneath the timer
- Tier 2 indicator: adapted sets show the new weight alongside the originally planned weight in a muted style, so the lifter can see at a glance what changed and why
- Tier 3 indicator: optional sets are visually distinguished (e.g., a dashed border or "Optional" badge); the rationale is shown at the top of the optional set group
- All rationale strings are plain language, not jargon — the lifter should immediately understand what the system did and why
- Adaptations are visible in session history after completion, showing the original plan alongside what actually happened

## User Benefits

**No more grinding through doomed sets**: The system responds to failure immediately, protecting the lifter from wasted effort on sets that have no productive training value.

**Protects against junk volume**: Preventing accumulated failed sets means the session ends with quality work rather than high fatigue and low stimulus — better outcomes for the same or less time in the gym.

**Builds trust in the program**: The system demonstrably "heard" what the lifter's body said and acted on it. That responsiveness is the core of the app's philosophy made visible in the moment when it matters most.

**Better data for future sessions**: Logged adaptations give the performance adjuster richer context. A failed set that the system handled with Tier 2 is a different signal than a failed set that required Tier 3 across three consecutive lifts.

## Open Questions

- [ ] Should auxiliary exercises trigger adaptation, or only main lifts? Aux exercises are lower stakes but lifters can still fail them — worth deciding whether to ignore or handle differently
- [ ] Should the Tier 2 weight reduction scale with how badly the set was missed (1 rep short vs 3 reps short), or is a fixed ~5% reduction simpler and equally effective?
- [ ] Should the system learn a lifter's personal failure patterns over time and pre-adapt future sessions based on historical failure tendency at a given load?
- [ ] Should Tier 1 (extended rest) also be available as a manual request — i.e., the lifter can tap "I need more time" even without a logged failure?

## Future Enhancements

**Phase 2:**
- LLM strategy provides smarter adaptation reasoning — interpreting a failure in context (poor sleep the night before, high soreness, early in a heavy block) rather than applying a fixed tier response
- Cross-session failure pattern detection: if the same weight is failed two sessions in a row, the performance adjuster is pre-seeded with a weight-reduction suggestion before the third session

**Long-term:**
- Substitution suggestions at Tier 3: instead of just marking sets optional, the system suggests an alternative movement with lower fatigue cost that trains the same pattern
- Failure rate dashboard in history: visualise how often each lift triggers adaptation tiers over time

## References

- Related Design Docs: [training-engine-architecture.md](./training-engine-architecture.md) (JIT strategy pattern, RPE autoregulation)
- Related Design Docs: [volume-management.md](./volume-management.md) (MRV/MEV hard constraints)
- Related Design Docs: [disruption-management.md](./disruption-management.md) (body-state signal architecture)
- Related Design Docs: [body-state-readiness.md](./body-state-readiness.md) (sleep/energy signals processed the same way)
- Helms, E.R. et al. (2016) — RIR-based RPE scale and autoregulation methods
- GitHub Issue: #76
