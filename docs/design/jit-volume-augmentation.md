# Feature: JIT Volume Augmentation

**Status**: Implemented

**Date**: 7 Mar 2026

> **Design Doc Philosophy**: This document describes WHAT the feature does and WHY, from a user perspective. Technical implementation details (HOW) are tracked in specs for granular task management. Keep this doc user-focused, concise, and free of code/implementation specifics.

## Overview

When the JIT generator builds a session, it checks whether any muscle group is sitting below its Minimum Effective Volume (MEV) for the week. If so, it automatically adds auxiliary exercises targeted at those under-stimulated muscles — turning the session into a smart top-up rather than a fixed prescription.

This builds on the muscle mapping foundation (Feature 1 — aux exercise → muscle group) to make the program self-correcting when volume is being missed.

## Problem Statement

The program prescribes a fixed auxiliary block each session. But training is messy — sessions get skipped, disruptions happen, some weeks the main lift dominates and the auxiliary work barely scratches a muscle group. By the end of the week, a muscle can be well below MEV with no prescribed work left to make it up.

Currently:

- The system knows which muscles are below MEV (the volume dashboard shows this)
- But it does nothing about it — the next session's program is unchanged
- The user has to notice the gap themselves and add ad-hoc sets

Desired outcome: if a muscle is under-stimulated and there's capacity left in the session, the program adds appropriate aux work automatically.

## User Experience

### Primary Flow

1. User opens today's session — it generates as usual
2. At the bottom of the auxiliary work section, a new "Volume Top-Up" card appears
3. The card explains: _"Your hamstrings are below their weekly minimum. We've added Romanian DLs to today's session."_
4. The user sees 2–3 extra sets of a targeted exercise, clearly labelled as auto-added
5. They complete them like any other aux set — or skip them individually

### When it doesn't appear

- No muscles are below MEV for the week
- The main lift's MRV is already maxed out (no room to add volume safely)
- The session is a deload week (volume intentionally reduced)
- The user has set a muscle to MEV = 0 (e.g. glutes for some users)

### Edge Cases

- **Multiple muscles below MEV**: Up to 2 muscles can trigger top-up exercises per session; priority goes to the most deficient (furthest below MEV as a %)
- **No exercise in the pool targets the deficient muscle**: No top-up is added; a warning is shown on the volume dashboard instead
- **User skips the top-up**: Sets are logged as skipped, same as regular aux skips. MEV status remains low and will trigger again next session if still relevant.

### Visual Design Notes

- Top-up exercises appear in a visually distinct section below regular aux work — e.g. a subtle divider with "Auto-added: volume top-up" label
- The rationale is always shown inline (which muscle, why)
- Top-up exercises are dismissible — the user can remove them before starting

## User Benefits

**Self-correcting training**: Missed volume gets made up automatically without the user needing to notice or do anything.

**Smarter than a static program**: The session adapts to what actually happened this week, not just what was planned.

**Transparent**: The system explains exactly why it added extra work, building the user's understanding of MEV/MRV over time.

## Dependencies

This feature requires:

- **Muscle mappings per aux exercise** (Feature 1) — the engine must know which muscles each exercise targets before it can select appropriate top-up exercises
- **Exercise type system** (Bug 1) — only `weighted` and `bodyweight` exercises can be auto-added; `timed` cardio is excluded from top-ups

## Open Questions

- [ ] Should top-up exercises be drawn only from the user's existing pool, or from a wider set of exercises?
- [ ] What's the cap on auto-added sets? (Proposed: max 3 sets per top-up exercise, max 1 top-up exercise per deficient muscle)
- [ ] Should the user be able to disable this feature entirely in settings?

## References

- Related Design Docs: [volume-management.md](./volume-management.md), [auxiliary-exercise-types.md](./auxiliary-exercise-types.md)
- Backlog: [docs/backlog.md](../backlog.md) — Item 1
- Engine: `packages/training-engine/src/auxiliary/auxiliary-rotator.ts`, `packages/training-engine/src/generator/jit-session-generator.ts`
