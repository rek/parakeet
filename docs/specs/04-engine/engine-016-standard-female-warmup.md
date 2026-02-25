# Spec: standard_female Warmup Preset

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

Adds a `standard_female` warmup preset — a 5-step protocol with finer percentage progression than the existing 4-step `standard` preset. Female lifters benefit from an extra sub-60% step to reach peak neuromuscular activation. This preset becomes the onboarding default for female lifters; all existing presets are unchanged.

## Tasks

**File: `packages/training-engine/src/generator/warmup-calculator.ts`**

- [ ] Add `'standard_female'` to `WarmupPresetName` union type
- [ ] Add `standard_female` entry to `PRESET_STEPS`:
  ```
  { pct: 0.40, reps: 5 }
  { pct: 0.55, reps: 4 }
  { pct: 0.70, reps: 3 }
  { pct: 0.85, reps: 2 }
  { pct: 0.925, reps: 1 }
  ```
- [ ] No changes to `generateWarmupSets`, `resolveProtocol`, or other functions — they already handle any `WarmupPresetName` generically

**Unit tests (`packages/training-engine/src/__tests__/warmup-calculator.test.ts`):**
- [ ] `getPresetSteps('standard_female')` returns 5 steps
- [ ] Step 1: pct 0.40, reps 5; Step 2: pct 0.55, reps 4; Step 5: pct 0.925, reps 1
- [ ] `generateWarmupSets(100, { type: 'preset', name: 'standard_female' })` produces 5 warmup sets (no duplicates expected at 100 kg working weight)
- [ ] `generateWarmupSets(60, { type: 'preset', name: 'standard_female' })` — verify 20 kg bar minimum applies and duplicate-skip logic still works

**File: `apps/parakeet/src/lib/warmup-config.ts`**

- [ ] Update `getWarmupConfig(userId)` default resolution: when no user config row exists, select `standard_female` if `profiles.biological_sex === 'female'`, otherwise `standard`
  - Requires joining or pre-loading `biological_sex` from `profiles` — pass as optional param `getWarmupConfig(userId, biologicalSex?)` rather than fetching inside

**File: `apps/parakeet/src/app/(onboarding)/program-settings.tsx` (or equivalent onboarding screen)**

- [ ] When creating the initial warmup config row on onboarding completion, pass `biologicalSex` so the correct default preset is stored

## Usage Context

- `WarmupProtocol` union already supports `{ type: 'preset'; name: WarmupPresetName }` — no structural change
- Settings → Warmup Protocol: `standard_female` appears in the preset picker list with label "Standard (Female)" — overridable
- The preset label in the warmup settings UI should read "Standard (Female)" not the raw key

## Dependencies

- [engine-010-warmup-calculator.md](./engine-010-warmup-calculator.md) — existing warmup system
- [data-004-athlete-profile.md](../05-data/data-004-athlete-profile.md) — `biological_sex` field
- [mobile-013 warmup display](../09-mobile/mobile-013-warmup-display.md) — preset picker UI
