# Spec: Barbell Plate Calculator

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

A sheet that tells the user exactly which plates to load for a given weight. Opens from any weight display in the session screen. Pure in-app calculation — no network calls, no DB writes.

## Tasks

**`packages/training-engine/src/formulas/plate-calculator.ts`:**
- [x] `calculatePlates(targetKg: number, barKg: number): PlateResult` — greedy algorithm (largest to smallest) returning plates per side and any unachievable remainder
  - Standard plate denominations (kg): [25, 20, 15, 10, 5, 2.5, 1.25]
  - If remainder > 0 after all plates assigned, return it in `remainder` field so the UI can flag it
- [x] Export `PlateResult` type: `{ platesPerSide: { kg: number; count: number }[]; barKg: number; totalKg: number; remainder: number }`
- [x] Unit tests in `plate-calculator.test.ts` (co-located, matching project convention):
  - `calculatePlates(100, 20)` → 1×25kg + 1×15kg per side, remainder 0
  - `calculatePlates(20, 20)` → empty plates, remainder 0 (bar only)
  - `calculatePlates(21, 20)` → remainder 0.5 (0.5kg unachievable with standard plates)
  - `calculatePlates(60, 15)` → correct women's bar result

**`apps/parakeet/src/components/session/PlateCalculatorSheet.tsx`:**
- [x] Bottom sheet (reuse existing sheet pattern from `LiftHistorySheet`) displaying plates per side as a stacked list
  - Each row: plate weight (bold) + count (e.g. "20 kg × 2")
  - Header row shows total weight and bar weight
  - If remainder > 0, show amber note: "Nearest achievable: Xkg — {remainder}kg short"
- [x] Bar weight toggle: 20 kg (default) / 15 kg — tapping switches instantly, no separate settings needed
  - Persist preference in AsyncStorage under key `plateCalc_barKg`
- [x] Empty state: if targetKg ≤ barKg, show "Bar only — no plates needed"

**`apps/parakeet/src/components/training/SetRow.tsx`:**
- [x] Add a small plate icon button inline with the weight input
  - Tapping opens `PlateCalculatorSheet` with current actual weight (falls back to planned weight if actual not yet entered)
  - Button only visible when `weightKg > 0`
- [x] Sheet open/close is independent of set state — rest timer and logging continue unaffected

## Dependencies

- [mobile-005-session-logging-screen.md](./mobile-005-session-logging-screen.md) — SetRow component lives here
- [mobile-017-rest-timer.md](./mobile-017-rest-timer.md) — timer must not be interrupted by sheet
- [engine-001-one-rep-max-formulas.md](../04-engine/engine-001-one-rep-max-formulas.md) — reuse `gramsToKg`/`kgToGrams` helpers from same formulas dir
