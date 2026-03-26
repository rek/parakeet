# Feature: Intra-Session Adaptation

**Status**: Partially Implemented (upward autoregulation + RPE scaler fix shipped; downward tiers planned)

**Date**: 11 Mar 2026 (revised 26 Mar 2026)

> **Design Doc Philosophy**: This document describes WHAT the feature does and WHY, from a user perspective. Technical implementation details (HOW) are tracked in specs for granular task management. Keep this doc user-focused, concise, and free of code/implementation specifics.

## Overview

The system currently prescribes a session before the lifter starts and waits until the next session to adjust. Nothing happens between sets — if a set is too easy the next set stays the same weight, and if a set fails the lifter grinds through unchanged targets. Intra-Session Adaptation treats every logged set as a signal and responds immediately: increasing weight when RPE is below target, and progressively reducing load when the lifter fails. The session self-corrects in real time.

## Problem Statement

### The Upward Problem: Too-Easy Sessions

Production data (GH#130) shows a bench explosive session where every set — main lift and auxiliaries — landed at RPE 6.0–6.5 against a 7.0 target. Under the RPE-to-effective-sets curve, RPE < 7.0 counts as 0.15 per set. An entire bench session produced **0.9 effective chest sets** — 11% of weekly MEV. The lifter did the work, felt it was a real session (session RPE 7.0), but the volume accounting says it was nearly worthless.

The system had every signal it needed after set 1 (RPE 6.5, target 7.0) to suggest +5kg for set 2. Instead it prescribed the same weight again. The lifter logged another RPE 6.5 set and moved on to auxiliaries that were also too light.

Existing correction mechanisms fail here:
- **Step 2 RPE adjustment**: only fires when the average gap across the last 2 sessions is ≥ 1.0; this user's average is -0.875 — just under threshold. Even when it fires, +2.5% intensity adds ~2kg. Not enough.
- **Adaptive volume calibration (#117)**: adds sets, not weight. More sets at RPE 6.5 = more sets at 0.15 multiplier = still negligible.
- **Working 1RM**: computing e1RM from sub-target-RPE sets yields a *lower* 1RM than stored, making future sessions lighter (perverse outcome).
- **Volume recovery**: adds sets back when RPE is below target, but only sets that were previously removed by modifiers. Does not adjust weight.

### The Downward Problem: Failed Sets

When a lifter fails a set, the remaining sets stay unchanged — leaving the lifter to grind through targets their body just told them it cannot hit. Failure is only addressed retroactively by the performance adjuster after the session ends.

**Pain points (both directions):**
- The system watches a too-easy or too-hard set, then prescribes the exact same weight for the next set — a coach would never do this
- Too-easy sets produce dead volume: high effort perception, negligible effective volume toward MEV
- Failed sets produce junk volume: high fatigue, low stimulus
- Both erode trust: the disconnect between what just happened and what the system is still asking makes the program feel unresponsive
- The current architecture treats soreness, disruptions, and RPE history as body-state signals that produce immediate responses. In-session RPE is the same class of signal and should be handled the same way

**Desired outcome:** The session responds to what is actually happening in the gym, not only to what was planned before the lifter walked in.

## User Experience

### Upward Autoregulation — RPE Below Target

**Primary Flow — weight increase suggestion after an easy set:**

1. Lifter completes a set and logs RPE
2. System compares actual RPE to target RPE
3. If RPE is ≥ 1.0 below target: system suggests a weight increase for the next set
4. The suggestion appears inline on the next set card — not a modal or popup
5. The lifter can accept (tap the suggested weight) or dismiss (keep current weight)
6. If accepted: remaining sets update to the new weight; the adaptation is logged
7. After the session, adapted weights feed into working 1RM and RPE trend calculations with correct context (the system knows the weight was adjusted mid-session, not prescribed)

**Suggestion logic:**

| RPE gap (target - actual) | Suggestion |
|--------------------------|------------|
| ≥ 1.0 | +2.5 kg (bench/OHP) or +5 kg (squat/deadlift) |
| ≥ 1.5 | +5 kg (bench/OHP) or +10 kg (squat/deadlift) |
| < 1.0 | No suggestion (within acceptable tolerance) |

These increments match available plate combinations. Rounded to nearest 2.5 kg as per existing weight rounding.

**When NOT to suggest an increase:**
- Recovery mode (soreness ≥ 9/10) — the weight is intentionally light
- Deload week — the weight is intentionally light
- Lifter already adjusted weight on a previous set this session (avoid cascading adjustments)
- Remaining sets is 0 (last set — too late to adjust)

**Auxiliary exercises:**
- Same logic applies to aux exercises, but only for weighted exercises (not bodyweight/timed)
- Aux weight adjustments are independent of main lift adjustments

### Downward Autoregulation — Failed Sets

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

**Upward suggestions:**
- The next set card shows a suggested weight below the current weight, styled as an actionable chip: "Try 82.5 kg?" with a tap to accept
- If accepted, the weight updates and a small "Adjusted ↑" indicator persists on the set card
- Dismissing is implicit — the lifter just starts the set at the original weight

**Downward adaptations:**
- Tier 1 indicator: the rest timer displays the extended duration with a subtle visual difference from a normal rest (e.g., an "extended" label); the rationale is shown as a short line beneath the timer
- Tier 2 indicator: adapted sets show the new weight alongside the originally planned weight in a muted style, so the lifter can see at a glance what changed and why
- Tier 3 indicator: optional sets are visually distinguished (e.g., a dashed border or "Optional" badge); the rationale is shown at the top of the optional set group

**Both directions:**
- All rationale strings are plain language, not jargon — the lifter should immediately understand what the system did and why
- Adaptations are visible in session history after completion, showing the original plan alongside what actually happened

## RPE-to-Effective-Sets Curve Fix (Implemented — engine-044)

The RPE scaler previously used a step function that created a 4.3× cliff at RPE 7.0 (6.9 → 0.15, 7.0 → 0.65). This was replaced with piecewise linear interpolation between anchor points in engine-044.

Current anchor points: 6.0 → 0.15, 6.5 → 0.30, 7.0 → 0.65, 8.0 → 0.85, 9.0 → 1.0. Below 6.0 → 0.0. Above 9.0 → 1.0. Values between anchors are linearly interpolated (e.g., RPE 7.5 → 0.75, RPE 8.5 → 0.925).

See [domain/muscle-mapping.md](../domain/muscle-mapping.md#rpe-to-effective-sets-curve) for the full anchor table and research basis.

## Interaction with Existing Systems

| System | Interaction |
|--------|-------------|
| Volume recovery | Upward autoregulation makes volume recovery less likely to fire (sets are closer to target RPE). If both fire, they stack: autoregulation adjusts weight, volume recovery adds sets. |
| Adaptive volume calibration (#117) | Complementary: Step 0 adjusts set count, autoregulation adjusts weight. Together they close both the volume and intensity gaps. |
| Working 1RM (engine-042) | Autoregulation-adjusted weights at target RPE feed clean data into working 1RM. Solves the perverse outcome where sub-target-RPE sets produce artificially low e1RM. |
| Step 2 RPE adjustment | Autoregulation reduces the cross-session RPE gap that Step 2 tries to correct. Step 2 becomes a safety net for patterns that autoregulation doesn't catch (e.g., the lifter dismisses all suggestions). |
| Prescription trace | Adaptations logged in trace with original and adjusted values, enabling retrospective analysis. |
| Explosive day philosophy | Explosive sessions use intentionally light weight for bar speed. Upward autoregulation uses the same RPE gap threshold — if the lifter genuinely hits RPE 7.0 at the prescribed weight, no suggestion fires. The suggestion only fires when the weight is too light even for the "light" target. |

## User Benefits

**Sessions self-correct to the right intensity**: Instead of logging an entire session at the wrong weight, the system adjusts after the first set. A coach watching your set would say "add 5kg" — the app should too.

**Volume accounting becomes accurate**: Sets at autoregulated weights hit target RPE, counting as full effective sets (0.65–1.0) instead of dead volume (0.15). Weekly MEV gaps shrink.

**Working 1RM gets clean data**: Logged weights at appropriate RPE feed accurate e1RM calculations, preventing the drift that occurs when sub-target-RPE data accumulates.

**No more grinding through doomed sets**: The system responds to failure immediately, protecting the lifter from wasted effort.

**Builds trust in the program**: The system demonstrably responds to what is happening right now. That responsiveness is the core of the app's philosophy made visible in the moment when it matters most.

## Open Questions

- [ ] Should upward suggestions fire after set 1, or require 2 consecutive under-RPE sets? Set 1 often feels lighter ("warming in"), but waiting for set 2 means half the session is already done for 2-set prescriptions
- [ ] Should explosive days use a larger RPE gap threshold (e.g., ≥ 1.5 instead of ≥ 1.0) to respect the speed-work philosophy?
- [ ] Should auxiliary exercises trigger upward autoregulation, or only main lifts?
- [ ] Should the Tier 2 weight reduction scale with how badly the set was missed (1 rep short vs 3 reps short), or is a fixed ~5% reduction simpler and equally effective?
- [ ] Should the system learn a lifter's personal patterns over time and pre-adapt future sessions based on historical tendency at a given load?
- [ ] Should Tier 1 (extended rest) also be available as a manual request — i.e., the lifter can tap "I need more time" even without a logged failure?

## Future Enhancements

**Phase 2:**
- LLM strategy provides smarter adaptation reasoning — interpreting RPE undershoot or failure in context (poor sleep, high soreness, early in a heavy block) rather than applying fixed rules
- Cross-session pattern detection: if explosive bench consistently undershoots, the performance adjuster is pre-seeded with a higher base %1RM suggestion

**Long-term:**
- Substitution suggestions at Tier 3: instead of just marking sets optional, the system suggests an alternative movement with lower fatigue cost that trains the same pattern
- Adaptive increment sizing: the system learns how much weight to suggest based on historical RPE response to weight changes for each lifter and lift
- Wearable velocity integration: bar speed data from wearables could supplement RPE for more objective autoregulation signals

## References

- Related Design Docs: [adaptive-volume.md](./adaptive-volume.md) (volume calibration, Step 0)
- Related Design Docs: [training-engine-architecture.md](./training-engine-architecture.md) (JIT strategy pattern)
- Related Design Docs: [volume-management.md](./volume-management.md) (MRV/MEV hard constraints)
- Related Design Docs: [disruption-management.md](./disruption-management.md) (body-state signal architecture)
- Related Design Docs: [body-state-readiness.md](./body-state-readiness.md) (sleep/energy signals)
- Domain: [muscle-mapping.md](../domain/muscle-mapping.md) (RPE-to-effective-sets curve, strength implication caveat)
- Domain: [session-prescription.md](../domain/session-prescription.md) (JIT pipeline steps, volume recovery)
- Domain: [references.md](../domain/references.md) (Robinson/Refalo 2024 — proximity to failure meta-regression)
- Helms, E.R. et al. (2016) — RIR-based RPE scale and autoregulation methods
- GitHub Issue: #76 (original intra-session adaptation)
- GitHub Issue: #130 (volume below MEV — intensity root cause)
