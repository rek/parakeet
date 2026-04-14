# Feature: Custom Exercise Muscle Selection

**Status**: Implemented

**Date**: 14-Apr-2026

> WHAT and WHY only. HOW is in spec-custom-muscles.md.

## Overview

When a user adds a custom exercise (a name not found in the built-in catalog), they are currently never asked which muscles it works. The app stores an empty `primary_muscles` array, so custom exercises are invisible to volume tracking and JIT session generation.

This feature adds a muscle-selection step to the custom exercise creation flow, and wires those muscles through to the training engine so volume attribution and JIT top-up work correctly.

## Problem Statement

- Custom exercises always get `primary_muscles: []` in the database
- The JIT top-up filter (`buildVolumeTopUp`) only considers exercises that target a deficient muscle — custom exercises never qualify, so the user's pool is effectively ignored for volume gap filling
- The post-main-lift fatigue discount in `processAuxExercise` also reads muscles — custom exercises receive no discount, making intensity too high
- The exercise scorer ranks custom exercises poorly (no muscle data = no context-aware ranking)

## User Experience

### Primary Flow

1. User opens Settings → Auxiliary Exercises
2. User types a name not found in the catalog (e.g. "Banded Hip Thrust")
3. App shows "Add 'Banded Hip Thrust'" option
4. User taps it → modal switches to a **muscle picker step** (replaces the search list)
5. User sees all 10 muscle groups grouped by category (Legs / Push / Pull / Core) as selectable chips
6. User selects one or more muscles (e.g. Glutes, Hamstrings)
7. User taps "Add Exercise" — exercise is added to the pool with the selected muscles

### Alternative Flows

- **Back without selecting**: User taps back arrow → returns to search view, no exercise added
- **Catalog exercise**: No change — muscle selection step is skipped entirely; catalog muscles are used automatically
- **Editing pool order**: Existing custom exercises keep their stored muscles; no re-selection needed on reorder

### Visual Design Notes

- Muscle picker renders inside the same modal sheet — no new screen, no nested modal
- Chips are grouped with a small category label (Legs / Push / Pull / Core)
- Selected chips use `colors.primary` fill; unselected use the same style as existing muscle chips in the exercise list
- "Add Exercise" button appears below the chip grid; disabled until at least one muscle is selected
- Back arrow in the picker header returns to the search step

## User Benefits

**Correct volume attribution**: Custom exercises count toward weekly muscle volume, preventing the system from prescribing redundant top-up work.

**Appropriate fatigue discounts**: The post-main-lift intensity reduction applies correctly when the custom exercise overlaps the primary lift's muscles.

**Honest exercise ranking**: The scorer can prefer or deprioritize a custom exercise based on actual muscle overlap, not a blank slate.

## References

- Spec: [spec-custom-muscles.md](./spec-custom-muscles.md)
- Related: [spec-config.md](./spec-config.md)
- GitHub: rek/parakeet#192
