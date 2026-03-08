# Backlog

To assign work to an agent, say: **"Read docs/backlog.md and do item N"**

Follow the [AI Workflow](../guide/ai-workflow.md) (orient → design → plan → implement → validate → wrap up).
All items: remove when resolved

At the end: update design doc status → Implemented, update specs to match what was actually built, update `implementation-status.md`, then review and add any learnings to `docs/guide/ai-workflow.md`.

---

## 2 — Body-state review & readiness

At the end of the week, I want to review how my body feels and see if it matches what the system says it should feel, according to muscle group and MRV etc.

Consider if end-of-week is the right time for this. Consider if the start-of-workout readiness quiz should be more specific. Think about this holistically from a lifter's perspective — we want the system to always have the best accurate knowledge of how the body feels, so the next workout will be most effective (loading or deloading the right things, always training what is least sore).

What parts in our system lack this integration? Give suggestions.

- Design: Needs design doc. Related context: [volume-mrv-methodology.md](../design/volume-mrv-methodology.md), [disruption-management.md](../design/disruption-management.md)
- Specs: None yet

## 3 — Docs agent discoverability ✅

Optimize docs for agent discoverability. Done — this file is the single agent entry point, with doc links per item.

## 4

ERROR Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. .$Barbell Front Squat

Code: SlotDropdown.tsx
56 | autoFocus
57 | />

> 58 | <FlatList

     |             ^
