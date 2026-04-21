# Session Prescription

JIT (Just-In-Time) session generation pipeline: steps, constants, and rules.

Related docs: [periodization.md](periodization.md) for block loading tables, [volume-landmarks.md](volume-landmarks.md) for MEV/MRV values, [muscle-mapping.md](muscle-mapping.md) for contribution factors.

---

## JIT Pipeline (10 Steps)

Steps execute in order. Each step may modify `sets`, `intensity`, or `reps` fields on the prescription. Step 0 is the only step that can **increase** volume; steps 1-9 can only reduce or leave unchanged.

| Step | Name                        | What it does                                                                                       |
|------|-----------------------------|----------------------------------------------------------------------------------------------------|
| 0    | `applyVolumeCalibration`    | Adjusts base set count up or down (-2 to +3) based on RPE trends, capacity signals, and modifier learning. See [adaptive-volume.md](../design/adaptive-volume.md). |
| 1    | `initPipeline`              | Sets base sets, reps, %1RM, and RPE from formula config (block × intensity type).                 |
| 2    | `applyRpeAdjustment`        | Looks at last 2 sessions' avg RPE deviation. Tiered: ≥ 0.75 over → ×0.975 (small) or ×0.95 (large, ≥ 1.25). ≤ −0.75 under → ×1.025 (small) or ×1.05 (large, ≤ −1.25). |
| 3    | `applyReadinessAdjustment`  | Applies sleep and energy modifiers. See [adjustments.md](adjustments.md).                         |
| 4    | `applyCyclePhaseAdjustment` | Applies menstrual phase modifiers. See [adjustments.md](adjustments.md).                          |
| 5    | `applySorenessAdjustment`   | Uses worst soreness score across primary muscles for the prescribed lift. See [adjustments.md](adjustments.md). |
| 6    | `applyMrvCap`               | If any primary muscle is at or over MRV, skips or caps sets. See MRV Cap section below.           |
| 7    | `applyDisruptionAdjustment` | Major disruption → skip. Moderate → reduce sets. Minor → log only.                               |
| 8    | `buildFinalMainSets`        | Applies all multipliers, rounds weight to nearest 2.5 kg.                                         |
| 9    | `processAuxExercise`        | Selects 2 aux exercises and runs volume top-up logic.                                              |

**Source:** `packages/training-engine/src/generator/jit-session-generator.ts`, `packages/training-engine/src/generator/steps/`

---

## Compounding Rules

When multiple adjustments apply simultaneously:

| Scenario                              | Rule                                                                   |
|---------------------------------------|------------------------------------------------------------------------|
| Soreness + disruption both active     | Take `min()` per dimension (sets, intensity) — not additive.          |
| Major disruption                      | Overrides all prior adjustments; session is skipped or replaced.      |
| Soreness >= 9                         | Recovery session: 40% × 3 sets × 5 reps @ RPE 5.0. Overrides everything. |

**Source:** `packages/training-engine/src/generator/steps/`

---

## MRV Cap

Applied in step 6. Uses values from [volume-landmarks.md](volume-landmarks.md) and contributions from [muscle-mapping.md](muscle-mapping.md).

```
remaining[muscle] = MRV[muscle] - weeklyVolumeToDate[muscle]
```

| Condition              | Action                                                          |
|------------------------|-----------------------------------------------------------------|
| `remaining ≤ 0`        | Skip main lift entirely for this session.                       |
| `remaining > 0`        | Cap sets to `floor(remaining / contribution)` per muscle; take the most restrictive cap across all primary muscles. |

**Source:** `packages/training-engine/src/generator/steps/`

---

## Warmup Protocols

Bar weight floor is **20 kg** by default, configurable to **15 kg**. Duplicate consecutive weights are skipped. All percentages are of the first working set weight.

### Standard (Male)

| Step | % of Working Weight | Reps |
|------|---------------------|------|
| 1    | 40%                 | 5    |
| 2    | 60%                 | 3    |
| 3    | 75%                 | 2    |
| 4    | 90%                 | 1    |

### Standard (Female)

| Step | % of Working Weight | Reps |
|------|---------------------|------|
| 1    | 40%                 | 5    |
| 2    | 55%                 | 4    |
| 3    | 70%                 | 3    |
| 4    | 85%                 | 2    |
| 5    | 92.5%               | 1    |

### Minimal

| Step | % of Working Weight | Reps |
|------|---------------------|------|
| 1    | 50%                 | 5    |
| 2    | 75%                 | 2    |

### Extended

| Step | % of Working Weight | Reps |
|------|---------------------|------|
| 1    | 30%                 | 10   |
| 2    | 50%                 | 5    |
| 3    | 65%                 | 3    |
| 4    | 80%                 | 2    |
| 5    | 90%                 | 1    |
| 6    | 95%                 | 1    |

### Empty Bar

| Step | % of Working Weight | Reps |
|------|---------------------|------|
| 1    | 0% (bar)            | 10   |
| 2    | 50%                 | 5    |
| 3    | 70%                 | 3    |
| 4    | 85%                 | 1    |

**Source:** `packages/training-engine/src/generator/warmup-calculator.ts`

---

## Rest Time Defaults

Per-block rest seconds are defined in [periodization.md](periodization.md).

| Adjustment type    | Rule                                          |
|--------------------|-----------------------------------------------|
| LLM suggestion     | ± 60 s from formula default                   |
| User override      | Per-lift × per-intensity in `rest_configs` table |

**Source:** `packages/training-engine/src/cube/blocks.ts`

---

## Volume Top-Up

Runs after regular aux selection in step 9. Selects additional exercises for muscles that are below their pro-rated MEV threshold for the session.

### Pro-Rated MEV

```
proRatedMEV[muscle] = ceil(MEV[muscle] × sessionIndex / totalSessionsThisWeek)
```

Push muscles (chest, triceps, shoulders, biceps) that have zero contribution from the primary lift scheduled for this session use **full MEV** (not pro-rated).

### Core priority

No compound lift contributes to core, so core depends entirely on aux/top-up volume. Raw-deficit sort would bury core behind larger hinge/pull deficits every session. When core is in deficit, one top-up slot is always reserved for core; the other goes to the highest-deficit non-core muscle. Still capped at 2 muscles per session (gh#203).

### Selection Rules

| Constraint              | Value / Rule                                             |
|-------------------------|----------------------------------------------------------|
| Max muscles per session | 2                                                        |
| Sets per exercise       | 3                                                        |
| Eligible exercises      | Primary movers only (contribution ≥ 1.0)                |
| Excluded exercises      | Timed exercises; lifts scheduled in upcoming sessions    |
| RPE target              | 7.5                                                      |
| Total aux cap           | `MAX_AUX_EXERCISES = 5` (includes regular aux + top-up) |

### Exercise Ranking

After filtering to eligible exercises, candidates are ranked by a multi-signal scorer (not first-match). The scorer uses soreness ratings, readiness (sleep + energy), movement pattern diversity, upcoming lift protection, main lift specificity, and compound/isolation balance. See [exercise-catalog.md](exercise-catalog.md#exercise-scoring-volume-top-up-selection) for factor weights and details.

**Source:** `packages/training-engine/src/generator/jit-session-generator.ts`, `packages/training-engine/src/auxiliary/exercise-scorer.ts`

---

## Intra-Session Mechanisms

These fire during the workout, after the JIT prescription is generated.

| Mechanism | Trigger | Effect |
|-----------|---------|--------|
| Weight autoregulation | RPE gap ≥ 1.0 below target after a main lift set | Suggests weight increase for next set (+2.5/+5 kg bench, +5/+10 kg squat/DL) |
| Volume recovery | Avg RPE gap ≥ 1.5 below target, sets were removed by modifiers | Offers to add removed sets back |
| Failure adaptation (main) | Failed set (reps < planned) | Tier 1: +60s rest → Tier 2: -5%/-10% weight → Tier 3: optional sets |
| Failure adaptation (aux) | Failed aux set | Immediate -10% weight on remaining sets of that exercise |

**Source:** `packages/training-engine/src/adjustments/weight-autoregulation.ts`, `volume-recovery.ts`, `intra-session-adapter.ts`
