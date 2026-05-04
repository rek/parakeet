# Spec: Wearable Readiness Adjuster

**Status**: Planned
**Domain**: Training Engine
**Phase**: 2 (Engine Integration). `computeReadinessScore` is also imported by Phase 1 `recovery.service.ts` — see Out-of-Order Note.
**Owner**: any executor agent

## What This Covers

Two pure functions in the training engine package:

1. `getWearableReadinessModifier(input)` — converts objective wearable signals into intensity/volume modifiers, returning the same `ReadinessModifier` shape as the existing subjective adjuster. Drop-in replacement at JIT pipeline Step 2b.
2. `computeReadinessScore(input)` — composite 0–100 score, weighted formula, missing-signal weight redistribution. Stored on `recovery_snapshots.readiness_score` and surfaced in `RecoveryCard` UI.

Plus dispatch wiring in `jit-session-generator.ts`, `JITInput` extension, LLM prompt updates for both JIT and cycle review prompts.

## Out-of-Order Note

`computeReadinessScore` is needed by [spec-pipeline.md](./spec-pipeline.md) `recovery.service.ts` in **Phase 1**. Two viable orderings:

- **Recommended:** Land Step 2 (`readiness-score.ts` + export) of this spec **inside Phase 1**, leaving the rest of this spec for Phase 2. The score function is pure and side-effect-free; landing it in Phase 1 has zero behavioral risk on the engine.
- **Alternative:** Stub `recovery.service.ts` to write `null` for `readiness_score` until Phase 2; the snapshot fields remain valid, just `readiness_score` is null.

Choose the recommended option unless Phase 1 is being shipped under tight scope.

## Prerequisites

- [spec-biometric-types.md](./spec-biometric-types.md) — `RecoverySnapshot`, `BiometricType` types.
- Existing engine context: `packages/training-engine/src/adjustments/readiness-adjuster.ts` (existing subjective `getReadinessModifier`).
- Existing engine context: `packages/training-engine/src/generator/jit-session-generator.ts` (Step 2b dispatcher).
- Reference: existing `disruption-adjuster.ts` for the deterministic-decision-table style.

## Existing Pattern (do not break)

`packages/training-engine/src/adjustments/readiness-adjuster.ts` exports:

```typescript
export type ReadinessLevel = 1 | 2 | 3 | 4 | 5;

export interface ReadinessModifier {
  setReduction: number;            // ≥ 0
  intensityMultiplier: number;     // around 1.0
  rationale: string | null;
}

export function getReadinessModifier(
  sleepQuality?: ReadinessLevel,
  energyLevel?: ReadinessLevel
): ReadinessModifier;
```

The wearable adjuster reuses `ReadinessModifier` exactly — no shape divergence.

## Tasks

### 1. `WearableReadinessInput` type + adjuster

**File:** `packages/training-engine/src/adjustments/wearable-readiness-adjuster.ts`

```typescript
import type { ReadinessModifier } from './readiness-adjuster';

export interface WearableReadinessInput {
  hrvPctChange?: number;        // % change vs 7-day baseline. negative = worse.
  restingHrPctChange?: number;  // % change vs 7-day baseline. positive = worse.
  sleepDurationMin?: number;    // last night's sleep, minutes
  deepSleepPct?: number;        // 0–100
  spo2Avg?: number;             // 0–100 (NOT consumed here — kept for symmetry)
  nonTrainingLoad?: number;     // 0–3: 0=sedentary, 3=heavy
  readinessScore?: number;      // 0–100 composite (informational; not used for decisions)
}

const NEUTRAL: ReadinessModifier = {
  setReduction: 0,
  intensityMultiplier: 1.0,
  rationale: null,
};

const SET_REDUCTION_CAP = 2;
const INTENSITY_FLOOR = 0.85;

/**
 * Returns true when at least one adjuster-relevant signal is present.
 * Used by the JIT generator to decide between this adjuster and the subjective one.
 * Note: `spo2Avg`, `readinessScore`, `nonTrainingLoad`, `deepSleepPct` alone do NOT
 * count — they're modifiers / informational and never the sole basis for adjustment.
 */
export function hasWearableData(input: WearableReadinessInput): boolean {
  return (
    input.hrvPctChange !== undefined ||
    input.sleepDurationMin !== undefined ||
    input.restingHrPctChange !== undefined
  );
}

export function getWearableReadinessModifier(
  input: WearableReadinessInput
): ReadinessModifier {
  if (!hasWearableData(input)) return NEUTRAL;

  const reasons: string[] = [];
  let setReduction = 0;
  let intensityMultiplier = 1.0;
  let hrvPositive = false;
  let anyNegative = false;

  // ── HRV ────────────────────────────────────────────────────────────────────
  const hrv = input.hrvPctChange;
  if (hrv !== undefined) {
    if (hrv <= -20) {
      setReduction += 1;
      intensityMultiplier *= 0.95;
      reasons.push('HRV significantly below baseline');
      anyNegative = true;
    } else if (hrv <= -10) {
      intensityMultiplier *= 0.975;
      reasons.push('HRV below baseline');
      anyNegative = true;
    } else if (hrv >= 10) {
      hrvPositive = true;
    }
  }

  // ── Resting HR ─────────────────────────────────────────────────────────────
  const rhr = input.restingHrPctChange;
  if (rhr !== undefined) {
    if (rhr >= 15) {
      setReduction += 1;
      intensityMultiplier *= 0.975;
      reasons.push('Resting heart rate significantly elevated');
      anyNegative = true;
    } else if (rhr >= 10) {
      intensityMultiplier *= 0.975;
      reasons.push('Resting heart rate elevated');
      anyNegative = true;
    }
  }

  // ── Sleep duration ─────────────────────────────────────────────────────────
  const sleep = input.sleepDurationMin;
  if (sleep !== undefined) {
    if (sleep < 300) {
      setReduction += 1;
      intensityMultiplier *= 0.95;
      reasons.push('Very short sleep');
      anyNegative = true;
    } else if (sleep < 360) {
      intensityMultiplier *= 0.975;
      reasons.push('Short sleep');
      anyNegative = true;
    }
  }

  // ── Deep sleep (only meaningful with sleep duration present) ───────────────
  if (sleep !== undefined && input.deepSleepPct !== undefined && input.deepSleepPct < 15) {
    intensityMultiplier *= 0.975;
    reasons.push('Low deep sleep percentage');
    anyNegative = true;
  }

  // ── Non-training load ──────────────────────────────────────────────────────
  if (input.nonTrainingLoad === 3) {
    intensityMultiplier *= 0.975;
    reasons.push('High non-training physical load');
    anyNegative = true;
  }

  // ── Boost (gated: all positive) ────────────────────────────────────────────
  if (
    !anyNegative &&
    hrvPositive &&
    sleep !== undefined && sleep >= 420 &&
    input.deepSleepPct !== undefined && input.deepSleepPct >= 20
  ) {
    intensityMultiplier *= 1.025;
    reasons.push('Strong recovery signals — boosted');
  }

  // ── Caps ───────────────────────────────────────────────────────────────────
  if (setReduction > SET_REDUCTION_CAP) setReduction = SET_REDUCTION_CAP;
  if (intensityMultiplier < INTENSITY_FLOOR) intensityMultiplier = INTENSITY_FLOOR;

  if (reasons.length === 0) return NEUTRAL;

  return {
    setReduction,
    intensityMultiplier,
    rationale: reasons.join('; '),
  };
}
```

**Notes for executor:**
- All thresholds are intentionally conservative. Wearable signals run alongside soreness, disruption, and other adjusters — they should not double-penalise.
- `spo2Avg` is NOT consumed here. SpO2 dropouts are handled (or were intended to be handled) via auto-disruption — see [spec-spo2-disruption.md](./spec-spo2-disruption.md). Currently dropped from scope; field remains for forward compat.
- `readinessScore` is NOT consumed by this function. It's stored on the snapshot and shown in UI. Decisions use the underlying signals.
- Multiplicative stacking is intentional — three small reductions of 0.975 = 0.927 ≈ 7.3% reduction, which is meaningful but not catastrophic.

### 2. `computeReadinessScore`

**File:** `packages/training-engine/src/adjustments/readiness-score.ts`

```typescript
import type { WearableReadinessInput } from './wearable-readiness-adjuster';

interface Component {
  weight: number;
  score: number | null;   // null = signal missing
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lerp(value: number, lo: number, hi: number, outLo: number, outHi: number): number {
  if (hi === lo) return outLo;
  const t = clamp((value - lo) / (hi - lo), 0, 1);
  return outLo + t * (outHi - outLo);
}

/**
 * 0–100 composite recovery readiness score.
 * Missing signals have their weight redistributed proportionally across present signals.
 * Returns null only when ALL signals are missing.
 */
export function computeReadinessScore(input: WearableReadinessInput): number | null {
  // HRV: -30% → 0, +15% → 100
  const hrv: Component = {
    weight: 0.40,
    score: input.hrvPctChange !== undefined
      ? lerp(input.hrvPctChange, -30, 15, 0, 100)
      : null,
  };

  // Sleep: 240min → 0, 540min → 100, plus +10 bonus when deepSleepPct >= 20
  const sleepBaseline = input.sleepDurationMin !== undefined
    ? lerp(input.sleepDurationMin, 240, 540, 0, 100)
    : null;
  const deepBonus = input.deepSleepPct !== undefined && input.deepSleepPct >= 20 ? 10 : 0;
  const sleep: Component = {
    weight: 0.30,
    score: sleepBaseline === null ? null : clamp(sleepBaseline + deepBonus, 0, 100),
  };

  // RHR: +20% → 0, -10% → 100
  const rhr: Component = {
    weight: 0.20,
    score: input.restingHrPctChange !== undefined
      ? lerp(input.restingHrPctChange, 20, -10, 0, 100)
      : null,
  };

  // Load: 3 → 25, 2 → 50, 1 → 75, 0 → 100
  const load: Component = {
    weight: 0.10,
    score: input.nonTrainingLoad !== undefined
      ? clamp(100 - input.nonTrainingLoad * 25, 0, 100)
      : null,
  };

  const present = [hrv, sleep, rhr, load].filter((c) => c.score !== null);
  if (present.length === 0) return null;

  const totalWeight = present.reduce((acc, c) => acc + c.weight, 0);
  const weighted = present.reduce((acc, c) => acc + (c.score as number) * (c.weight / totalWeight), 0);
  return Math.round(clamp(weighted, 0, 100));
}
```

### 3. `JITInput` extension

**File:** `packages/training-engine/src/generator/jit-session-generator.ts`

Add wearable fields to the existing `JITInput` interface (preserve all existing fields). Place them adjacent to `sleepQuality`/`energyLevel` for cohesion:

```typescript
// existing fields...
sleepQuality?: ReadinessLevel;
energyLevel?: ReadinessLevel;

// Wearable recovery signals — supersede sleepQuality/energyLevel when present.
// All optional; partial data is normal. Populated by runJITForSession from today's
// recovery_snapshots row when present. See spec-pipeline.md.
hrvPctChange?: number;
restingHrPctChange?: number;
sleepDurationMin?: number;
deepSleepPct?: number;
spo2Avg?: number;
nonTrainingLoad?: number;
readinessScore?: number;
```

### 4. Step 2b dispatch

**File:** `packages/training-engine/src/generator/jit-session-generator.ts`

The existing call in Step 2b is `applyReadinessAdjustment(ctx, input, traceBuilder)`. Either modify `applyReadinessAdjustment` internally or replace the call site — both acceptable. Recommended: thin internal dispatch inside the existing helper so the trace builder is unchanged.

```typescript
// Inside applyReadinessAdjustment (or its file)
import {
  getWearableReadinessModifier,
  hasWearableData,
} from '../adjustments/wearable-readiness-adjuster';
import { getReadinessModifier } from '../adjustments/readiness-adjuster';

function pickReadinessModifier(input: JITInput): ReadinessModifier {
  const wearableInput = {
    hrvPctChange: input.hrvPctChange,
    restingHrPctChange: input.restingHrPctChange,
    sleepDurationMin: input.sleepDurationMin,
    deepSleepPct: input.deepSleepPct,
    nonTrainingLoad: input.nonTrainingLoad,
  };
  return hasWearableData(wearableInput)
    ? getWearableReadinessModifier(wearableInput)
    : getReadinessModifier(input.sleepQuality, input.energyLevel);
}
```

Trace label: emit `"wearable-readiness"` vs `"subjective-readiness"` so traces are debuggable.

**5-day baseline gate:** Enforced upstream by `recovery.service.ts` (see [spec-pipeline.md](./spec-pipeline.md)) — when fewer than 5 daily readings exist, `hrv_pct_change` and `rhr_pct_change` are null. With both null and `sleepDurationMin` only nullable when sleep was tracked, `hasWearableData` returns false → falls back to subjective. The engine itself has no warmup logic; the gate is a data-layer concern.

### 5. LLM JIT input enrichment

**File:** `packages/training-engine/src/generator/llm-jit-generator.ts`

`buildJITContext` already spreads JITInput into the LLM payload (verified at scan). Confirm the new fields are included automatically by the spread; if the function whitelists fields, add the wearable fields explicitly. Include the composite `readinessScore` so the LLM has a summary number to anchor on alongside raw signals.

Do NOT change `JITAdjustmentSchema` — the LLM still returns the same adjustment shape.

### 6. Prompt updates

**File:** `packages/training-engine/src/ai/prompts.ts`

Append to `JIT_SYSTEM_PROMPT` (after existing readiness/soreness rules):

```
Wearable recovery data (when present — these fields may be absent if no wearable is connected or baselines are still being established):
- hrvPctChange: % change from the lifter's 7-day HRV baseline. Negative = worse recovery. Below -20% is significant.
- restingHrPctChange: % change from the lifter's 7-day RHR baseline. Positive = elevated. Above +10% warrants caution.
- sleepDurationMin: minutes slept last night. Below 360 (6h) is poor. Below 300 (5h) is critical.
- deepSleepPct: % of sleep in deep stage. Below 15% impairs muscular recovery regardless of total duration.
- nonTrainingLoad: 0-3 scale of non-training physical activity. 3 = high load contributing to fatigue.
- readinessScore: composite 0-100 recovery score. Below 40 = significant concern. Above 70 = good.

When wearable and subjective signals (sleepQuality, energyLevel) both exist and conflict, prioritise the wearable data but call out the discrepancy in the rationale (e.g., "lifter reported feeling fresh but HRV is 18% below baseline — reducing intensity 5%"). Wearable signals do NOT override active disruptions; disruption precedence is unchanged.
```

Append to `CYCLE_REVIEW_SYSTEM_PROMPT` (or the recovery-aware section) — see [spec-cycle-review-recovery.md](./spec-cycle-review-recovery.md) for the full block. Keep this spec focused on JIT.

### 7. Engine package exports

**File:** `packages/training-engine/src/index.ts`

Add named exports (do NOT expose internals you don't intend to test against):

```typescript
export {
  getWearableReadinessModifier,
  hasWearableData,
  type WearableReadinessInput,
} from './adjustments/wearable-readiness-adjuster';
export { computeReadinessScore } from './adjustments/readiness-score';
```

Verify the existing `export * from './modules/adjustments'` does or does not pick these up — re-export explicitly to avoid ambiguity.

### 8. Tests

**File:** `packages/training-engine/src/adjustments/__tests__/wearable-readiness-adjuster.test.ts`

Vitest pattern (existing `readiness-adjuster.test.ts` is the reference). Cover:

- All signals undefined → `hasWearableData === false` and `NEUTRAL` returned.
- `hrvPctChange: -25` → `setReduction === 1`, `intensityMultiplier ≈ 0.95`, rationale mentions HRV.
- `hrvPctChange: -15` → `setReduction === 0`, `intensityMultiplier ≈ 0.975`.
- `hrvPctChange: -25, restingHrPctChange: 12` → setReduction 1, intensityMultiplier ≈ 0.95 * 0.975 = 0.92625.
- `sleepDurationMin: 240` → setReduction 1, intensityMultiplier ≈ 0.95.
- `sleepDurationMin: 330` → intensityMultiplier ≈ 0.975.
- `sleepDurationMin: 480, deepSleepPct: 10` → low deep sleep adds 0.975 multiplier.
- `hrvPctChange: 12, sleepDurationMin: 480, deepSleepPct: 22` → intensityMultiplier ≈ 1.025 (boost).
- `hrvPctChange: 12, sleepDurationMin: 240, deepSleepPct: 22` → no boost (negative sleep signal blocks).
- Stacking cap: `hrvPctChange: -25, restingHrPctChange: 16, sleepDurationMin: 240` → setReduction capped at 2.
- Floor: extreme stacking → `intensityMultiplier === 0.85`.
- `nonTrainingLoad: 3` → intensityMultiplier ≈ 0.975.
- `hasWearableData` truth table — one signal at a time across `{hrv, sleep, rhr, deepSleep, load, score, spo2}` (only first three return true).

**File:** `packages/training-engine/src/adjustments/__tests__/readiness-score.test.ts`

- All present (peak): `hrvPctChange: 15, sleepDurationMin: 540, deepSleepPct: 25, restingHrPctChange: -10, nonTrainingLoad: 0` → score 100.
- All present (worst): `hrvPctChange: -30, sleepDurationMin: 240, deepSleepPct: 5, restingHrPctChange: 20, nonTrainingLoad: 3` → score 0.
- HRV-only present: `hrvPctChange: 0` → score lerps to 67 (HRV alone, weight redistributed to 100%).
- All missing → score null.
- Deep-sleep bonus: `sleepDurationMin: 420, deepSleepPct: 22` vs `sleepDurationMin: 420, deepSleepPct: 18` — first is 10 points higher (clamped at 100).
- Weight redistribution: drop one signal at a time, verify total weight of present components still equals 1 in the calculation.

## Validation

- `npx vitest run packages/training-engine` — green; new tests pass.
- `npx tsc -p packages/training-engine --noEmit` — no errors.
- JIT trace for a session with wearable data shows the wearable adjuster fired (label `"wearable-readiness"`) and the rationale string is non-null.
- JIT trace for a session without wearable data still fires the subjective adjuster (zero regression).
- Boundary check: no new imports from `@modules/wearable` or `@parakeet/shared-types/biometric` — the engine package must not depend on app modules. The engine's only knowledge of wearable signals is via the new `JITInput` fields (numbers + enums).

## Out of Scope

- Recovery-snapshot computation (where the % changes come from) — see [spec-pipeline.md](./spec-pipeline.md).
- UI surfacing of `readinessScore` — see [spec-recovery-card.md](./spec-recovery-card.md).
- Cycle review prompt for recovery trends — see [spec-cycle-review-recovery.md](./spec-cycle-review-recovery.md).
- SpO2 disruption auto-creation — see [spec-spo2-disruption.md](./spec-spo2-disruption.md).

## Dependencies

- Upstream: [spec-biometric-types.md](./spec-biometric-types.md).
- Downstream: [spec-pipeline.md](./spec-pipeline.md) imports `computeReadinessScore` (Phase 1 partial dependency).

## Domain References

- [domain/adjustments.md](../../domain/adjustments.md) — readiness modifier framework
- [domain/athlete-signals.md](../../domain/athlete-signals.md)
- [domain/session-prescription.md](../../domain/session-prescription.md) — pipeline step ordering
