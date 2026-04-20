---
feature: nutrition
status: done
modules: [nutrition]
---
# Nutrition

Lipedema / RAD / keto diet protocol catalog — foods, supplements,
lifestyle, evidence grading, Nepal-specific sourcing. Research-grade
catalog gated behind a feature flag; turned into a 6-tab in-app view
(Overview / Foods / Supplements / Lifestyle / Compare / Sources).

See the canonical handoff: **[gh#199](https://github.com/rek/parakeet/issues/199)**.

## Design

- [design.md](./design.md) — why this lives in parakeet, protocol
  sources of truth, seeding flow, feature-flag gate.

## Specs

| Spec | Status | Concern |
| --- | --- | --- |
| [spec-data-layer.md](./spec-data-layer.md) | done | CSV/MD source of truth, 3 migrations, seed pipeline, parsers + tests |
| [spec-ui.md](./spec-ui.md) | done | 6-tab screen composition, markdown rendering, source extraction |
| [spec-evidence-calibration.md](./spec-evidence-calibration.md) | done | A/B/C grading, 2025 scoping review calibration, Lundanes 2024 RCT as primary |
| [spec-nepal-sourcing.md](./spec-nepal-sourcing.md) | done | Daraz brand confirmations, iHerb fallback list, tree-nut-allergy gotcha |
| [spec-prod-push.md](./spec-prod-push.md) | done | Unified env-driven seed script, migration push, seeder dedupe fix |

## Phase-2 candidates (not in this delivery)

Tracked in gh#199 comments. Each is a separate issue when prioritised:

- Intake logging — `user_diet_intake` table, tap-to-mark on daily ritual items.
- Symptom + measurement tracking — `lipedema_measurements` (leg circumference, pain, swelling, photos).
- Training correlation — overlay adherence onto Wilks / density / soreness. The unique-to-parakeet angle.
- Shopping list generator.
- Meal planner.
- Supplement personal layer (`user_diet_supplements`).
- LLM protocol critic.
- Habit nudges via rest-notification plumbing.
- Multi-category foods (schema + UI for avocado appearing under both Fats and Fruits).
