# Feature: Training Engine Architecture

**Status**: Planned

**Date**: 2026-02-22

## Overview

The training engine computes a concrete workout (weights, sets, reps) for each session. It sits between the data layer (Supabase — lifts logged, soreness checked, volume tracked) and the display layer (session screen). The engine is designed as a **pluggable strategy system**: the data collection and display layers are completely decoupled from how the workout is generated, allowing formula-based, LLM-based, and hybrid approaches to be swapped or run side-by-side without touching any other part of the app.

## Progressive Overload: Theoretical Assumptions

The engine operationalises three dimensions of progressive overload. All three must increase over time for adaptation to continue — increasing only one eventually hits a ceiling.

### 1. Load (Weight)

Linear load progression works for novices but fails for intermediate lifters within 4–6 weeks. The body habituates to a fixed stimulus faster than connective tissue tolerance can increase (Selye, 1950 — General Adaptation Syndrome; Bompa & Haff, 2009 — *Periodization*). Concurrent periodization (the Cube Method's Heavy/Explosive/Rep rotation) solves this by ensuring the primary lift experiences maximal, sub-maximal, and volume stimuli within every weekly rotation — continued adaptation without strict linear load increase.

**RPE as load autoregulation:** If actual RPE consistently exceeds the session target, the prescribed load exceeds the lifter's current capacity. The JIT generator uses this signal to adjust intensity. This is consistent with validated autoregulation methods (Helms et al., 2016; Zourdos et al., 2016 — RIR-based RPE scale in *J Strength Cond Res*).

### 2. Volume (Sets × Reps)

Volume has a dose-response relationship with adaptation: more weekly sets per muscle group produce greater strength and hypertrophy gains up to the point of overreaching (Schoenfeld et al., 2017 — *J Strength Cond Res* meta-analysis). This creates two hard bounds:

- **MEV (Minimum Effective Volume):** Below this threshold, training stimulates no meaningful adaptation. Weeks below MEV are wasted training time.
- **MRV (Maximum Recoverable Volume):** Above this threshold, fatigue accumulates faster than adaptation. The lifter is digging a hole, not building fitness.

**Engine assumption:** Volume should build progressively across a block from near-MEV toward MRV, then drop sharply in a deload to clear accumulated fatigue before repeating. MEV/MRV caps in JIT generation are non-negotiable hard gates, not soft hints — violating them undermines the overload model rather than extending it.

### 3. Time Between Work (Recovery Density)

The most underweighted dimension: *when* a session occurs relative to the previous stimulus determines whether new work hits a muscle during supercompensation or re-accumulates fatigue. Two time signals drive the engine:

**Between sessions:** Skeletal muscle requires 48–72 hours minimum to complete the primary acute recovery response after a demanding session (Kraemer & Ratamess, 2004 — *Med Sci Sports Exerc*; ACSM Position Stand, 2009). Sessions arriving too late (> 7 days since last session of a lift) trigger a conservative intensity modifier — the supercompensation window has passed and the lifter is closer to baseline than to a primed state.

**Within sessions (rest intervals):** Rest periods > 2 minutes between sets produce significantly greater strength gains than shorter rest in trained populations (Grgic et al., 2018 — *Sports Med* systematic review). This informs the default rest timer targets (2–3 min for main compound lifts).

### Supercompensation — The Unifying Model

All three dimensions feed into a single underlying model: **supercompensation** (Selye's GAS, 1950). A session imposes stress → acute fatigue temporarily drops performance → given adequate recovery, fitness rises above the pre-training baseline → if the next session arrives during this supercompensation window, adaptation continues upward.

**Critical assumption:** Parakeet cannot directly measure physiological recovery (no HRV, no lactate). It uses proxy signals — soreness ratings, RPE history, `daysSinceLastSession` — as approximations of where the lifter sits on the recovery-adaptation curve. These proxies are evidence-based but imperfect. A lifter who consistently logs RPE and soreness gives the engine much stronger signals than one who skips check-ins.

## The Core Problem: Modifier Stacking

The naive approach to multi-variable adjustment is a sequential pipeline where each variable applies its own multiplier:

```
Base weight: 112.5kg
× 0.975  (RPE trend above target)
× 0.950  (soreness modifier)
× 0.800  (minor disruption active)
= 83.4kg  ← 74% of base
```

Each modifier is blind to the others. The same underlying state — a minor injury causing soreness and elevated RPE — is penalised three times. A human coach would say: "You have an injury. Use the injury protocol. The soreness and RPE trend are symptoms of the same problem."

This stacking failure gets dramatically worse as the variable count grows. With ~43 inputs feeding into JIT generation (and more planned — sleep, HRV), a pipeline that treats each variable independently cannot produce coherent output.

The architecture described here addresses this by separating **what to compute** (the Cube Method structural formula — always deterministic) from **how much to adjust** (the modifier reasoning — which can be formula rules, an LLM, or both).

## System Boundaries

```
┌──────────────────────────────────────────┐
│              Data Layer                   │
│  (Supabase — unchanged regardless of     │
│   which strategy generates the session)  │
│                                          │
│  session_logs · lifter_maxes             │
│  soreness_checkins · weekly_volume       │
│  disruptions · warmup_configs            │
│  sleep_data (future) · hrv (future)      │
└──────────────┬───────────────────────────┘
               │ JITInput
               ▼
┌──────────────────────────────────────────┐
│           Generator Layer                 │
│                                          │
│  ┌──────────────┐  ┌──────────────────┐  │
│  │   Formula    │  │      LLM         │  │
│  │  Strategy    │  │    Strategy      │  │
│  └──────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────┐ │
│  │         Hybrid Strategy              │ │
│  └──────────────────────────────────────┘ │
│          ▲ JITGeneratorRegistry           │
└──────────┬───────────────────────────────┘
           │ JITOutput
           ▼
┌──────────────────────────────────────────┐
│            Display Layer                  │
│  (session screen — receives JITOutput    │
│   with no knowledge of which strategy    │
│   generated it)                          │
└──────────────────────────────────────────┘
```

## The Full Variable Set

These are all inputs that should inform session generation. The `JITInput` struct carries all of them. New signals are added as optional fields — existing strategies continue working; LLM strategy automatically benefits from new context.

**Session structure (deterministic — drives the Cube Method base calc):**
- `primaryLift` — Squat / Bench / Deadlift
- `blockNumber` — 1, 2, or 3
- `intensityType` — Heavy / Explosive / Rep / Deload
- `weekNumber`

**Current maxes:**
- `oneRmKg` — most recent estimated 1RM for this lift

**Formula config:**
- `formulaConfig` — block × intensity type parameters (Formula strategy uses directly; LLM gets as context)

**Recovery signals:**
- `sorenessRatings` — per muscle group, 1–5 scale (3 primary muscles per session)
- `auxiliarySorenessRatings` — per muscle group for aux exercise selection
- `rpeHistory` — last 6 sessions for this lift (short + medium trend)
- `daysSinceLastSession` — recency signal; handles missed workout impact
- `menstrualPhase` — follicular / ovulatory / luteal / late_luteal / menstrual (female users, optional)

**Volume context (9 muscle groups × 3 values each):**
- `weeklyVolumeToDate` — sets accumulated this week per muscle
- `mrvMevConfig` — thresholds per muscle (sex-differentiated defaults)

**External disruptions:**
- `activeDisruptions` — type, severity, affected lifts, duration

**Configuration:**
- `warmupConfig` — warmup protocol for this lift
- `activeAuxiliaries` — 2 exercises assigned for this block
- `biologicalSex` — male / female / unknown (drives MRV/MEV defaults)

**Future signals (optional fields, already in the struct):**
- `sleepHours`, `sleepQuality` — Phase 2
- `hrvScore` — Long-term
- `bodyWeightKg` — already collected at cycle start

Total: ~43 meaningful input values today, extensible without breaking existing strategies.

## The Generator Interface

```typescript
interface JITGeneratorStrategy {
  readonly name: 'formula' | 'llm' | 'hybrid'
  readonly description: string
  generate(input: JITInput): Promise<JITOutput>
}
```

A `JITGeneratorRegistry` reads the active strategy from app settings and calls `generate()`. The session screen receives only `JITOutput` — it never knows which strategy ran. Each session row in Supabase stores `jit_strategy` so outputs can be compared over time.

## Hard Constraints

These apply regardless of which strategy runs. They are enforced by a validation layer after the strategy returns its output:

| Constraint | Rule |
|---|---|
| MRV cap | If weekly volume ≥ MRV for any primary muscle, skip main lift. Non-negotiable. |
| Weight floor | Generated weight cannot be < 40% of the formula base weight. Guards against LLM hallucination. |
| Minimum sets | If main lift is not skipped, minimum 1 working set. |
| Weight rounding | All weights rounded to nearest 2.5kg. |
| Warmup | Always formula-generated from working weight. No strategy overrides warmup. |

## Three Strategy Implementations

### Strategy 1: Formula (FormulaJITGenerator)

The formula engine handles all adjustment reasoning through explicit rules. The current pipeline is corrected to eliminate stacking:

**Precedence rules (applied in priority order, not multiplicatively):**
1. If active disruption: apply disruption protocol. Stop. Do not apply RPE or soreness modifiers on top.
2. If soreness ≥ 5 (severe): recovery session (40% × 3×5). Stop.
3. If soreness = 4: apply soreness reduction. Skip RPE modifier (soreness may be causing the RPE pattern).
4. If soreness ≤ 3 AND RPE pattern detected: apply RPE modifier independently.
5. MRV cap applied last (hard constraint layer).

**Additional inputs handled:**
- `daysSinceLastSession > 7` → apply conservative recency modifier (treat like mild disruption for volume, not intensity)
- `menstrualPhase === 'late_luteal'` → raise effective soreness tier by 1 for primary muscles (late luteal is physiologically equivalent to mild additional fatigue)
- Per-muscle `auxiliarySoreness` → selectively skip or reduce aux exercises for high-soreness muscles while keeping others at full volume

**Total reduction cap:** intensity cannot drop below 60% of base formula weight; sets cannot drop below 1. Prevents catastrophic stacking from edge cases.

**Characteristics:** Fully offline. Deterministic. Same inputs always produce same output. Easy to unit-test. Best used as the offline fallback and v1 default.

### Strategy 2: LLM (LLMJITGenerator)

The LLM handles all adjustment reasoning holistically. It receives the full `JITInput` as structured JSON context and returns a `JITAdjustment` struct. The formula engine applies the adjustment to the base calculation and enforces hard constraints.

**What the LLM owns:**
```typescript
interface JITAdjustment {
  intensityModifier: number           // e.g. 0.88 — multiplied against base %
  setModifier: number                 // e.g. -1 — delta on base set count
  skipMainLift: boolean
  auxOverrides: Record<string, 'skip' | 'reduce' | 'normal'>
  rationale: string[]                 // plain-language, shown to user
  confidence: 'high' | 'medium' | 'low'
}
```

**What the formula engine always owns (LLM cannot override):**
- Base weight calculation: `Cube % × 1RM`
- MRV cap (hard constraint validation)
- Weight rounding
- Warmup generation

**Prompt design:** Structured JSON context, not free-form prose. Small payload. System prompt instructs the LLM to output only valid JSON. Output is parsed and validated; parsing failure falls back to Formula strategy.

**Example LLM context:**
```json
{
  "lift": "squat", "block": 2, "intensityType": "Heavy",
  "oneRmKg": 140, "baseWeightKg": 119, "baseSets": 2, "baseReps": 3,
  "soreness": { "quads": 3, "glutes": 2, "lower_back": 4 },
  "rpeLastTwoSessions": [9.6, 9.4], "rpeTarget": 9.0,
  "daysSinceLastSquat": 11,
  "menstrualPhase": "late_luteal",
  "weeklyQuadSets": 16, "mrvQuads": 20,
  "activeDisruption": { "type": "injury", "severity": "minor", "lift": "squat" },
  "sleepHours": 5.5,
  "biologicalSex": "female"
}
```

The LLM can reason: "Minor knee injury + high lower back soreness + late luteal phase + high RPE trend + 11 days since last session + only 4 hours sleep — these are not independent signals. The compound picture is: this lifter is significantly compromised today. Reduce intensity to ~80% of base and cap at 1 set."

**Timeout and fallback:** 5-second network timeout. On timeout or parse error, silently falls back to Formula strategy. User sees a formula-generated session; the `jit_strategy` field on the session row shows `formula_fallback`.

**New signals (sleep, HRV) slot in automatically:** Adding `sleepHours` to `JITInput` makes it appear in the LLM prompt with no code change to the strategy. Formula strategy must explicitly handle new fields; LLM strategy gets them for free.

**Characteristics:** Online required. ~2–3 second latency (acceptable — happens after soreness check-in). Handles complex variable interactions naturally. Best rationale text. Scales with new signals automatically.

### Strategy 3: Hybrid (HybridJITGenerator)

Runs both strategies and produces a comparison. Primary use is during the development and tuning phase to empirically discover where the strategies agree and disagree.

**Behaviour:**
1. Formula strategy runs first (fast, local baseline)
2. LLM strategy runs concurrently
3. If outputs agree within 10% on intensity and ±0 on set count: use LLM output (better rationale)
4. If outputs diverge by > 15% on weight: surface both to the user with explanations
5. Both outputs are logged to `jit_comparison_logs` for review

**Divergence example surfaced to user:**
> "Formula suggests 2 sets × 107.5kg (applied soreness + disruption adjustments)
> LLM suggests 1 set × 95kg (treating injury + luteal phase + sleep deficit as compound signal)
> Using LLM suggestion. [Switch to formula]"

**Characteristics:** Development tool. Not the default for production use. Enables empirical tuning of the formula strategy against LLM behaviour. After 6–8 weeks of data, clear patterns emerge about where to improve the formula rules.

## Developer Mode

Settings → Developer → JIT Strategy:
- `auto` (default) — LLM if online, Formula if offline
- `formula` — always Formula
- `llm` — always LLM
- `hybrid` — run both, show comparison card in session screen

The `jit_comparison_logs` table in Supabase stores full inputs and outputs from all strategies when running in hybrid mode. This table is truncated after 90 days (development data, not primary training record).

## Staged Rollout

**v1 — Formula Strategy only**
- Implement `JITGeneratorStrategy` interface and `JITGeneratorRegistry`
- `FormulaJITGenerator` with stacking fixes, recency factor, per-muscle aux soreness, menstrual phase input
- Add `jit_strategy` column to `sessions` table
- All data collection infrastructure built to populate the full `JITInput` struct (even fields not yet used)

**v1.5 — LLM Strategy**
- `LLMJITGenerator` with structured prompt, `JITAdjustment` output, timeout + fallback
- Default strategy: `auto`
- Replace rule-based performance adjuster with LLM for post-session suggestions
- Developer mode with strategy selector

**v2 — Hybrid + Extended Signals**
- `HybridJITGenerator` with comparison UI
- Add `sleepHours`, `sleepQuality` to `JITInput` (data collection spec required)
- `jit_comparison_logs` table + 90-day retention
- LLM strategy benefits from sleep data automatically; Formula strategy updated separately

## Implementation Status

### Planned

- `JITGeneratorStrategy` interface
- `JITInput` struct with full variable set (including optional future fields)
- `JITGeneratorRegistry` with strategy selection from settings
- `FormulaJITGenerator` (stacking-fixed, full variable coverage)
- `LLMJITGenerator` with structured prompt, validation, and fallback
- `HybridJITGenerator` with comparison logging
- Hard constraint validation layer (applied after any strategy)
- `jit_strategy` field on sessions table
- Developer settings screen for strategy selection
- `jit_comparison_logs` table (development builds)

## References

- Related Design Docs: [program-generation.md](./program-generation.md), [performance-logging.md](./performance-logging.md), [sex-based-adaptations.md](./sex-based-adaptations.md), [disruption-management.md](./disruption-management.md), [volume-management.md](./volume-management.md), [cycle-review-and-insights.md](./cycle-review-and-insights.md)
- Specs: [engine-007-jit-session-generator.md](../specs/04-engine/engine-007-jit-session-generator.md), [engine-005-performance-adjuster.md](../specs/04-engine/engine-005-performance-adjuster.md)
- Selye, H. (1950) — "Stress and the General Adaptation Syndrome" *BMJ* — supercompensation model
- Bompa, T. & Haff, G. (2009) — *Periodization: Theory and Methodology of Training* — concurrent periodization, stimulus habituation
- Kraemer, W.J. & Ratamess, N.A. (2004) — "Fundamentals of Resistance Training" *Med Sci Sports Exerc* — recovery windows, frequency
- ACSM (2009) — "Position Stand: Progression models in resistance training for healthy adults" *Med Sci Sports Exerc*
- Schoenfeld, B.J. et al. (2017) — "Dose-response relationship between weekly resistance training volume and increases in muscle mass" *J Strength Cond Res*
- Helms, E.R. et al. (2016) — "Application of the RIR-Based RPE Scale for Resistance Training" *Strength Cond J*
- Zourdos, M.C. et al. (2016) — "Novel Resistance Training-Specific RPE Scale Measuring Repetitions in Reserve" *J Strength Cond Res*
- Grgic, J. et al. (2018) — "Effects of Rest Interval Duration in Resistance Training on Measures of Muscular Strength" *Sports Med*
