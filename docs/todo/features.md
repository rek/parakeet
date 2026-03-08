# Features

This contains a list of new features to implement. An AI agent should work through this list and complete them.

Always consider the docs/designs first, to find where each feature request fits into the overall architecture of the app.

Always start by understanding basic docs overview: `docs/README.md`
Then ALWAYS read about the feature in question, first find the relevant design doc, then read its specs:

- `docs/design/*.md`
- `docs/specs/**/*.md`

At the end: update design doc status → Implemented, update specs to match what was actually built, update `IMPLEMENTATION_STATUS.md`, then review this whole process and add any learnings to `docs/AI_WORKFLOW.md`.

## 1

Muscle mappings per aux exercise + JIT volume augmentation (auto-add targeted aux when muscles are below MEV).

**Design docs:**
- [docs/design/volume-management.md](../design/volume-management.md) — "Auxiliary Exercise Muscle Mapping" section
- [docs/design/jit-volume-augmentation.md](../design/jit-volume-augmentation.md) — the auto-augment JIT idea

**Spec:** [docs/specs/05-data/data-002-auxiliary-exercise-config.md](../specs/05-data/data-002-auxiliary-exercise-config.md) — "Muscle Mapping Extension" section

**Implementation order:**
1. Wire muscle mappings to DB + show chips in UI ✅ (implemented)
2. Exercise type system (weighted/bodyweight/timed) ✅ (implemented — Bug 1)
3. JIT auto-augment — spec: [engine-027-jit-volume-augmentation.md](../specs/04-engine/engine-027-jit-volume-augmentation.md)
