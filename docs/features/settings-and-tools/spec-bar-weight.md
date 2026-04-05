# Spec: Bar Weight Setting

**Status**: Implemented
**Domain**: parakeet App + training-engine

## What This Covers

Configurable bar weight (15 kg / 20 kg) propagated from a settings toggle through warmup generation, recovery mode floors, and display labels. Replaces all hardcoded `20` bar references.

## Engine Changes

**`packages/training-engine/src/generator/warmup-calculator.ts`:**
- [x] `generateWarmupSets(workingWeightKg, protocol, barWeightKg = 20)` — third param is the bar weight
- [x] `Math.max(barWeightKg, roundToNearest(...))` replaces `Math.max(20, ...)`
- [x] `displayWeight` label uses `barWeightKg` for the "(bar)" threshold and label text

**`packages/training-engine/src/adjustments/soreness-adjuster.ts`:**
- [x] `applySorenessToSets(sets, modifier, minSets = 1, barWeightKg = 20)` — fourth param is bar weight
- [x] Recovery mode floor uses `barWeightKg` instead of `20`

**`packages/training-engine/src/generator/jit-session-generator.ts`:**
- [x] `JITInput.barWeightKg?: number` — optional field, defaults to 20 when destructured
- [x] Passed to `generateWarmupSets` (step 8)
- [x] Passed as recovery floor in step 7 (inRecoveryMode branch)

## Settings Module

**`apps/parakeet/src/modules/settings/lib/settings.ts`:**
- [x] `BarWeightKg = 15 | 20` type
- [x] `getBarWeightKg(): Promise<BarWeightKg>` — reads `'bar_weight_kg'` from AsyncStorage, defaults to 20
- [x] `setBarWeightKg(kg: BarWeightKg): Promise<void>` — writes to AsyncStorage

## JIT Pipeline

**`apps/parakeet/src/modules/jit/lib/jit.ts`:**
- [x] `getBarWeightKg()` added to the parallel `Promise.all` fetch
- [x] `barWeightKg` included in `jitInput`

## Settings UI

**`apps/parakeet/src/app/(tabs)/settings.tsx`:**
- [x] "Bar Weight" row added to the Training section
- [x] Inline 15 kg / 20 kg toggle (same visual style as `PlateCalculatorSheet` bar toggle)
- [x] State loaded on mount via `getBarWeightKg()`; updates immediately via `setBarWeightKg()`

## Session Screen Display

**`apps/parakeet/src/components/training/WarmupSection.tsx`:**
- [x] `barWeightKg?: number` prop added (default 20)
- [x] `formatWeight(weightKg, barWeightKg)` uses `barWeightKg` as the threshold and in the label text

**`apps/parakeet/src/app/(tabs)/session/[sessionId].tsx`:**
- [x] `barWeightKg` state (default 20), loaded from `getBarWeightKg()` in `useEffect`
- [x] Passed to `<WarmupSection barWeightKg={barWeightKg} />`

## Plate Calculator

**`apps/parakeet/src/components/session/PlateCalculatorSheet.tsx`:**
- [x] `STORAGE_KEY` changed from `'plateCalc_barKg'` to `'bar_weight_kg'` — unified with the settings key, so both UIs stay in sync

## Notes

- All engine defaults remain 20 — no behavior change without an explicit settings change
- 409 engine tests pass unchanged (defaults cover all existing test cases)
