# Feature: Auxiliary Exercise Types

**Status**: Implemented

**Date**: 2026-03-07

> **Design Doc Philosophy**: This document describes WHAT the feature does and WHY, from a user perspective.

## Overview

Not every auxiliary exercise is a loaded barbell movement. Pullups are bodyweight. An assault bike interval is timed cardio. Currently, the JIT generator treats every auxiliary exercise as a weighted movement and assigns it a weight derived from the lifter's 1RM — which produces meaningless numbers for exercises that have no load.

This feature introduces an explicit exercise type system so the engine, logging, and UI each behave correctly for each category.

## Problem Statement

The `buildAuxiliaryWork()` pipeline assigns `weight_kg` and `reps` to every auxiliary exercise using `AUX_WEIGHT_PCT` (defaults to 67.5% of 1RM) and `AUX_REP_TARGETS`. For exercises like:

- **Pull-ups** — bodyweight movement; assigning 67.5% of squat 1RM as a "weight" is nonsensical. It should be logged as reps only (or reps + optional added load).
- **Assault Bike 5 mins** — conditioning; has no meaningful weight or rep count. Duration is the only relevant metric, already embedded in the exercise name.

Logging these exercises as weight+reps creates noise in session history, confuses volume accounting, and makes the session screen feel broken.

## Exercise Types

| Type | Description | Examples |
|---|---|---|
| `weighted` | Loaded exercise — weight is meaningful | Romanian DL, Dumbbell Curl, Lat Pulldown, Good Mornings |
| `bodyweight` | Body-weight movement — no external load by default | Pull-ups, Dips, Push-ups, Pistol Squat, Nordic Hamstring Curl |
| `timed` | Conditioning/cardio — measured by duration or output, not reps | Assault Bike 5 mins, Sled (if timed), Farmer's Carry |

## User Experience

### Session Screen

**Weighted exercise**: unchanged — weight input + reps input, plate calculator available.

**Bodyweight exercise**: weight input is hidden. Only reps are shown. An optional "Add weight" affordance (+ icon) reveals a weight field for loaded variants (e.g. weighted pullups with a belt).

**Timed exercise**: no input fields. The exercise name contains the prescription (e.g. "Assault Bike 5 mins"). A "Mark complete" checkbox is shown instead of inputs. Completed = logged with weight 0, reps 0, notes = name.

### Session History

- **Weighted**: shows weight × reps as usual.
- **Bodyweight**: shows "BW × reps" (or "+ Xkg × reps" if loaded).
- **Timed**: shows exercise name only (e.g. "Assault Bike 5 mins ✓").

### Volume Accounting

Timed exercises contribute volume via their muscle mapping (if any — cardio exercises may have no primary muscle mapping and contribute 0 volume sets). Bodyweight exercises count normally via their muscle contribution.

## Design Decisions

**Type is assigned at the engine level** — `packages/training-engine/src/auxiliary/exercise-catalog.ts` is the canonical source of truth. `exercise-types.ts` delegates to the catalog via a fast `Map` lookup, with a small fallback table for common user-typed spelling variants (e.g. "Pull Ups", "Pullups"). The UI reads type from `AuxiliaryWork.exerciseType` rather than trying to infer it from the exercise name.

**Single catalog, derived artifacts** — `EXERCISE_CATALOG` is the single typed source of truth. `DEFAULT_AUXILIARY_POOLS`, `getMusclesForExercise()`, `getExerciseType()`, and the manual-add picker all derive from it. Adding an exercise requires editing only `exercise-catalog.ts`.

**Unknown exercises default to `weighted`** — custom exercises the user adds that aren't in the catalog get `weighted` behaviour, which is the safest default (weight and reps are optional to fill in).

**`timed` exercises are not skipped at MRV** — they don't consume meaningful muscle sets, so MRV gating does not apply. They are always included unless the session is skipped entirely.

## References

- Related Design Docs: [volume-management.md](./volume-management.md), [ad-hoc-auxiliary-exercises.md](./ad-hoc-auxiliary-exercises.md)
- Related Spec: [data-002-auxiliary-exercise-config.md](../specs/05-data/data-002-auxiliary-exercise-config.md)
- Engine: `packages/training-engine/src/auxiliary/exercise-catalog.ts`
