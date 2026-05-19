---
feature: workout-templates
status: implemented
modules: [workout-templates, session]
---
# Workout Templates

Curated, globally-shared workout bundles (e.g. HIIT circuits) that any lifter
can insert into their current session in one tap.

Originates from GH#214. Catalog-slug refactor deferred to GH#215.

## Design
- [design.md](./design.md) — Goal, user flows, decisions, scope

## Specs
| Spec | Status | Concern |
|------|--------|---------|
| [spec-schema.md](./spec-schema.md) | done | Tables, RLS, store extension, data module |
| [spec-management.md](./spec-management.md) | done | Settings list + edit screens, CRUD hooks |
| [spec-insertion.md](./spec-insertion.md) | done | AddWorkoutTemplateModal + session expansion (interleaved AuxTemplateBlock with round badges) + per-item rest wiring + bulk-remove + weight auto-suggest |
