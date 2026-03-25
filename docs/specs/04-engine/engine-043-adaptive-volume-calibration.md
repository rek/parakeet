# Spec: Adaptive Volume Calibration

**Status**: Planned
**Domain**: Training Engine | Mobile App

## What This Covers

Three-phase implementation of adaptive volume prescription. The system learns the right volume for each individual lifter based on accumulated signals, rather than using fixed program template set counts.

Design doc: [adaptive-volume.md](../../design/adaptive-volume.md)

---

## Phase 1: Enhanced Signal Collection

### Expand soreness scale to 1-10

**File: `packages/training-engine/src/adjustments/soreness-adjuster.ts`**

- [ ] Expand `SORENESS_TABLE` to map 10 levels instead of 5
  - 1-2: no change (fresh)
  - 3-4: no change (mild)
  - 5-6: -1 set (moderate)
  - 7-8: -2 sets (male) / -1 set (female), intensity reduction (high)
  - 9-10: recovery mode (severe)
- [ ] Backwards-compatible: if input is 1-5, multiply by 2 for legacy callers

**File: `apps/parakeet/src/app/(tabs)/session/soreness.tsx`**

- [ ] Update soreness input UI from 5 buttons to a slider or 10-segment control
- [ ] Descriptive labels at key points: 1="Fresh", 3="Slight", 5="Moderate", 7="Sore", 9="Very sore", 10="Can't train"

### Expand sleep/energy to 1-5

**File: `packages/training-engine/src/adjustments/readiness-adjuster.ts`**

- [ ] Expand lookup table for 5-point sleep × 5-point energy combinations
  - 4-5 sleep/energy: enable volume boost (new — currently only neutral or reduce)
  - 1-2: reduce (existing behavior with finer thresholds)
  - 3: neutral

**File: `apps/parakeet/src/app/(tabs)/session/soreness.tsx`**

- [ ] Update sleep/energy pills from 3 to 5 options

### Add post-session capacity assessment

**File: `apps/parakeet/src/app/(tabs)/session/complete.tsx`**

- [ ] Add capacity question after session completion: "How do you feel?"
  - 1 = Barely survived
  - 2 = About right
  - 3 = Had more in me
  - 4 = Way too easy
- [ ] Store in `session_logs` (new JSONB field or column)

**File: `packages/training-engine/src/types.ts`**

- [ ] Add `capacityAssessment?: 1 | 2 | 3 | 4` to session completion data

### Tests

- [ ] Soreness adjuster: 10-level mapping produces correct modifiers at each level
- [ ] Soreness adjuster: legacy 1-5 input backwards-compatible
- [ ] Readiness adjuster: 5×5 matrix with boost at (4,4), (4,5), (5,4), (5,5)
- [ ] Capacity assessment: stored and retrievable from session logs

## Phase 2: Volume Calibration Step

### JIT Step 0: `applyVolumeCalibration`

**File: `packages/training-engine/src/generator/steps/applyVolumeCalibration.ts`** (new)

- [ ] `applyVolumeCalibration({ ctx, input })` — adjusts `ctx.plannedCount` by -2 to +3 before other steps run
  - Consumes: `recentLogs` (RPE trends), `sorenessRatings`, `sleepQuality`, `energyLevel`, `capacityHistory`, `modifierCalibrations`
  - Computes RPE trend: avg(actual - target) over last 3-5 sessions for this lift
  - Computes readiness score: combined sleep + energy signal
  - Computes capacity trend: avg post-session assessment over recent sessions
  - Produces `volumeCalibrationModifier`: additive integer

**Decision logic** (see [domain/adjustments.md](../../domain/adjustments.md#volume-increase-triggers)):

| Condition | Modifier |
|-----------|----------|
| RPE avg gap >= 1.5 below AND soreness low AND readiness high | +2 |
| RPE avg gap >= 1.0 below AND no negative signals | +1 |
| Capacity trend >= 3.0 ("had more in me" avg) | +1 |
| Weekly mismatch: "recovering well" for primary muscles | +1 |
| RPE avg gap >= 1.0 above target | -1 |
| Cap: MRV constraint after calibration | clamp to remaining MRV capacity |

- [ ] Modifiers are additive but capped: max +3, min -2
- [ ] Record calibration decision in prescription trace

**File: `packages/training-engine/src/generator/jit-session-generator.ts`**

- [ ] Insert `applyVolumeCalibration` as Step 0, before `initPipeline`
- [ ] Extend `JITInput` with `capacityHistory`, `weeklyMismatchDirection`

**File: `apps/parakeet/src/modules/jit/lib/jit.ts`**

- [ ] Fetch recent capacity assessments and weekly mismatch data
- [ ] Populate new `JITInput` fields

### Tests

- [ ] Volume calibration: RPE consistently low → +1 set
- [ ] Volume calibration: RPE low + high readiness + low soreness → +2 sets
- [ ] Volume calibration: RPE high → -1 set
- [ ] Volume calibration: capped at MRV
- [ ] Volume calibration: no data (new user) → 0 modifier
- [ ] Integration: calibration +2 then soreness -1 = net +1

## Phase 3: Closed-Loop Learning

### Wire modifier calibration into JIT

**File: `packages/training-engine/src/generator/jit-session-generator.ts`**

- [ ] When `modifierCalibrations` is present with sufficient confidence:
  - Apply learned bias corrections to volume calibration base
  - Record applied calibrations in trace

### Weekly review → next-week baseline

**File: `apps/parakeet/src/modules/body-review/`**

- [ ] When weekly review shows "recovering well" mismatches:
  - Store `volumeCalibrationBaseline` per muscle in AsyncStorage or DB
  - Next session's Step 0 reads this as starting bias

### Progressive volume within blocks

**File: `packages/training-engine/src/generator/steps/applyVolumeCalibration.ts`**

- [ ] Track volume calibration over the current block (3 weeks)
- [ ] If RPE signals remain stable/low across weeks: allow progressive increase
  - Week 1: standard calibration
  - Week 2: +1 if week 1 calibration was positive and RPE stayed low
  - Week 3: +1 more if pattern continues
- [ ] Reset on deload week

### Tests

- [ ] Modifier calibration applied when confidence >= medium
- [ ] Weekly mismatch feeds into next session baseline
- [ ] Progressive increase across block weeks
- [ ] Deload resets progressive accumulation

---

## Dependencies

- [adaptive-volume.md](../../design/adaptive-volume.md) — design doc
- [domain/session-prescription.md](../../domain/session-prescription.md) — JIT Step 0 definition
- [domain/adjustments.md](../../domain/adjustments.md) — volume increase trigger table
- [domain/athlete-signals.md](../../domain/athlete-signals.md) — expanded signal taxonomy

## Domain References

- [domain/volume-landmarks.md](../../domain/volume-landmarks.md) — MRV/MEV as guardrails
- [domain/adjustments.md](../../domain/adjustments.md) — modifier tables and compounding rules
- [domain/references.md](../../domain/references.md) — Ralston 2017, Androulakis-Korakakis 2021
