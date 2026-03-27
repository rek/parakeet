# Feature: Prescription Trace Integration

**Status**: Draft

**Date**: 18 Mar 2026

## Overview

`PrescriptionTrace` is generated and stored (`sessions.jit_output_trace` JSONB) for every JIT session. It captures the full decision chain: weight derivation (1RM x blockPct x modifiers), volume changes per adjuster, auxiliary selection reasoning, warmup steps, and rest derivation.

The trace is currently an audit trail. This doc defines how it becomes a **closed feedback loop** — the system learns from trace + outcome data to improve future prescriptions automatically.

## Problem Statement

Per intent.md: "More signals = better sessions. Every data point makes the next workout more accurate."

The trace + session outcome is a signal pair that isn't being used. If the system prescribed ×0.85 intensity for soreness and the athlete easily hit RPE 6 (target 8), that's evidence the modifier was too aggressive for _this athlete_. The system should learn from that — not repeat the same miscalibration next session.

Current blind spots:

- Modifier thresholds are hardcoded defaults — soreness level 5–6 always gives the same reduction regardless of athlete history
- No feedback loop: the system doesn't know whether its adjustments were appropriate
- The LLM reviewers (judge, replay, cycle review) see inputs and outputs but not the reasoning between them

## Architecture: Auto-Calibration → LLM Review → User Confirmation

### Layer 1: Auto-Calibration Engine (automatic, silent)

After every session completion, compare trace predictions vs actual outcomes:

**Input:** `PrescriptionTrace.mainLift.weightDerivation.modifiers[]` + `session_logs.session_rpe` + `session_logs.actual_sets[].rpe_actual`

**Per-modifier tracking:**

```
For each modifier source (soreness, readiness, cycle_phase, disruption):
  - What multiplier was applied? (e.g., ×0.85)
  - What was the predicted RPE? (target from planned sets)
  - What was the actual RPE?
  - Delta: actual - target (negative = too easy, positive = too hard)
```

**Accumulate over sessions into a calibration profile per user:**

```
modifier_calibration:
  soreness:
    samples: [{ level: 3, multiplier: 0.85, rpe_delta: -2.0 }, ...]
    current_bias: -1.2  (consistently too easy → modifier too aggressive)
    suggested_adjustment: +0.07  (use ×0.92 instead of ×0.85)
    confidence: 'medium' (12 samples)
  readiness:
    samples: [...]
    current_bias: +0.3  (slightly too hard → modifier about right)
    suggested_adjustment: 0
    confidence: 'high' (20 samples)
```

**Confidence thresholds:**

- < 5 samples: `exploring` — no adjustment proposed
- 5-10 samples: `low` — propose but don't apply
- 10-20 samples: `medium` — propose, apply if small (< 5% change)
- 20+ samples: `high` — apply automatically for small adjustments

**Storage:** `modifier_calibrations` table (user_id, modifier_source, soreness_level, sample_count, current_bias, suggested_adjustment, confidence, last_updated)

**When applied:** At JIT time (Step 2b/2c/3/5), the modifier functions check the calibration table. If a per-athlete adjustment exists with sufficient confidence, apply it on top of the default modifier.

### Layer 2: LLM-Mediated Review (for significant or low-confidence changes)

When the auto-calibration system proposes a **significant adjustment** (>5% change) or has **low confidence**, route through an LLM review before applying:

**Trigger conditions:**

- Suggested adjustment > ±5% from default
- Bias direction flipped (was too easy, now too hard)
- Insufficient samples for the adjustment magnitude
- Multiple modifier sources shifting simultaneously

**LLM review receives:** Calibration data + recent trace summaries. Returns `{ apply, confidence, askUser, reason }`.

If `askUser: true`, the system queues a prompt for the athlete.

### Layer 3: User Confirmation (for big changes or low LLM confidence)

When the LLM flags `askUser: true`, the system surfaces a card on the Today screen:

> "We've noticed your soreness adjustments have been too conservative — you consistently perform better than expected when sore. We'd like to reduce the soreness intensity cut from 15% to 8%. This is based on 15 sessions where you averaged RPE 6.5 (target 8) when this adjustment was active."
>
> **[Sounds right]** **[Not sure — let's discuss]** **[Keep current]**

**"Not sure — let's discuss"** opens a brief LLM conversation where the athlete can add context: "I've been sleeping more recently" or "I switched to a softer bar" — factors the system can't observe. The conversation output feeds back into the calibration decision.

## Implementation Phases

### Phase A: Modifier Effectiveness Tracker (engine, pure TS)

New file: `packages/training-engine/src/analysis/modifier-effectiveness.ts`

- `recordModifierOutcome({ modifierSource, multiplier, rpeTarget, rpeActual, sorenessLevel? })` — accumulates a sample
- `computeCalibrationBias({ samples })` — returns `{ bias, suggestedAdjustment, confidence }`
- `shouldTriggerReview({ adjustment, confidence })` — returns `boolean`

### Phase B: Calibration Storage + JIT Integration

- Migration: `modifier_calibrations` table
- Wire into session completion: extract trace modifiers + actual RPE, update calibration
- Wire into JIT: each modifier step checks calibration table for per-athlete adjustment

### Phase C: LLM Review Gate

New file: `packages/training-engine/src/review/calibration-reviewer.ts`

LLM reviews proposed adjustments above the auto-apply threshold.

### Phase D: User Confirmation UI

Today screen card for significant proposals. Three actions: Accept / Discuss / Reject.

## How This Fulfills Intent.md

| Intent Principle                  | How This Delivers                                                |
| --------------------------------- | ---------------------------------------------------------------- |
| "More signals = better sessions"  | Trace + RPE outcome = new signal that improves modifier accuracy |
| "Synchronize with the real human" | User confirmation catches factors the system can't observe       |
| "Leverage improving LLMs"         | LLM reviews calibration proposals; better models = better review |
| "JIT over pre-generated"          | Calibration adjustments apply at JIT time, not pre-computed      |
| "Engine is pure domain logic"     | All calibration logic in training-engine, no React deps          |

## Data Requirements

- Minimum 5 sessions with a given modifier active before any proposal
- Minimum 10 for auto-apply of small adjustments
- Minimum 20 for high-confidence assessment
- Typical user: ~3 sessions/week → 5 samples in ~2 weeks, 20 in ~7 weeks

---

## Other Trace Consumers (lower priority, independently shippable)

These items add value but don't close the feedback loop:

### Dashboard visibility

- JIT Logs: weight derivation chain + modifier list per session
- Workout Summaries: color-coded modifier badges (green/amber/red)

### LLM prompt enrichment

- Judge Reviewer: pass trace for modifier validation
- Decision Replay: trace-aware scoring (bad formula vs bad execution)
- Cycle Review: modifier frequency aggregation across cycle
- Motivational Message: "You trained through ×0.9 soreness and hit RPE 8"

### Athlete-facing insights

- Weekly Body Review: volume shortfall breakdown by modifier source
- Trace-based badges: "Clean Sheet" (10 sessions, no modifiers), "Resilient" (modifiers active, RPE on target)

## References

- Design: [prescription-reasoning.md](./prescription-reasoning.md) — trace system design (Phases 1-4)
- Spec: [engine-040-prescription-trace.md](../specs/04-engine/engine-040-prescription-trace.md) — engine implementation
- AI overview: [ai-overview.md](./ai-overview.md) — LLM consumer architecture
