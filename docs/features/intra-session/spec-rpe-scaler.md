# Spec: RPE Scaler Linear Interpolation

**Status**: Implemented

**Domain**: Training Engine

## What This Covers

Replace the step function in `rpe-scaler.ts` with linear interpolation between anchor points. The current step function creates a 4.3x cliff at RPE 7.0 (6.9 → 0.15, 7.0 → 0.65), causing half-point RPEs to be dramatically undervalued. An entire bench explosive session at RPE 6.5 produced 0.9 effective chest sets — 11% of weekly MEV — because every set fell in the `< 7.0` bracket.

Linear interpolation preserves the anchor points (integer RPEs unchanged) but smooths the curve so half-point RPEs are valued proportionally. See [domain/muscle-mapping.md](../../domain/muscle-mapping.md) for the RPE-to-effective-sets research basis and [design/intra-session-adaptation.md](./design.md) for the full problem analysis.

GitHub Issue: #130

## Tasks

**`packages/training-engine/src/volume/rpe-scaler.ts`:**

- [x] Replace step function with piecewise linear interpolation between anchor points
  - Anchor points: 6.0 → 0.15, 6.5 → 0.30, 7.0 → 0.65, 8.0 → 0.85, 9.0 → 1.0
  - Below 6.0 → 0.0 (unchanged)
  - 9.0 and above → 1.0 (unchanged)
  - `undefined` → 1.0 (unchanged)
  - Between anchors: `lerp(lowerMultiplier, upperMultiplier, (rpe - lowerRpe) / (upperRpe - lowerRpe))`
  - Example outputs: 6.5 → 0.30, 7.5 → 0.75, 8.5 → 0.925
- [x] Update JSDoc comment with new curve description and example values

**`packages/training-engine/src/volume/__tests__/rpe-scaler.test.ts`:**

- [x] Update existing tests for integer RPEs (behavior unchanged — anchor points hold)
- [x] Add half-point RPE tests: 6.5 → 0.30, 7.5 → 0.75, 8.5 → 0.925
- [x] Add boundary tests: 5.9 → 0.0, 9.5 → 1.0
- [x] Add quarter-point tests: 6.25 → 0.225, 6.75 → 0.475
- [x] `undefined` → 1.0 (unchanged)
- [x] Monotonicity invariant expanded to include half-point RPEs

**`docs/domain/muscle-mapping.md`:**

- [x] Update RPE-to-Effective-Sets table to show anchor points + interpolated examples
- [x] Note the change from step function to piecewise linear interpolation
- [x] Keep existing research citations (Refalo 2023/2024)

**Simulation baseline (if affected):**

- [x] Run `npx nx test training-engine` — all 1191 tests pass
- [ ] Run simulation suite — check if baseline thresholds shift
- [ ] Update `baseline.json` if thresholds change (volume numbers will increase for sessions with non-integer RPE)

## Dependencies

- None — self-contained change. All consumers of `rpeSetMultiplier()` get the improvement automatically.
