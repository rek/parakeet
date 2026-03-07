# Feature: Bar Weight Setting

**Status**: Implemented

**Date**: 7 Mar 2026

## Overview

Allow the user to set their barbell weight (15 kg or 20 kg) from the settings page. The setting propagates to warmup weight floors, recovery mode floors, and the plate calculator — everywhere the app previously hardcoded 20 kg.

## Problem Statement

The app hardcoded a 20 kg bar in three separate places:

1. **Warmup calculator** — `Math.max(20, ...)` as the minimum warmup set weight; bar-only display label `"20 kg (bar)"`
2. **JIT session generator** — recovery mode floor `Math.max(20, ...)` for severe soreness
3. **Soreness adjuster** — same `Math.max(20, ...)` recovery floor (used by the standalone function)
4. **WarmupSection display** — hardcoded `if (weightKg <= 20) return 'Bar (20 kg)'`

Athletes using a 15 kg women's bar got incorrectly inflated warmup weights and a wrong bar label.

## Solution

A single AsyncStorage key (`bar_weight_kg`) holds the selected bar weight (15 or 20). Default is 20. All affected code paths accept it as an optional parameter defaulting to 20, so no existing behavior changes unless the user explicitly changes the setting.

### Architecture

- **No DB column** — bar weight is a device-level preference, not user profile data. AsyncStorage is appropriate.
- **Shared key** — `PlateCalculatorSheet` previously used its own key (`plateCalc_barKg`). It now uses `bar_weight_kg` so both settings stay in sync.
- **Engine params default to 20** — all engine function signatures keep `barWeightKg = 20` as a default, making the change non-breaking for existing call sites and tests.

## Affected Files

### Engine (packages/training-engine)
- `generator/warmup-calculator.ts` — `generateWarmupSets(weight, protocol, barWeightKg=20)`
- `adjustments/soreness-adjuster.ts` — `applySorenessToSets(sets, modifier, minSets, barWeightKg=20)`
- `generator/jit-session-generator.ts` — `JITInput.barWeightKg?: number`; destructured with default 20; passed to both call sites

### App (apps/parakeet)
- `modules/settings/lib/settings.ts` — `getBarWeightKg()`, `setBarWeightKg()`, `BarWeightKg` type
- `modules/jit/lib/jit.ts` — fetches bar weight in parallel with other JIT inputs, adds to `jitInput`
- `app/(tabs)/settings.tsx` — "Bar Weight" 15/20 toggle in Training section
- `components/training/WarmupSection.tsx` — accepts `barWeightKg` prop (default 20) for display label
- `app/(tabs)/session/[sessionId].tsx` — loads bar weight on mount, passes to `WarmupSection`
- `components/session/PlateCalculatorSheet.tsx` — storage key unified to `bar_weight_kg`

## References

- Spec: [mobile-031-bar-weight-setting.md](../specs/09-mobile/mobile-031-bar-weight-setting.md)
