---
feature: dashboard
status: in-progress
modules: [apps/dashboard]
---
# Dashboard

The internal admin SPA at `apps/dashboard/`. Reads Supabase directly (local + prod), previews video analysis fixtures, and exercises engine code paths against test data.

## Design
- [design-coach-panel.md](./design-coach-panel.md) — LLM coaching pipeline wired into the Video Overlay page (implemented 2026-04-19)

## Specs
| Spec | Status | Concern |
|------|--------|---------|
| [spec-coach-panel.md](./spec-coach-panel.md) | implemented | "Coach" panel wiring + transport + render |
