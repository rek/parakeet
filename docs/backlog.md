# Backlog

If you are a human, say to an Agent: **"Read docs/backlog.md and do item N"**

If you are an AI Agent, first read: `docs/README.md` and understand our intent and architecture.

Then always make sure to follow the [AI Workflow](./guide/ai-workflow.md) (orient → design → plan → implement → validate → wrap up).

At the end: update design doc status → Implemented, update specs to match what was actually built, update `implementation-status.md`, then review and add any learnings to `docs/guide/ai-workflow.md`.

---

## 2

im on unending plan, i just completed squat, now it has a new planned squat workout for me planned? you need to review my exact data in local supabase to see what is happening

## 3

there seems to be a logic flow issue with 'done lifting' the rest timer, the rpe popup and the 'tick' button that triggers this flow.

you need to think through all this, tracing the code path of a real use case for a full workout. take note of which popups appear and when and if they make sense

## 4

when we get: 'completed' / 'failed' options after a lift. in the failed screen, we should also get in the nice popup the inputs to modify the reps we hit. and after entering that it ticks the set.

## 9

4-day programs with overhead press as a first-class primary lift. See [design doc](design/four-day-ohp.md) and [implementation status](specs/implementation-status.md#planned--future). ~30 files, 8 specs.

## 10 (bug)

**Auxiliary rotator block 4+ gap.** `generateAuxiliaryAssignments` in `auxiliary-rotator.ts` hardcodes `blockNumber <= 3` and ignores `_totalWeeks`. Programs longer than 9 weeks (4+ blocks) get no aux assignments for later blocks — the app falls back to hardcoded defaults. The simulator works around this with mod-3 wrapping, but the engine function should generate assignments for all blocks derived from `totalWeeks`.

## 11 (bug)

**No-equipment session exercise cap.** During no-equipment disruptions, bodyweight compensation can push sessions to 7+ exercises (vs recommended max 6). The existing cap logic in `jit-session-generator.ts` doesn't fully prevent this. Tighten the cap or reduce bodyweight exercise count.

## 12

**Zero-volume muscle coverage in early blocks.** Chest/triceps/shoulders can receive zero direct volume in blocks where squat and deadlift days dominate (before volume top-up kicks in). Consider front-loading a small amount of push work or adjusting top-up trigger sensitivity.

## 13

**Training-age-scaled MRV/MEV.** RP Strength research shows beginners tolerate less volume and advanced lifters handle more. `Persona.trainingAge` exists but isn't used for volume calculations. Add a training-age multiplier to MRV/MEV defaults (e.g., beginner ×0.8, intermediate ×1.0, advanced ×1.2). Validate with simulation.

## 14

**Simulation CI improvements.** The `training-sim:validate` target runs in CI. Future work: add threshold tracking (warn if violations increase between PRs), generate JSON artifacts for trend analysis, add more life scripts (e.g., peaking, competition prep, return-from-layoff).
