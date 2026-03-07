# Feature: Ad-Hoc Auxiliary Exercises

**Status**: Implemented

**Date**: 7 Mar 2026

> **Design Doc Philosophy**: This document describes WHAT the feature does and WHY, from a user perspective.

## Overview

During a live session, users can now add any exercise on the fly — not just what the program prescribed. Sets logged this way are saved alongside prescribed work and count toward session history.

## Problem Statement

The program generates a fixed auxiliary block for each session. In practice, athletes are spontaneous: they feel like doing face pulls, notice a cable machine is free, or want to add a pump set after their main work. Being locked to only the prescribed list creates friction and means unplanned work goes untracked.

## User Experience

### User Flows

**Adding an exercise mid-session:**

1. User scrolls below the Auxiliary Work section (or the main sets if no aux was prescribed)
2. Taps the dashed "+ Add Exercise" button
3. A modal appears with a text input — user types the exercise name (e.g. "face pulls")
4. Taps "Add" (or hits Return)
5. The exercise appears in the Auxiliary Work section with one set row, pre-filled with the last set's weight/reps as a starting point

**Adding more sets to the same exercise:**

1. A small "+ Set" button sits next to the exercise name
2. Tapping it appends another row, copying the previous set's values as defaults

**Session resume:**

- If the user navigates away and returns (e.g. switches tabs), any ad-hoc exercises they added are restored from the persisted store state — no work is lost

### Visual Design Notes

- The "+ Add Exercise" button uses a dashed border and muted text to read as optional, not a primary action
- Ad-hoc exercises render identically to prescribed ones inside the Auxiliary Work section
- The modal is minimal: a single text input, Cancel + Add buttons

## User Benefits

**Freedom**: Log whatever you actually do, not just what was planned.

**Continuity**: Unplanned sets are saved just like prescribed ones — they appear in session history and aux volume totals.

**Low friction**: Name entry is the only required step; weight/reps pre-fill from the previous set so you're not starting from zero.

## References

- Related Spec: [mobile-005-session-logging-screen.md](../specs/09-mobile/mobile-005-session-logging-screen.md)
- Related Spec: [mobile-030-ad-hoc-auxiliary-exercises.md](../specs/09-mobile/mobile-030-ad-hoc-auxiliary-exercises.md)
