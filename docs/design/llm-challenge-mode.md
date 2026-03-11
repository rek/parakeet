# Feature: LLM Challenge Mode

**Status**: Draft

**Date**: 11 Mar 2026

> **Design Doc Philosophy**: This document describes WHAT the feature does and WHY, from a user perspective. Technical implementation details (HOW) are tracked in specs for granular task management. Keep this doc user-focused, concise, and free of code/implementation specifics.

## Overview

Use LLMs to validate, challenge, or improve the deterministic formula engine's JIT decisions. Rather than replacing the formula, this uses LLM reasoning as a quality signal — catching missed interactions, scoring decision quality, and building empirical data for formula tuning.

## Problem Statement

The formula engine follows explicit precedence rules (disruptions > soreness > RPE) and produces safe, deterministic output. But it can miss subtle multi-variable interactions:

- A soreness=3 + minor disruption + 6 days since last session might each be individually "fine" but collectively warrant more caution
- Auxiliary work might conflict with soreness patterns the formula handles per-muscle but not holistically
- Rest periods may not account for compounding fatigue signals

The hybrid strategy already runs formula + LLM in parallel and logs divergence, but it's a blunt instrument — it compares outputs without understanding _why_ they differ or _which is better_. We need smarter integration points.

## Selected Approaches

### 1. Post-Hoc Review Judge (async, proactive)

After the formula generates a session, an async LLM call reviews the (input, output) pair and returns a quality score with specific concerns. Runs during warmup — user never waits.

**User experience:**

- Formula runs instantly as today
- Background LLM review fires immediately after JIT persists to DB
- User starts warmup (3-5 minutes) — plenty of time for the ~5s LLM call
- If score < threshold (e.g. 70): a "Challenge" banner appears on the session screen with the concern (e.g. "High soreness on hamstrings but RDL aux wasn't reduced")
- User can tap to see the suggested adjustment and accept/dismiss
- If score ≥ threshold: nothing shown, session proceeds normally

**Why this approach:**

- Formula stays the primary decision-maker — judge only intervenes when something looks wrong
- Review is cognitively simpler than generation for the LLM — it's easier to spot a mistake than to make a decision from scratch, so accuracy is higher
- Catches the class of errors the formula is worst at: multi-variable interactions where each signal is individually mild but collectively significant
- The async pattern already exists in the codebase (motivational messages fire-and-forget after completion — this is the same pattern but after JIT generation)
- Subsumes #3 (Constraint Audit) entirely — a holistic review catches the same error classes plus novel ones that targeted checks would miss

**What the LLM receives:**

- Full JITInput (the same ~43 signals the formula saw)
- The formula's JITOutput (what it decided)
- The formula's rationale (why it decided that)

**What it returns:**

- Score (0–100)
- Verdict: accept or flag
- Concerns: specific issues found (max 3, concise)
- Suggested overrides: optional partial adjustments the user can accept

**Dashboard integration:** All reviews logged — score trends, common concern categories, flag rate over time.

---

### 2. Decision Replay Scoring (async, retrospective)

After a session is _completed_, compare what was prescribed vs actual outcomes. LLM scores whether the prescription was appropriate in hindsight using ground truth.

**User experience:**

- User completes session normally — no change to completion flow
- Async: system compares prescribed RPE/sets/weight vs what the user actually did and reported
- Score accumulates in a quality log (invisible to user — developer/dashboard only)
- Dashboard shows decision quality trends over time
- Over weeks, reveals systematic biases ("heavy squats consistently under-prescribed by ~5%")
- Insights surface patterns the formula should be updated to handle ("user consistently reduces volume on Mondays — possible weekend recovery pattern")

**Why this approach:**

- It's the only approach that uses _actual outcomes_ — everything else is an LLM judging another LLM's work. This uses what the human body actually did as the ground truth signal
- Answers the most important meta-question first: "is the formula actually producing good sessions?" Before building any real-time challenge system, you need to know if there's a problem to solve
- Zero latency impact — runs after session completion, same as motivational messages
- Leverages existing infra perfectly: `jit_input_snapshot` is already stored on every session, `session_logs` has actual RPE/sets/weight, the dashboard already has views for JIT data
- Builds a dataset that directly informs formula tuning: if replays consistently show the formula under-prescribes heavy squats by 5%, you fix the formula itself rather than bolting on an LLM corrector
- Aligns with intent.md's philosophy: "more signals = better sessions" — this creates a new signal (decision quality over time) rather than adding another opinion layer

**What the LLM receives:**

- JIT input snapshot (already stored on the session row)
- Prescribed output (planned_sets, aux work, rationale)
- Actual session logs: completed sets, actual RPE, actual weight, rest taken, sets skipped

**What it returns:**

- Prescription score (0–100): overall quality
- RPE accuracy: how close prescribed RPE targets were to actual
- Volume appropriateness: too_much / right / too_little
- Insights: specific observations about patterns or mismatches (max 5)

**Dashboard integration:** Decision quality trend line, per-lift breakdown, common insight categories, worst-scored sessions for manual review.

---

### Eliminated Approaches

**3. Constraint Audit** — Subsumed by #1 (Post-Hoc Judge). A holistic review catches the same targeted error classes plus novel ones. No reason to build focused checks when the full review runs async with no latency cost.

**4. Consensus Vote** — Median/majority voting produces averaged decisions, not better ones. When the formula is "right but different" from the LLM, the median is worse than either. Adds complexity without clear signal improvement.

**5. Adaptive Threshold** — Solves an optimization problem we don't have yet. Needs months of data before auto-switching logic is meaningful. The state management complexity (rolling windows, hysteresis) isn't justified until #2's replay data proves the formula actually drifts. Revisit after 50+ replay scores.

---

## How They Work Together

```
Session Start                              Session End
     │                                          │
     ▼                                          ▼
  Formula JIT ──► Persist ──► #1 Judge     Complete ──► #2 Replay
  (instant)       to DB       (async,       (user       (async,
                              ~5s)          action)     ~5s)
                    │                                     │
                    ▼                                     ▼
              User does                            decision_quality_logs
              warmup                               (dashboard trends)
                    │
                    ▼
              If flagged:
              Challenge banner
              on session screen
```

- **#1 catches issues before the user lifts** — proactive safety net
- **#2 learns from what actually happened** — retrospective intelligence
- Both are async, both are fire-and-forget, both log to dashboard
- Neither blocks the user or adds perceived latency
- #2's data over time validates whether #1's flags are actually useful

## References

- Spec: [ai-002-challenge-mode.md](../specs/10-ai/ai-002-challenge-mode.md)
- Related Design Docs: [ai-overview.md](./ai-overview.md), [training-engine-architecture.md](./training-engine-architecture.md)
- Existing infrastructure: hybrid JIT generator, `jit_comparison_logs` table, JIT input snapshot storage
