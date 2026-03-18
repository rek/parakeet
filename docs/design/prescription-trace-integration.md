# Feature: Prescription Trace Integration

**Status**: Draft

**Date**: 18 Mar 2026

## Overview

`PrescriptionTrace` is generated and stored (`sessions.jit_output_trace` JSONB) for every JIT session. It captures the full decision chain: weight derivation (1RM x blockPct x modifiers), volume changes per adjuster, auxiliary selection reasoning, warmup steps, and rest derivation. Currently consumed only by the PrescriptionSheet UI (feature-flag gated).

This doc maps every system touchpoint where trace data adds value, prioritized by impact and feasibility.

## Problem Statement

The system makes dozens of decisions per session but most consumers (LLM reviewers, cycle reports, dashboard, badges) only see inputs and outputs — not the reasoning between them. This creates blind spots:

- **Judge Reviewer** flags divergence but can't validate *why* the formula made its choices
- **Cycle Review** sees volume trends but can't explain *which adjusters* drove shortfalls
- **Decision Replay** scores prescription accuracy but can't attribute blame (bad formula vs. bad execution)
- **Dashboard** shows raw numbers without modifier context
- **Weekly Body Review** shows "75% of MEV" without explaining the cause

The trace is the missing link between input context and prescription output.

## Integration Map

### Tier 1 — Low effort, high impact

#### 1. Dashboard: JIT Logs — trace breakdown

**What:** Add weight derivation chain, modifier list, and volume change sources to each JIT log entry.

**Why:** Currently shows opaque rationale strings. Trace shows the actual math: `1RM × blockPct × modifier1 × modifier2 = weight`.

**How:** Query already fetches `sessions.*`. Parse `jit_output_trace`, render modifier badges and derivation table in expanded row.

**File:** `apps/dashboard/src/app/JITLogs.tsx`

#### 2. Dashboard: Workout Summaries — modifier badges

**What:** Color-code sessions by modifier load (green = clean formula, amber = 1 modifier, red = 2+ modifiers). Expandable row shows modifier details.

**Why:** At a glance: "which sessions were adjusted and why?" Currently all rows look the same.

**How:** Parse trace modifiers, count, apply conditional styling.

**File:** `apps/dashboard/src/app/WorkoutSummaries.tsx`

#### 3. Judge Reviewer — trace context in prompt

**What:** Pass `PrescriptionTrace` as third arg to `reviewJITDecision(input, output, trace)`. LLM judge can validate: "Formula cut 2 sets for soreness — is that proportional to soreness level 3?"

**Why:** Judge currently sees input + output but not *why* the formula made its choices. With trace, it can detect double-penalties, missed interactions, over-aggressive modifiers.

**How:** Add optional param, extend `JUDGE_REVIEW_SYSTEM_PROMPT` with trace summary section.

**File:** `packages/training-engine/src/review/judge-reviewer.ts`

#### 4. Decision Replay — trace-aware scoring

**What:** Pass trace to `scoreDecisionReplay`. Scorer can attribute deviations: "formula over-reduced (soreness modifier too aggressive)" vs "prescription was correct, execution was off."

**Why:** Currently scores prescription vs actual without knowing *why* the prescription was shaped that way. Can't distinguish bad formula from bad day.

**How:** Add optional param, enrich replay prompt.

**File:** `packages/training-engine/src/review/decision-replay.ts`

---

### Tier 2 — Medium effort, high impact

#### 5. Cycle Review — modifier frequency analysis

**What:** Aggregate traces across a training cycle to produce modifier patterns:
- Frequency: "Soreness active on 8/12 squat sessions"
- Magnitude: "Readiness averaged ×0.92 when active"
- Interactions: "Sessions with both soreness AND disruption: 3"

**Why:** The cycle review LLM currently sees volume/RPE trends but can't explain *which adjusters* drove those trends. With modifier patterns, it can say: "Volume was throttled by soreness in weeks 3-4; consider earlier deload."

**How:**
- `assemble-cycle-report.ts` — fetch `jit_output_trace` from sessions, aggregate modifiers into new `CycleReport.modifierPatterns` field
- `prompts.ts` — add modifier pattern section to cycle review prompt
- New engine function: `aggregateTraceModifiers({ traces: PrescriptionTrace[] })`

**Files:**
- `packages/training-engine/src/review/assemble-cycle-report.ts`
- `packages/training-engine/src/ai/prompts.ts`

#### 6. Weekly Body Review — volume shortfall breakdown

**What:** When a muscle is below MEV, break down *why* using trace data across that week's sessions:
- "3 sessions planned, 2 had -1 set (soreness), 1 had aux skipped (MRV cap)"

**Why:** Currently shows "Chest: 75% of MEV" with no explanation. The trace knows exactly which adjusters removed which sets.

**How:** Join `sessions.jit_output_trace` with session logs for the week. Extract `volumeChanges` per session, group by source.

**Files:**
- `apps/parakeet/src/modules/body-review/`
- `apps/parakeet/src/app/(tabs)/session/weekly-review.tsx`

#### 7. Motivational Message — trace-aware context

**What:** Include modifier context in the post-workout LLM prompt: "You trained through a soreness adjustment today (×0.9) and still hit RPE 8."

**Why:** Generic encouragement vs specific recognition of what the athlete overcame. Trace provides the modifier context the LLM needs.

**How:** Read trace from Zustand store (already cached), extract active modifiers, add to motivational prompt.

**File:** `apps/parakeet/src/modules/session/application/motivational-message.service.ts`

---

### Tier 3 — Higher effort, compound value

#### 8. Modifier Effectiveness Tracking

**What:** For each modifier source, track calibration: "When readiness ×0.95 was applied, did the athlete hit target RPE?"

**Output:** Calibration scores per modifier: "Readiness: well-calibrated (82% hit target). Soreness: over-aggressive (45% hit target, 40% under — prescription too conservative)."

**Why:** Self-improving formula. The trace records what the formula did; session completion records the outcome. Connecting them reveals calibration drift.

**How:**
- New: `packages/training-engine/src/analysis/modifier-effectiveness.ts`
- Consumed by: cycle review prompt, developer suggestions
- Query: sessions with `jit_output_trace` + `session_logs.session_rpe`

#### 9. Trace-Based Badges

**Concepts:**
- **"Clean Sheet"**: 10 consecutive sessions with zero modifiers active
- **"Resilient"**: 5+ sessions with active modifiers where RPE still hit target
- **"Recovery Wisdom"**: Deload week traces show reduced intensity, next week RPE normalizes
- **"Adaptive"**: Completed sessions through 3+ different modifier types in one cycle

**How:** Follows existing badge checker pattern. New checkers query `jit_output_trace`.

**Files:**
- `packages/training-engine/src/badges/badge-catalog.ts`
- New checker files in `badges/checkers/`

#### 10. Automated Anomaly Detection

**What:** At session completion, scan trace for patterns suggesting formula miscalibration:
- "Prescribed ×0.85 for soreness 2, but athlete hit RPE 6 → soreness threshold too aggressive"
- "Top-up fired 3 sessions in a row for same muscle → MEV threshold may be too high"
- "Recovery mode triggered but athlete RPE was 7 → false positive"

**How:**
- New: `packages/training-engine/src/analysis/trace-anomaly-detector.ts`
- Wire into `completeSession` flow
- Output: `developer_suggestions` entries with trace-sourced evidence

---

## What Trace Answers That Nothing Else Can

| Question | Before Trace | With Trace |
|----------|-------------|-----------|
| Why was my weight lower today? | "Intensity modifier 0.92" | "1RM 140 × 85.7% = 120 → ×0.975 (sleep) → ×0.95 (soreness) = 112.5kg" |
| Is soreness adjustment too aggressive? | Can't tell | "45% of soreness-adjusted sessions had RPE below target" |
| Why was this muscle below MEV? | Volume number only | "2 sessions had -1 set (soreness), 1 had aux skipped (MRV cap)" |
| Did the disruption adjustment help? | Session RPE | "×0.9 applied → RPE 7.5 (target 8) → well-calibrated" |
| Which LLM decisions diverged from formula? | Divergence % | "Formula ×0.95 for cycle phase; LLM ignored it entirely" |

## Recommended Implementation Order

1. Dashboard JIT Logs + Workout Summaries (Tier 1, #1-2)
2. Judge Reviewer + Decision Replay (Tier 1, #3-4)
3. Cycle Review modifier aggregation (Tier 2, #5)
4. Motivational message context (Tier 2, #7)
5. Weekly body review breakdown (Tier 2, #6)
6. Modifier effectiveness tracking (Tier 3, #8)
7. Trace-based badges (Tier 3, #9)
8. Anomaly detection (Tier 3, #10)

Each item is independently shippable. Items 1-4 are highest value for lowest effort.

## References

- Design: [prescription-reasoning.md](./prescription-reasoning.md) — original trace system design
- Spec: [engine-040-prescription-trace.md](../specs/04-engine/engine-040-prescription-trace.md) — engine implementation
- AI overview: [ai-overview.md](./ai-overview.md) — LLM consumer architecture
