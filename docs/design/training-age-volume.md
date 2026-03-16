# Feature: Training-Age-Scaled MRV/MEV

**Status**: Implemented

**Date**: 16 Mar 2026

## Overview

Scale MRV/MEV volume thresholds by training age (beginner/intermediate/advanced). RP Strength research shows beginners tolerate less training volume before exceeding recovery capacity, while advanced lifters can handle more. Currently all athletes get the same MRV/MEV defaults (differentiated only by biological sex).

## Problem Statement

**Pain points:**
- A beginner lifter gets the same MRV cap (e.g., 20 sets/week quads) as an intermediate lifter. Beginners can't recover from this volume — the system prescribes too much.
- An advanced lifter is capped at the same MRV as an intermediate. They could handle more volume but the system holds them back.
- `Persona.trainingAge` exists in the simulation but is never used for volume calculations — it's a dead field.

**Desired outcome:** MRV/MEV defaults are scaled by training age multiplier so the JIT engine prescribes appropriate volume for each experience level. Validated by running all simulation scenarios without new violations.

## User Experience

This feature has no direct user-facing UI. It operates at the engine level:
- Beginner athletes see lower volume prescriptions (fewer sets per muscle group per week)
- Advanced athletes see higher volume prescriptions
- Intermediate athletes are unchanged (×1.0 baseline)

The simulation personas already carry `trainingAge`, so the validation is automatic.

### Future App Integration

When training age is eventually collected from users (onboarding or profile settings), the multiplier will flow through `getMrvMevConfig` in the app. That UI work is out of scope for this item.

## What We Chose NOT To Do

- **No per-muscle multiplier tuning** — a single multiplier per training age keeps it simple and matches RP's general guidance. Per-muscle tuning is over-engineering for 2 users.
- **No gradual scaling** (e.g., years of training → continuous multiplier) — the three-tier model is sufficient and matches how RP Strength presents the research.
- **No app UI** — this item is engine + simulation only. App collection of training age is a separate backlog item.

## References

- RP Strength volume landmarks research (Dr. Mike Israetel)
- Related Design Docs: [volume-mrv-methodology.md](./volume-mrv-methodology.md), [sex-based-adaptations.md](./sex-based-adaptations.md)
