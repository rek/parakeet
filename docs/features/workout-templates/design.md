# Feature: Workout Templates

**Status**: Implemented (v1)

**Date**: 19 May 2026

**Issue**: [GH#214](https://github.com/rek/parakeet/issues/214)

## Overview

Globally-shared, user-editable workout bundles. A "template" is a curated
list of exercises with per-item duration/reps and per-item rest, repeated
for N rounds. Any lifter can drop a template into their current session in
one tap; the template expands into a flat sequence of regular session
entries that the rest of the session machinery already understands.

## Problem Statement

Lifters who want to do structured conditioning blocks (HIIT, EMOM,
finishers) currently have to manually add each exercise, every round,
every time. There's no shared library of "these three movements, this
rest, five rounds." Building one up by hand for every session is friction
that pushes people away from doing conditioning work at all.

## User Experience

### User Flows

**Insertion (lifter mid-session):**
1. Open in-progress session
2. Tap "+ Add Workout"
3. Pick a template (e.g. "HIIT — Bike/Ski/Row")
4. 15 entries appear in the session list (3 items × 5 rounds), grouped
   under a visual band labelled with the template name
5. Lifter performs the block; rest timer between each entry honours the
   template's per-item rest, not the user's default rest preference

**Management (any authenticated user):**
1. Settings → Workout Templates
2. See the global library; tap one to edit, or "+ New" to create
3. Edit: name, description, rounds; ordered item list (add/remove/reorder);
   per-item duration or reps + rest seconds; exercise picker reuses the
   existing AddExerciseModal
4. Save → appears in everyone's library

### Visual Design Notes

- "+ Add Workout" button sits next to the existing "+ Add Exercise"
- Inserted entries share a subtle visual band ("HIIT · 3/15") with a
  long-press "Remove block" affordance
- Wiki-style edits — no admin gate. `created_by`/`updated_by` tracked for
  accountability

## Decisions (locked in via GH#214 discussion)

| Decision | Choice |
|---|---|
| Session structure | Flat expansion. No new circuit/superset concept. |
| Per-item rest | Durable — stored on each in-session entry. Also enables future "plan a session with different rest per exercise" generally. |
| Template visibility | Global, shared across all users. |
| Edit permissions | Wiki-style. Any authenticated user. |
| Catalog reference | Stable slug in `workout_template_items.exercise_slug` (paired with display-name snapshot in `exercise`). Same pattern as `set_logs.exercise_slug` and `auxiliary_exercises.exercise_slug` — see GH#215. Catalog renames no longer require DB sweeps. |
| Volume credit | Inherited from catalog `primary_muscles`. No override column. |
| Skip-rounds mid-template | Deferred. |
| `MAX_AUX_EXERCISES` cap | Templates exempt — cap is for JIT-selected aux only. |

## User Benefits

- **Faster conditioning sessions**: tap once instead of 15 add-exercise taps.
- **Shared library**: best HIIT/EMOM/finisher combos curated by the community
  rather than reinvented per lifter.
- **Per-item rest honoured**: a 20-second rest in a HIIT block isn't
  overridden by the user's 120-second main-lift default.

## Open Questions

(None — all resolved during GH#214 discussion.)

## References

- GH#214 — Issue + locked-in decisions
- GH#215 — Stable slug refactor (landed)
- [spec-schema.md](./spec-schema.md)
- [spec-management.md](./spec-management.md)
- [spec-insertion.md](./spec-insertion.md)
