---
feature: lipedema-tracking
status: done
modules: [lipedema-tracking]
---
# Lipedema Tracking

Daily-upsert symptom + limb-circumference log (expected cadence
weekly, but daily entries permitted). The primary observability layer
for whether the nutrition protocol (gh#199) is actually moving the
needle on the user's lipedema. Prereq for training-correlation
insights (gh#204).

## Design

- [design.md](./design.md) — what we track, why those five landmarks,
  why weekly cadence, why no bioimpedance body-fat.

## Specs

| Spec | Status | Concern |
| --- | --- | --- |
| [spec-data-layer.md](./spec-data-layer.md) | done | `lipedema_measurements` table + RLS + `updated_at` trigger + module scaffold + entry UI (date nav, per-limb deltas, edit-from-history, toasts) + feature flag + drawer |

## Scope

In:
- Per-day measurement entry (upsert — one row per user per day).
- Five limb landmarks × L/R: thigh mid, calf max, ankle, upper arm, wrist (millimetres at the DB boundary; cm with 1 decimal in the UI).
- Pain 0–10, swelling 0–10 (0.5 step).
- Notes.
- Date navigator (prev / next / today) — log or edit any past day.
- Per-limb delta tag vs the most recent prior non-null value.
- "Pre-fill from last entry" quick-fill.
- History list: tap to load into form, trash icon to delete (confirmed), full per-limb summary + pain/swelling chips + notes preview.
- Save / delete toast.

Out (deferred to later phase-2 slices under gh#204):
- Photo upload (column is in the schema; UI not yet wired).
- Trend charts (pure helpers `limbTrend`, `seriesDrift`, `adjacentDelta`, `priorValue` are in place; no chart component yet).
- Training correlation overlay.
- Automated reminders.

## Phase-2 siblings

gh#204 — intake logging, training correlation, supplement personal layer, shopping list, meal planner, LLM critic, habit nudges, multi-category foods. This feature is the first slice of gh#204 after macro targets.
