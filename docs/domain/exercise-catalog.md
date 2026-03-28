# Exercise Catalog

Exercise types, weight scaling, rep targets, and auxiliary processing rules.

---

## Exercise Types

| Type       | Weight        | Reps            | RPE/Rest          |
|------------|---------------|-----------------|-------------------|
| weighted   | Calculated    | From config     | Normal            |
| bodyweight | 0 (omitted)   | From config     | RPE/rest suppressed |
| timed      | 0             | 0 (duration)    | RPE/rest suppressed |

Type resolution: catalog lookup first, then fallback map (Pull-ups, Chin-ups, Push-ups, Step-ups = bodyweight), then default = weighted.

**Source:** `packages/training-engine/src/auxiliary/exercise-types.ts`

---

## Weight Scaling

### Linear (barbell, machine)

```
weight = roundToNearest(oneRmKg x weightPct, 2.5)
```

Default `weightPct`: 0.675

### Sqrt (dumbbell, kettlebell)

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
| Overhead Press         | bench           | 0.58      | weighted |
| JM Press               | bench           | 0.50      | weighted |
| Romanian Deadlift      | deadlift        | 0.70      | weighted |
| Block Pulls            | deadlift        | 0.90      | weighted |
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

```
POST_MAIN_FATIGUE_FACTOR = 0.85
```

Applied when an auxiliary exercise shares muscles (contribution >= 0.5) with the session's primary lift. Stacks multiplicatively with soreness modifiers.

Example: Close-Grip Bench after Bench day -- triceps overlap >= 0.5, so aux weight is reduced to 85% of standard.

**Source:** `packages/training-engine/src/generator/steps/processAuxExercise.ts`

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

- Default: 8 exercises per lift pool
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
