# Exercise Catalog

Exercise types, weight scaling, rep targets, and auxiliary processing rules.

---

## Exercise Naming Convention

Format: `{Equipment} {Movement}` — equipment prefix first, always.

| Implement  | Prefix      | Example                    |
|------------|-------------|----------------------------|
| Barbell    | `Barbell`   | `Barbell Overhead Press`   |
| Dumbbell   | `Dumbbell`  | `Dumbbell Romanian Deadlift` |
| Kettlebell | `Kettlebell`| `Kettlebell Swing`         |
| Cable      | `Cable`     | `Cable Curl`               |
| Machine    | no prefix   | `Leg Press`, `Hack Squat`  |
| Bodyweight | no prefix   | `Pull-ups`, `Dips`         |

**Why this matters:** the weight scaling system (`computeAuxWeight`) detects implement type by checking whether the name *starts with* `Dumbbell` or `Kettlebell`. A name like `Romanian Dumbbell Deadlift` would silently get barbell linear scaling instead of the correct sqrt scaling. Always put the equipment first.

When adding a new exercise, use the explicit barbell/dumbbell variant names rather than a bare movement name (e.g. `Barbell Row` not `Row`). If the exercise exists for multiple implements, add a separate catalog entry for each.

---

## Exercise Types

| Type       | Weight        | Reps            | RPE/Rest          |
|------------|---------------|-----------------|-------------------|
| weighted   | Calculated    | From config     | Normal            |
| bodyweight | 0 (omitted)   | From config     | RPE/rest suppressed |
| timed      | 0             | 0 (duration)    | RPE/rest suppressed |

Type resolution (via `createExerciseTyper(customTypeMap?)`):

1. **Catalog** lookup — `EXERCISE_CATALOG` entry's `type` field. Always wins; a user can't mistype a known exercise.
2. **Custom type map** — per-user overrides keyed by exercise name. Populated from `auxiliary_exercises.exercise_type` (the type-picker step in `AddExerciseModal`) and threaded into JIT as `JITInput.customExerciseTypeMap`.
3. **Fallback table** — small map for common spelling variants (`Pull Ups`, `Pullups`, `Chin Ups`, `Push Ups`, `Step Up`, `Bodyweight Squat` → `bodyweight`).
4. **Default** — `weighted`.

`getExerciseType(name)` is the catalog-only resolver (no user context). Use it in engine paths that aren't user-aware; otherwise prefer the user-aware factory.

**Source:** `packages/training-engine/src/auxiliary/exercise-types.ts`

---

## Pool Categories

User-curated auxiliary pools live in the `auxiliary_exercises` table, keyed by the `lift` column. `AuxiliaryPoolCategory = Lift | 'core' | 'cardio'`.

| Category   | Default source                  | Surfaces in JIT?                                                                         |
|------------|---------------------------------|------------------------------------------------------------------------------------------|
| `squat`    | `DEFAULT_AUXILIARY_POOLS.squat` | Yes — block-rotated pair on squat days; also feeds merged top-up pool.                  |
| `bench`    | `DEFAULT_AUXILIARY_POOLS.bench` | Yes — block-rotated pair on bench days; also feeds merged top-up pool.                  |
| `deadlift` | `DEFAULT_AUXILIARY_POOLS.deadlift` | Yes — block-rotated pair on deadlift days; also feeds merged top-up pool.            |
| `core`     | `DEFAULT_CORE_POOL`             | Yes — feeds merged top-up pool. No compound contributes to core, so core relies on it.   |
| `cardio`   | `DEFAULT_CARDIO_POOL`           | No (effectively) — entries are `timed`, filtered out of top-up before scoring. UX only. |

`DEFAULT_CORE_POOL` = catalog entries with `primaryMuscles.includes('core') && type !== 'timed'`.
`DEFAULT_CARDIO_POOL` = catalog entries with `type === 'timed' && associatedLift === null && !primaryMuscles.includes('core')` — currently `Row Machine`, `Ski Erg`, `Run - Treadmill`, `Run - Outside`, `Assault Bike`.

**Source:** `packages/training-engine/src/auxiliary/exercise-catalog.ts`, `apps/parakeet/src/modules/program/lib/auxiliary-config.ts`

---

## Weight Scaling

> **GH#221 — History anchor takes precedence.** When the lifter has prior completed sessions of an aux exercise, the engine derives the working weight from a rolling average of their actual top sets (`anchor` source), not from the formulas below. The catalog `weightPct` becomes a cold-start bootstrap and a blend partner for sessions 1–2; from session 3 onward, history is the source of truth. See [features/auxiliary-exercises/spec-history-anchored-weight.md](../features/auxiliary-exercises/spec-history-anchored-weight.md) for the full anchor logic. The formulas below describe the fallback path used when no history is available.

### Linear (barbell, machine) — fallback / cold-start

```
weight = roundToNearest(oneRmKg x weightPct, 2.5)
```

Default `weightPct`: 0.675

### Sqrt (dumbbell, kettlebell) — fallback / cold-start

Applied to exercises starting with "Dumbbell" or "Kettlebell":

```
weight = weightPct x sqrt(referenceRm x oneRmKg)
```

At the reference 1RM, output equals the linear formula. Above it, weight grows slower (stability penalty for unstable implements).

| Lift     | Reference 1RM (Male) | Reference 1RM (Female) |
|----------|----------------------|------------------------|
| Squat    | 120 kg               | 70 kg                  |
| Bench    | 80 kg                | 50 kg                  |
| Deadlift | 140 kg               | 80 kg                  |

**Source:** `packages/training-engine/src/auxiliary/exercise-catalog.ts`

---

## Weight Percentages (Key Exercises)

| Exercise               | Associated Lift | weightPct | Type     |
|------------------------|-----------------|-----------|----------|
| Pause Squat            | squat           | 0.85      | weighted |
| Barbell Box Squat      | squat           | 0.80      | weighted |
| Bulgarian Split Squat  | squat           | 0.45      | weighted |
| Leg Press              | squat           | 0.50      | weighted |
| Hack Squat             | squat           | 0.40      | weighted |
| Close-Grip Bench       | bench           | 0.80      | weighted |
| Dumbbell Incline Bench | bench           | 0.28      | weighted |
| Barbell Overhead Press | bench           | 0.58      | weighted |
| Dumbbell Overhead Press| bench           | 0.25      | weighted |
| JM Press               | bench           | 0.50      | weighted |
| Romanian Deadlift      | deadlift        | 0.70      | weighted |
| Rack Pull              | deadlift        | 1.05      | weighted | subtitle: Above the knee |
| Rack Pull Below Knee   | deadlift        | 0.95      | weighted | subtitle: Below the knee |
| Block Pulls            | deadlift        | 0.95      | weighted |
| Good Mornings          | deadlift        | 0.40      | weighted |
| Lat Pulldown           | deadlift        | 0.28      | weighted |
| Seated Machine Row     | deadlift        | 0.28      | weighted |
| Power Clean            | deadlift        | 0.55      | weighted |
| Barbell Hang Clean     | deadlift        | 0.50      | weighted |
| Clean and Jerk         | deadlift        | 0.45      | weighted |

Default fallback: 0.675

**Source:** `packages/training-engine/src/auxiliary/exercise-catalog.ts`

---

## Post-Main Fatigue Factor

Applied when an auxiliary exercise shares muscles (contribution >= 0.5) with the session's primary lift. Tapers by main-lift intensity type — heavy main work generates more pre-fatigue than speed work, so the discount shrinks toward 1.0 on lighter days. Stacks multiplicatively with soreness modifiers.

| Intensity type | Factor | Rationale |
|----------------|--------|-----------|
| `heavy`        | 0.85   | Main lift at ~80% / RPE 8.5; CGBP after bench reads RPE 9.5-10 without the discount (prod data). |
| `rep`          | 0.90   | Moderate fatigue from rep-range main work. |
| `explosive`    | 0.95   | Speed work at ~65% / RPE 7 generates minimal pre-fatigue. |
| `deload`       | 1.00   | No additional discount — deload already light by design. |

Example: Close-Grip Bench after **heavy** bench day → triceps overlap ≥ 0.5, aux weight × 0.85. Same exercise on **explosive** bench day → aux weight × 0.95 (almost no discount).

> **GH#221 — Discount is skipped once history anchor is established.** When the aux anchor source is `history` or `snap` (3+ completed sessions or two consecutive overrides), the historical sets were themselves logged after main work, so the fatigue context is already baked into the rolling average. Applying the discount again would double-count. The discount continues to apply during cold-start (`formula` source) and the 1–2 session blend window (`blend` source) because the formula component is still load-bearing.

**Source:** `packages/training-engine/src/generator/steps/processAuxExercise.ts` (`getPostMainFatigueFactor`, conditional on `useHistoryAnchor`)

---

## Rep Targets

| Context              | Male | Female |
|----------------------|------|--------|
| Default auxiliary    | 10   | 12     |
| Strength variations  | 3-6  | 3-6    |
| Hypertrophy         | 8-12 | 8-12   |
| Volume top-up       | 10   | 12     |

Per-exercise overrides in the catalog take precedence (e.g., Barbell Box Squat = 4 reps regardless of sex).

**Source:** `packages/training-engine/src/auxiliary/exercise-catalog.ts`, `generator/steps/processAuxExercise.ts`

---

## Auxiliary Processing

### Base Prescription

| Parameter      | Value |
|----------------|-------|
| Sets           | 3     |
| RPE target     | 7.5   |

### Soreness Adjustments

| Soreness | Effect                     |
|----------|----------------------------|
| 3        | -1 set (min 1)             |
| 4        | -1 set (min 1), x0.95 intensity |
| 5        | Skip exercise entirely     |

### Other Modifiers

| Condition               | Effect        |
|-------------------------|---------------|
| No-equipment disruption | +1 set        |
| Timed exercise          | Single set, weight=0, reps=0, RPE 7.0 |
| MRV reached for primary muscle | Skip exercise with warning |

**Source:** `packages/training-engine/src/generator/steps/processAuxExercise.ts`

---

## Pool Rotation

- Default pool sizes vary by lift (deadlift has 9 after adding Rack Pull Below Knee)
- Rotation: advance 2 positions per block, wrap around
- User can reorder, lock positions, add/remove exercises in Settings
- Ad-hoc exercises added mid-session are not part of the pool rotation

**Source:** `packages/training-engine/src/auxiliary/auxiliary-rotator.ts`

---

## Exercise Metadata

Each catalog entry carries optional metadata used by the exercise scorer for context-aware selection. Resolver functions auto-derive sensible defaults when fields are omitted — only override when the derivation would be wrong.

### Fields

| Field             | Type                                                         | Auto-derivation rule                                                                                     |
|-------------------|--------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `movementPattern` | `squat` · `hinge` · `push` · `pull` · `carry` · `core`     | `associatedLift`: squat→squat, bench→push, deadlift→hinge. Null: infer from primaryMuscles (quads→squat, hams/glutes/lower_back→hinge, upper_back/biceps→pull, chest/triceps/shoulders→push, core→core). |
| `equipment`       | `barbell` · `dumbbell` · `kettlebell` · `machine` · `cable` · `bodyweight` · `none` | Name prefix (Dumbbell, Kettlebell, Cable), type (bodyweight, timed→none), default barbell.               |
| `isCompound`      | `boolean`                                                    | `muscleContributions` with ≥2 entries at contribution ≥0.5, or `primaryMuscles.length ≥ 2`.             |
| `complexityTier`  | `simple` · `moderate` · `complex`                            | Default `moderate`. Olympic lifts annotated `complex`. Machines/isolation annotated `simple`.             |

### Exercises with explicit overrides

Curls (`movementPattern: 'pull'`), rows/pulldowns (`movementPattern: 'pull'`), machines (`equipment: 'machine'`, `complexityTier: 'simple'`), olympic lifts (`complexityTier: 'complex'`).

**Source:** `packages/training-engine/src/auxiliary/exercise-catalog.ts` — types, resolvers, and per-entry annotations

---

## Exercise Scoring (Volume Top-Up Selection)

When volume top-up needs to select an exercise from the qualifying pool, a multi-signal scorer ranks candidates instead of picking the first match. The scorer produces a weighted sum of 7 factors, each in [0, 1].

### Scoring Factors

| Factor                        | Weight | What it measures                                                                  |
|-------------------------------|--------|-----------------------------------------------------------------------------------|
| Muscle deficit coverage       | 0.30   | Bonus for secondary muscles that also have volume deficits.                      |
| Soreness avoidance            | 0.25   | Penalty for touching sore muscles, scaled by contribution × soreness level.      |
| Movement pattern diversity    | 0.15   | 1.0 for novel patterns, 0.3 for patterns already selected this session.         |
| Fatigue appropriateness       | 0.10   | Matches exercise complexity tier to readiness (sleep + energy).                  |
| Upcoming lift protection      | 0.10   | Penalizes exercises that fatigue muscles needed for lifts later this week.       |
| Main lift specificity         | 0.05   | Prefers exercises associated with today's primary lift.                          |
| Compound/isolation balance    | 0.05   | If mostly compound already selected, prefer isolation, and vice versa.           |

### Design rationale

Deficit coverage and soreness avoidance dominate because the primary purpose of top-up is filling volume gaps safely. Movement diversity prevents redundant programming. The remaining factors are tiebreakers.

### Context signals used

`sorenessRatings`, `sleepQuality`, `energyLevel` (threaded from `JITInput`), `muscleDeficits`, `upcomingLifts`, `primaryLift`, `alreadySelectedPatterns`, `alreadySelectedExercises`, `biologicalSex`.

**Source:** `packages/training-engine/src/auxiliary/exercise-scorer.ts`
