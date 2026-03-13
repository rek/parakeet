# Backlog

If you are a human, say to an Agent: **"Read docs/backlog.md and do item N"**

If you are an AI Agent, first read: `docs/README.md` and understand our intent and architecture.

Then always make sure to follow the [AI Workflow](./guide/ai-workflow.md) (orient → design → plan → implement → validate → wrap up).

At the end: update design doc status → Implemented, update specs to match what was actually built, update `implementation-status.md`, then review and add any learnings to `docs/guide/ai-workflow.md`.

---

## ~~2~~ (Done — 13 Mar 2026)

Fixed: unending lift rotation now uses history-based selection (last completed lift → next in rotation) instead of counter-based derivation. See [design doc](design/unending-programs.md#lift-rotation--history-based-updated-13-mar-2026).

## ~~1~~ (Done — 13 Mar 2026)

All exercises already existed in the catalog (Row Machine, Ski Erg, Run - Treadmill, Run - Outside, Toes to Bar, Plank). Fixed timed exercise logging UX: "Round N + duration (min)" input instead of "Complete / as prescribed"; RPE picker and rest timer suppressed for timed exercises. Users can add any of these via Settings › Auxiliary Exercises → General filter.

## 9

4-day programs with overhead press as a first-class primary lift. See [design doc](design/four-day-ohp.md) and [implementation status](specs/implementation-status.md#planned--future). ~30 files, 8 specs.

## 13

**Training-age-scaled MRV/MEV.** RP Strength research shows beginners tolerate less volume and advanced lifters handle more. `Persona.trainingAge` exists but isn't used for volume calculations. Add a training-age multiplier to MRV/MEV defaults (e.g., beginner ×0.8, intermediate ×1.0, advanced ×1.2). Validate with simulation.

## 14

**Simulation CI improvements.** The `training-sim:validate` target runs in CI. Future work: add threshold tracking (warn if violations increase between PRs), generate JSON artifacts for trend analysis, add more life scripts (e.g., peaking, competition prep, return-from-layoff).
