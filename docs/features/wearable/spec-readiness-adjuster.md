# Spec: Wearable Readiness Adjuster

**Status**: Planned
**Domain**: Training Engine

## What This Covers

A pure function that converts objective wearable recovery signals (HRV, resting HR, sleep, SpO2) into intensity and volume modifiers for the JIT pipeline. Replaces the subjective `getReadinessModifier` when wearable data is available. Applied at the same step (Step 2b) in `generateJITSession`.

## Tasks

### WearableReadinessInput type

**`packages/training-engine/src/adjustments/wearable-readiness-adjuster.ts`:**

- [ ] Define `WearableReadinessInput`:
  ```typescript
  interface WearableReadinessInput {
    hrvPctChange?: number       // % change from 7-day baseline (negative = worse)
    restingHrPctChange?: number // % change from 7-day baseline (positive = worse)
    sleepDurationMin?: number   // actual minutes slept last night
    deepSleepPct?: number       // % of total sleep in deep stage (0-100)
    spo2Avg?: number            // overnight SpO2 average (0-100)
    nonTrainingLoad?: number    // 0-3 scale: 0=sedentary, 1=light, 2=moderate, 3=heavy
    readinessScore?: number     // composite 0-100 (informational, not used for decisions)
  }
  ```
  - All fields optional — partial wearable data is valid
  - The function uses individual signals for decisions, not the composite `readinessScore`

### getWearableReadinessModifier function

**`packages/training-engine/src/adjustments/wearable-readiness-adjuster.ts`:**

- [ ] `getWearableReadinessModifier(input: WearableReadinessInput)` returning `ReadinessModifier` (same interface as existing readiness adjuster)

  Decision logic (applied in order, stacking multiplicatively on `intensityMultiplier`):

  **HRV assessment:**
  - `hrvPctChange <= -20` → `setReduction += 1`, `intensityMultiplier *= 0.95`, rationale: "HRV significantly below baseline"
  - `hrvPctChange` between -20 and -10 → `intensityMultiplier *= 0.975`, rationale: "HRV below baseline"
  - `hrvPctChange >= 10` → mark `hrvPositive = true` (used for boost check below)

  **Resting HR assessment:**
  - `restingHrPctChange >= 10` → `intensityMultiplier *= 0.975`, rationale: "Resting heart rate elevated"
  - `restingHrPctChange >= 15` → `setReduction += 1`, rationale appended: "significantly elevated"

  **Sleep assessment:**
  - `sleepDurationMin < 300` (5h) → `setReduction += 1`, `intensityMultiplier *= 0.95`, rationale: "Very short sleep"
  - `sleepDurationMin` between 300 and 360 (5–6h) → `intensityMultiplier *= 0.975`, rationale: "Short sleep"
  - `deepSleepPct < 15` (and `sleepDurationMin` is defined) → `intensityMultiplier *= 0.975`, rationale: "Low deep sleep percentage"

  **Non-training load assessment:**
  - `nonTrainingLoad === 3` → `intensityMultiplier *= 0.975`, rationale: "High non-training physical load"

  **Boost check (all must be true):**
  - `hrvPositive === true` AND `sleepDurationMin >= 420` (7h) AND `deepSleepPct >= 20`
  - AND no negative modifiers were applied above
  - → `intensityMultiplier *= 1.025`, rationale: "Strong recovery signals — boosted"

  **Caps:**
  - `setReduction` capped at 2 (wearable signals alone never remove more than 2 sets)
  - `intensityMultiplier` capped at floor 0.85 (wearable signals alone never reduce more than 15%)
  - These caps prevent wearable data from being overly aggressive — disruptions and soreness handle severe situations

  **SpO2 handling:**
  - SpO2 is NOT handled in this function. SpO2 < 94% triggers auto-disruption creation at the sync/recovery service layer (app module responsibility, not engine).

- [ ] `hasWearableData(input: WearableReadinessInput)` — returns `true` if at least one meaningful signal (`hrvPctChange`, `sleepDurationMin`, or `restingHrPctChange`) is defined
  - Used by the JIT generator to decide which adjuster to call

### JITInput extension

**`packages/training-engine/src/generator/jit-session-generator.ts`:**

- [ ] Add wearable fields to `JITInput`:
  ```typescript
  // Wearable recovery signals (engine-032) — supersede sleepQuality/energyLevel when present
  hrvPctChange?: number
  restingHrPctChange?: number
  sleepDurationMin?: number
  deepSleepPct?: number
  spo2Avg?: number
  nonTrainingLoad?: number
  readinessScore?: number
  ```

- [ ] In `generateJITSession`, modify Step 2b to dispatch between adjusters:
  ```typescript
  // Step 2b — Readiness adjustment
  // Prefer wearable data when available; fall back to subjective signals
  const wearableInput = {
    hrvPctChange: input.hrvPctChange,
    restingHrPctChange: input.restingHrPctChange,
    sleepDurationMin: input.sleepDurationMin,
    deepSleepPct: input.deepSleepPct,
    nonTrainingLoad: input.nonTrainingLoad,
  }
  const readinessModifier = hasWearableData(wearableInput)
    ? getWearableReadinessModifier(wearableInput)
    : getReadinessModifier(input.sleepQuality, input.energyLevel)
  ```
  - Rest of Step 2b logic (applying modifier) stays the same

### Composite readiness score formula

**`packages/training-engine/src/adjustments/readiness-score.ts`:**

- [ ] `computeReadinessScore(input: WearableReadinessInput)` → `number` (0–100)
  - Pure function, no side effects
  - Weighted formula:
    - HRV component (40% weight): map `hrvPctChange` to 0–100 (linear, -30% → 0, +15% → 100, clamped)
    - Sleep component (30% weight): map `sleepDurationMin` to 0–100 (linear, 240 → 0, 540 → 100, clamped) + deep sleep bonus (up to 10 points for >20%)
    - RHR component (20% weight): map `restingHrPctChange` to 0–100 (linear, +20% → 0, -10% → 100, clamped)
    - Load component (10% weight): map `nonTrainingLoad` to 0–100 (3 → 25, 2 → 50, 1 → 75, 0 → 100)
  - Missing signals: their weight is redistributed proportionally across available signals
  - This score is informational (stored on `recovery_snapshots`, surfaced in UI). The adjuster uses individual signals, not this composite.

### LLM JIT input enrichment

**`packages/training-engine/src/generator/llm-jit-generator.ts`:**

- [ ] Include wearable fields in the JSON payload sent to the LLM
  - The LLM receives the raw signals (`hrvPctChange`, `sleepDurationMin`, etc.) alongside existing signals
  - The LLM also receives `readinessScore` as a summary reference
  - No structural changes to `JITAdjustmentSchema` output — the LLM still returns the same adjustment format

### Prompt update

**`packages/training-engine/src/ai/prompts.ts`:**

- [ ] Append wearable signal documentation to `JIT_SYSTEM_PROMPT`:
  ```
  Wearable recovery data (when present — these fields may be absent if no wearable is connected):
  - hrvPctChange: % change from 7-day HRV baseline. Negative = worse recovery. Below -20% is significant.
  - restingHrPctChange: % change from 7-day RHR baseline. Positive = elevated. Above +10% warrants caution.
  - sleepDurationMin: actual sleep duration in minutes. Below 360 (6h) is poor. Below 300 (5h) is critical.
  - deepSleepPct: percentage of sleep in deep stage. Below 15% impairs muscular recovery.
  - nonTrainingLoad: 0-3 scale of non-training physical activity. 3 = high load contributing to fatigue.
  - readinessScore: composite 0-100 recovery score. Below 40 = significant recovery concern. Above 70 = good.
  - When wearable and subjective signals (sleepQuality, energyLevel) are both present and conflict, prioritize wearable data but note the discrepancy in rationale.
  - Wearable signals do not override active disruptions. Disruption precedence is unchanged.
  ```

- [ ] Append wearable context to `CYCLE_REVIEW_SYSTEM_PROMPT`:
  ```
  Recovery data (when present):
  - recoverySnapshots[]: daily recovery scores across the cycle. Use these to detect overreaching trends
    (sustained low HRV, rising RHR) and correlate with performance outcomes.
  - Sustained HRV decline over 3+ days often precedes performance drops by 1-2 sessions.
  - Sleep patterns correlated with training schedule can reveal scheduling issues.
  ```

### Export

**`packages/training-engine/src/index.ts`:**

- [ ] Export `getWearableReadinessModifier`, `hasWearableData`, `computeReadinessScore` from the training engine package

### Tests

**`packages/training-engine/src/adjustments/__tests__/wearable-readiness-adjuster.test.ts`:**

- [ ] All signals undefined → neutral modifier (0, 1.0, null)
- [ ] HRV drop 25% → setReduction 1, intensity 0.95
- [ ] HRV drop 15% → intensity 0.975
- [ ] HRV drop 25% + RHR elevated 12% → setReduction 1, intensity ~0.926 (stacked)
- [ ] Sleep 4h (240min) → setReduction 1, intensity 0.95
- [ ] Sleep 5.5h (330min) → intensity 0.975
- [ ] Sleep 8h + deep 10% → intensity 0.975 (low deep sleep despite good duration)
- [ ] HRV +12% + sleep 8h + deep 22% → intensity 1.025 (boost)
- [ ] HRV +12% + sleep 4h → no boost (negative sleep signal prevents it)
- [ ] setReduction cap: HRV drop 25% + RHR 16% + sleep 4h → setReduction capped at 2
- [ ] intensityMultiplier floor: extreme stacking → capped at 0.85
- [ ] nonTrainingLoad 3 → intensity 0.975
- [ ] `hasWearableData` returns false when all undefined, true when any of hrv/sleep/rhr defined

**`packages/training-engine/src/adjustments/__tests__/readiness-score.test.ts`:**

- [ ] All signals present: verify weighted formula produces expected score
- [ ] Only HRV present: HRV weight redistributed to 100%, score based on HRV alone
- [ ] HRV -30% → score near 0 (floor)
- [ ] HRV +15%, sleep 9h, deep 25%, RHR -5%, load 0 → score near 100 (ceiling)
- [ ] Missing signals redistribute weight correctly

## Dependencies

- [engine-028-readiness-adjuster.md](./engine-028-readiness-adjuster.md) — extends with wearable alternative; reuses `ReadinessModifier` interface
- [types-002-biometric-schemas.md](./spec-biometric-types.md) — `WearableReadinessInput` fields align with `RecoverySnapshotSchema`

## Domain References

- [domain/adjustments.md](../../domain/adjustments.md) — readiness modifier framework
- [domain/athlete-signals.md](../../domain/athlete-signals.md) — wearable signal definitions
