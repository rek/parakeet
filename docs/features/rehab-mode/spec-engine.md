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
- [x] Volume top-up: no code change needed — the existing primary-muscle exclusion (`getPrimaryMusclesForSession(primaryLift)`) already prevents top-up from picking the capped lift's primary muscles. Cross-lift case (e.g. squat-rehab on deadlift day) is out of scope for v1; revisit if it causes problems in practice.
  → `packages/training-engine/src/generator/jit-session-generator.ts:746` (existing `primaryMusclesToday` filter)
- [x] Aux exercises: no special handling per design. Aux propagation (GH#217) already scales aux weight by `mainIntensityMultiplier`; the cap reducing main weight will naturally flow through. Intentional.
- [ ] Volume recovery (intra-session): suppress add-back offers when `activeRehabCap` set. **Phase 2b**.
- [ ] Weight autoregulation (intra-session): suppress next-set weight increase suggestion when `activeRehabCap` set. **Phase 2b**.

**`packages/training-engine/src/formulas/weight-rounding.ts`**

- [x] `roundUpToNearest(weightKg, incrementKg)` helper — used by the cap-clamp logic so a 82.5kg cap with 5kg plate increment prescribes 85kg, not 80kg.
  → `packages/training-engine/src/formulas/weight-rounding.ts`

**`packages/training-engine/src/adjustments/performance-adjuster.ts`**

- [ ] Filter input session summaries: drop any session whose set logs include `during_rehab: true` for the lift under analysis. Pollutes the RPE deviation signal otherwise.
- [ ] Threading: the performance adjuster currently takes `RecentSessionSummary[]`. Extend the type to carry a per-session `containedRehabSets: boolean` flag (computed by the app-layer when assembling `JITInput`). Skip those sessions in averaging.

**`packages/training-engine/src/analysis/weight-deviation.ts`** (working 1RM)

- [ ] Working-1RM computation already filters to "qualifying sets" (RPE >= 8.5 with reps + weight). Extend the filter: drop sets with `pain_limited: true` OR `during_rehab: true`. Working 1RM is meant to reflect true strength capacity, not capped pain-limited work.

**`packages/training-engine/src/badges/checkers/*`** (PR detection)

- [ ] At each checker's entry point, skip the session if its set logs include `during_rehab: true` for the lift being checked. This blocks estimated-1RM PRs, volume PRs, and rep-at-weight PRs from being awarded on rehab sets.
- [ ] Add a unit test per checker confirming a high-rep rehab set does not trigger a PR even when the math would otherwise qualify.

**`packages/training-engine/src/analysis/modifier-effectiveness.ts`**

- [ ] Drop sets/sessions with `during_rehab: true` from the modifier-calibration sample. The modifier effectiveness analyzer is trying to learn how well soreness/readiness predicts RPE; capped pain-limited work is noise for that purpose.

**Unit / integration tests**

- [ ] `jit-session-generator.test.ts`:
  - Squat with `activeRehabCap.capKg = 80`, formula would prescribe 112.5 → output weight is 80, `cappedByRehab: true`, rationale includes the cap line
  - Cap above formula weight → no-op, `cappedByRehab: false`
  - Step 2 RPE history would have raised weight 5% → does not apply when `activeRehabCap` set
  - Step 0 capacity boost would have added a set → does not apply when `activeRehabCap` set
  - Severe soreness (level 10) + active cap → recovery mode (3×5 @ 40% × cap) — the 40% is computed against the cap, not stored 1RM
  - Active cap + minor injury disruption (-20%) → disruption reduces from cap (final = `cap * 0.8`), not from formula
- [ ] `weight-deviation.test.ts`: pain-limited sets at RPE 9.5 are excluded from median e1RM
- [ ] PR checker tests per the bullet above

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
