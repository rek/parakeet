---
feature: lipedema-tracking
status: done
modules: [lipedema-tracking]
---
# Lipedema Tracking

Weekly symptom + limb-circumference log. The primary observability
layer for whether the nutrition protocol (gh#199) is actually moving
the needle on the user's lipedema. Prereq for training-correlation
insights (gh#204).

## Design

- [design.md](./design.md) — what we track, why those five landmarks,
  why weekly cadence, why no bioimpedance body-fat.

## Specs

| Spec | Status | Concern |
| --- | --- | --- |
| [spec-data-layer.md](./spec-data-layer.md) | done | `lipedema_measurements` table + RLS + module scaffold + entry UI + feature flag + drawer |

## Scope

In:
- Per-day measurement entry (upsert — one row per user per day).
- Five limb landmarks × L/R: thigh mid, calf max, ankle, upper arm, wrist (millimetres at the DB boundary; cm with 1 decimal in the UI).
- Pain 0–10, swelling 0–10 (0.5 step).
- Notes.
- History list with delete.

Out (deferred to later phase-2 slices under gh#204):
- Photo upload (column is in the schema; UI not yet wired).
- Trend charts (hook `latestDelta` + `limbTrend` are in place; no chart yet).
- Training correlation overlay.
- Automated reminders.

## Phase-2 siblings

gh#204 — intake logging, training correlation, supplement personal layer, shopping list, meal planner, LLM critic, habit nudges, multi-category foods. This feature is the first slice of gh#204 after macro targets.
