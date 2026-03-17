# Spec: OHP Onboarding + App Services

**Status**: Planned

**Domain**: Mobile

## What This Covers

Adds OHP max collection in onboarding (optional, for 4-day programs) and updates all app-layer services that hardcode 3 lifts: max estimation, lifter maxes, auxiliary config, warmup config, JIT orchestrator, session service, and app constants.

## Tasks

### Onboarding

**`apps/parakeet/src/app/(auth)/onboarding/lift-maxes.tsx`:**

- [ ] Add `'overhead_press'` to local `LiftKey` type
- [ ] Add `overhead_press: 'Overhead Press'` to local `LIFT_LABELS`
- [ ] Add `'overhead_press'` to `LIFT_ORDER` (always shown, but marked optional)
- [ ] Add optional `overhead_press` to `LiftsPayload` interface
- [ ] Add OHP section at bottom with label "Overhead Press (for 4-day programs)"
- [ ] "Next" button requires only S/B/D; OHP validated only if user started entering data

**`apps/parakeet/src/app/(auth)/onboarding/program-settings.tsx`:**

- [ ] Add optional `overhead_press` to local `LiftsPayload` interface

### App Constants

**`apps/parakeet/src/shared/constants/training.ts`:**

- [ ] Add `overhead_press: 'OHP'` to `LIFT_LABELS`
- [ ] Add `overhead_press: ['shoulders', 'triceps', 'upper_back']` to `LIFT_PRIMARY_SORENESS_MUSCLES`

### Max Estimation

**`apps/parakeet/src/modules/jit/lib/max-estimation.ts`:**

- [ ] Add `overhead_press` to `LIFT_BODYWEIGHT_MULTIPLIERS` — female: 0.45, male: 0.75
- [ ] Add `overhead_press: 25` to `MIN_ESTIMATED_MAX_KG`

### Lifter Maxes

**`apps/parakeet/src/modules/program/lib/lifter-maxes.ts`:**

- [ ] Add optional `overhead_press?: LiftInput` to `LifterMaxesInput` interface
- [ ] Update `submitMaxes()` — conditionally include OHP columns if `input.overhead_press` is present
- [ ] Update `inferSource()` — handle optional OHP entry in type array

### Auxiliary Config

**`apps/parakeet/src/modules/program/lib/auxiliary-config.ts`:**

- [ ] Add `overhead_press` pool fetch to `getAuxiliaryPools`

### Warmup Config

**`apps/parakeet/src/modules/settings/lib/warmup-config.ts`:**

- [ ] Add `overhead_press` default entry to `getAllWarmupConfigs`

### JIT Orchestrator

**`apps/parakeet/src/modules/jit/lib/jit.ts`:**

- [ ] Fetch OHP 1RM in parallel with other lift 1RMs
- [ ] Include OHP pool in `auxiliaryPool` merge
- [ ] Add OHP to `allOneRmKg` map

### Session Service

**`apps/parakeet/src/modules/session/application/session.service.ts`:**

- [ ] Add `'overhead_press'` to `createAdHocSession` lift union

## Notes

- Onboarding flow order: lift-maxes → program-settings → review. Training days (3 or 4) are selected in program-settings AFTER lift-maxes, so OHP max is always shown but labeled as optional
- `submitMaxes` is called in `program-settings.tsx` which receives lifts from lift-maxes via route params
- `getCurrentOneRmKg()` is already generic via template string `${lift}_1rm_grams` — no change needed
- `TRAINING_LIFTS` re-exports `LIFTS` from training-engine — auto-updates when engine-036 lands
- `disruption-presets.ts` uses `new Set(TRAINING_LIFTS)` — auto-inherits OHP

## Dependencies

- types-003 (Lift enum)
- engine-036 (LIFTS array)
- data-009 (lifter_maxes DB columns)
