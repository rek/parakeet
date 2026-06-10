# Spec: Rehab Mode Engine Changes

**Status**: Planned
**Domain**: Training Engine

## What This Covers

Changes to `packages/training-engine/` so the JIT pipeline respects an active rehab cap as a hard weight ceiling, suppresses adaptive logic that would push past it or pollute calibration, and filters historical sets logged with `during_rehab` or `pain_limited` flags out of every cross-session analysis path.

The cap itself is **passed in** via `JITInput`. The engine does not query Supabase. The app-layer (`@modules/rehab-mode` + JIT input assembler) is responsible for fetching the active cap and threading it through.

## Tasks

**Types: `packages/training-engine/src/types.ts`** (added inline, not a separate file)

- [x] `RehabCap` exported from `@parakeet/training-engine`.
      → `packages/training-engine/src/types.ts`

**`packages/training-engine/src/generator/jit-session-generator.ts`**

- [x] `JITInput.activeRehabCap?: RehabCap` — populated by the app layer when the session's `primary_lift` has an active cap.
      → `packages/training-engine/src/generator/jit-session-generator.ts`
- [x] `JITOutput.cappedByRehab?: boolean` and `rehabCapKg?: number` — surfaced only when the clamp actually fired (cap > formula weight = no-op = no fields emitted).
      → `packages/training-engine/src/generator/jit-session-generator.ts`
- [x] Step 0 (`applyVolumeCalibration`): early-returns when `activeRehabCap` set. No volume calibration from RPE trends, capacity, or modifier learning during rehab.
      → `packages/training-engine/src/generator/steps/applyVolumeCalibration.ts`
- [x] Step 2 (`applyRpeAdjustment`): early-returns when `activeRehabCap` set. No auto-progression while RPE is pain-ambiguous.
      → `packages/training-engine/src/generator/steps/applyRpeAdjustment.ts`
- [x] Step 2b (`applyRepRangeAdjustment`): early-returns when `activeRehabCap` set.
      → `packages/training-engine/src/generator/steps/applyRepRangeAdjustment.ts`
- [x] Step 8 (`buildFinalMainSets`): clamps `weight_kg = min(formulaWeight, ceilToIncrement(capKg))` using `roundUpToNearest` (cap rounds **up**, per GH#220 decision). Sets `ctx.cappedByRehab = true` and `ctx.rehabCapKg = ceiling` + adds a rationale line when the clamp fires. Recovery mode (severe soreness) also bases the 40% floor on the clamped weight rather than the uncapped formula weight.
      → `packages/training-engine/src/generator/steps/buildFinalMainSets.ts`
- [x] **Shared clamp helper** in `generator/rehab-clamp.ts` — `applyRehabClamp(weight, input, increment)` + `resolveRehabCeilingKg(input, increment)`. Consumed by `buildFinalMainSets` (formula path) AND `enforceHardConstraints` (LLM + hybrid paths) so the cap is honored by every strategy. Without this the LLM strategy would silently ignore the cap.
      → `packages/training-engine/src/generator/rehab-clamp.ts`
- [x] `enforceHardConstraints` applies the clamp as a final post-pass and stamps `cappedByRehab` + `rehabCapKg` + a `[constraint] Capped at Nkg by Rehab Mode` warning. Idempotent — re-running on already-clamped output does not double-warn.
      → `packages/training-engine/src/generator/jit-constraints.ts`
- [x] LLM input context: `buildJITContext` drops `recentLogs` tagged `containedRehabSets` so the LLM does not see polluted history.
      → `packages/training-engine/src/generator/llm-jit-generator.ts`
- [x] Volume top-up: no code change needed — the existing primary-muscle exclusion (`getPrimaryMusclesForSession(primaryLift)`) already prevents top-up from picking the capped lift's primary muscles. Cross-lift case (e.g. squat-rehab on deadlift day) is out of scope for v1; revisit if it causes problems in practice.
      → `packages/training-engine/src/generator/jit-session-generator.ts:746` (existing `primaryMusclesToday` filter)
- [x] Aux exercises: no special handling per design. Aux propagation (GH#217) already scales aux weight by `mainIntensityMultiplier`; the cap reducing main weight will naturally flow through. Intentional.
- [x] Volume recovery (intra-session): `VolumeRecoveryContext.isInRehabMode` flag — returns null when set. The app layer threads the flag from the active rehab cap on the current lift.
      → `packages/training-engine/src/adjustments/volume-recovery.ts`
- [x] Weight autoregulation (intra-session): `WeightAutoregulationContext.isInRehabMode` flag — returns null when set. Same threading.
      → `packages/training-engine/src/adjustments/weight-autoregulation.ts`

**`packages/training-engine/src/formulas/weight-rounding.ts`**

- [x] `roundUpToNearest(weightKg, incrementKg)` helper — used by the cap-clamp logic so a 82.5kg cap with 5kg plate increment prescribes 85kg, not 80kg.
      → `packages/training-engine/src/formulas/weight-rounding.ts`

**`packages/training-engine/src/adjustments/performance-adjuster.ts`**

- [x] `SessionLogSummary.containedRehabSets?: boolean` flag added; `suggestProgramAdjustments` filters logs with this flag set before grouping. App layer computes the flag from `set_logs.during_rehab` when assembling input.
      → `packages/training-engine/src/adjustments/performance-adjuster.ts`

**`packages/training-engine/src/analysis/weight-deviation.ts`** (working 1RM)

- [x] `ActualSetKg.painLimited?: boolean` and `duringRehab?: boolean` flags added; qualifying-set filter excludes either. The deviation (`actualMaxWeightKg`, `deviationKg`) still includes rehab sets — they happened — but they no longer contribute to e1RM estimation.
      → `packages/training-engine/src/analysis/weight-deviation.ts`

**`packages/training-engine/src/badges/checkers/*`** (PR detection)

- [ ] **App-layer gate (Phase 3)**: PR detection is invoked by the app's badge orchestrator, which builds `BadgeCheckContext.earnedPRs` from the PR detection pass. Simplest path: the orchestrator early-returns `earnedPRs: []` when any actual set for the session has `during_rehab: true`. No engine-side change needed because every PR checker already takes `earnedPRs` from the context — emptying it upstream cleanly suppresses badge awards too. Tracked under spec-app.md.

**`packages/training-engine/src/analysis/modifier-effectiveness.ts`**

- [x] `ModifierSample.duringRehab?: boolean` added; `computeCalibrationBias` drops flagged samples before computing bias. Empty post-filter sample set returns `exploring` confidence.
      → `packages/training-engine/src/analysis/modifier-effectiveness.ts`

**Unit / integration tests**

- [x] `jit-rehab-mode.test.ts`: cap clamp, cap on different lift, plate-increment round-up, suppression of Steps 0/2/2b, moderate-disruption stacking, severe-soreness recovery mode based on capped weight, post-cap-lift `recentLogs` cleanup.
      → `packages/training-engine/src/generator/jit-rehab-mode.test.ts`
- [x] `llm-jit-generator.test.ts`: LLM path cap enforcement (raw `applyAdjustment` does not clamp; `enforceHardConstraints` does, with the round-up semantics; idempotent on pre-clamped output; cap on different lift is a no-op).
      → `packages/training-engine/src/generator/__tests__/llm-jit-generator.test.ts`
- [x] `weight-rounding.test.ts`: `roundUpToNearest` for 2.5kg / 5kg / 10kg increments.
      → `packages/training-engine/src/formulas/weight-rounding.test.ts`
- [x] `weight-deviation.test.ts`: pain-limited and during-rehab sets excluded from e1RM; deviation still computed.
      → `packages/training-engine/src/analysis/weight-deviation.test.ts`
- [x] `weight-autoregulation.test.ts`: returns null when `isInRehabMode`.
      → `packages/training-engine/src/adjustments/weight-autoregulation.test.ts`
- [x] `volume-recovery.test.ts`: returns null when `isInRehabMode`.
      → `packages/training-engine/src/adjustments/volume-recovery.test.ts`
- [x] `modifier-effectiveness.test.ts`: `duringRehab` samples dropped before bias computation; empty post-filter set → exploring.
      → `packages/training-engine/src/analysis/modifier-effectiveness.test.ts`
- [x] `performance-adjuster.test.ts`: `containedRehabSets` sessions dropped before grouping.
      → `packages/training-engine/src/adjustments/performance-adjuster.test.ts`
- [ ] **PR checker tests** — deferred with the PR gating itself to Phase 3 (app-layer gate, not engine).

## Resolved Decisions

- **Plate-increment vs cap rounding** (decided 21 May 2026): If the cap is `82.5kg` and the user has disabled 1.25kg plates (so increment = 5kg), the prescribed weight rounds **up** to 85kg. Rationale: the cap is a target the user wants to reach; rounding down loses meaningful work and the user (who set the cap) knows their plate situation when they chose the cap value. Add a unit test pinning this behaviour.

## Dependencies

- [spec-data.md](./spec-data.md) — `during_rehab` and `pain_limited` flags must exist on `set_logs` before the engine can read them
- [jit-pipeline/spec-generator.md](../jit-pipeline/spec-generator.md) — JIT pipeline this extends
- [intra-session/spec-weight-autoregulation.md](../intra-session/spec-weight-autoregulation.md) — autoregulation suppression

## Domain References

- [domain/session-prescription.md](../../domain/session-prescription.md) — pipeline steps and order
- [domain/performance-analysis.md](../../domain/performance-analysis.md) — working-1RM and PR rules being modified
- [domain/adjustments.md](../../domain/adjustments.md) — compounding rules (cap is a new ceiling that stacks under existing modifiers)
