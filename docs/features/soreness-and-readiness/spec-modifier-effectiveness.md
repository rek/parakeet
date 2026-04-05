# Spec: Modifier Effectiveness Tracker

**Status**: Implemented

**Domain**: Training Engine

## What This Covers

Pure engine functions for tracking modifier effectiveness per athlete. Compares trace predictions (which modifiers were applied and with what multiplier) against actual RPE outcomes to compute calibration bias and suggest adjustments. Phase A of the auto-calibration system described in [prescription-trace-integration.md](../core-engine/design-prescription-trace.md).

## Tasks

**`packages/training-engine/src/analysis/modifier-effectiveness.ts`:**

- [x] `ModifierSample` type — source, multiplier, rpeTarget, rpeActual, optional sorenessLevel
- [x] `CalibrationResult` type — source, sampleCount, meanBias, suggestedAdjustment, confidence
- [x] `computeCalibrationBias({ samples })` — computes mean RPE bias and suggested multiplier adjustment
  - Confidence: exploring (<5), low (5-9), medium (10-19), high (20+)
  - Adjustment clamped to ±0.15
  - Bias-to-adjustment scale: 0.05 per RPE point
- [x] `shouldTriggerReview({ calibration, previousAdjustment? })` — true for low confidence, large adjustments (>5%), or direction flips
- [x] `canAutoApply({ calibration })` — true only for medium+ confidence AND small adjustments
- [x] `extractModifierSamples({ modifiers, rpeTarget, rpeActual })` — bridge from trace data to sample format
- [x] `applyCalibrationAdjustment({ defaultMultiplier, adjustment })` — applies adjustment with 0.5–1.2 clamp
- [x] 25 tests covering all functions, confidence thresholds, edge cases, clamping

## Dependencies

- [engine-040-prescription-trace.md](./engine-040-prescription-trace.md) — trace provides the modifier data this system analyzes
