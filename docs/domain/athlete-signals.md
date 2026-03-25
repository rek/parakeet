# Athlete Signals

All inputs the system collects from the lifter. Each signal feeds into the JIT pipeline (see [session-prescription.md](session-prescription.md)) or into cross-session learning for adaptive volume calibration (see [adaptive-volume design](../design/adaptive-volume.md)).

The system uses signals at four time scales: pre-session, in-session, post-session, and cross-session. Finer granularity enables finer adaptation.

---

## Pre-Session

Collected on the check-in screen before each workout.

| Signal        | Current Scale | Target Scale | Values                           | Used In         |
|---------------|---------------|--------------|----------------------------------|-----------------|
| Soreness      | 1-5           | 1-10         | Per muscle group (9 muscles)     | JIT Steps 0, 5  |
| Sleep quality | 1-3           | 1-5          | terrible → great                 | JIT Steps 0, 3  |
| Energy level  | 1-3           | 1-5          | terrible → great                 | JIT Steps 0, 3  |
| Cycle phase   | auto          | auto         | Calculated from last period start | JIT Step 4     |

Soreness is checked for the session's primary lift muscles only. Sleep and energy are optional — `undefined` = normal.

Expanded scales (planned) enable asymmetric responses: high readiness can trigger volume boost in Step 0 (volume calibration), not just neutral. Current scales only distinguish "bad" from "normal" — expanded scales also distinguish "good" from "great."

**Source:** `apps/parakeet/src/app/(tabs)/session/soreness.tsx`

---

## In-Session

Captured per set during the workout.

| Signal         | Scale  | Capture Point                    | Purpose                    |
|----------------|--------|----------------------------------|----------------------------|
| RPE            | 6-10   | After each set via quick picker  | Volume attribution, trend  |
| Failed set     | bool   | "Failed" button on overlay       | Sets `failed: true`, RPE=10 |
| Rest time      | seconds| Automatic from rest timer        | Badge detection, analysis  |
| Actual weight  | grams  | Pre-filled, user adjustable      | Weight deviation tracking  |
| Actual reps    | count  | Pre-filled, user adjustable      | Rep PR detection           |

RPE interpretation: 6 = 4 RIR, 7 = 3 RIR, 8 = 2 RIR, 9 = 1 RIR, 10 = failure.

**Source:** `apps/parakeet/src/modules/session/hooks/useSetCompletionFlow.ts`

---

## Post-Session

Captured on the completion screen.

| Signal              | Type     | Purpose                           | Used In |
|---------------------|----------|-----------------------------------|---------|
| Capacity assessment | 1-4      | "Could you have done more?" (planned) | Volume calibration (Step 0) |
| Session RPE         | 1-10     | Overall difficulty (optional)     | Cross-session trend |
| Completion %        | derived  | Completed sets / planned sets     | Performance adjuster |
| Performance vs plan | enum     | over / at / under / incomplete    | Performance adjuster |
| Session notes       | text     | Free-form (optional)              | — |

**Capacity assessment** (planned): the most direct signal for volume calibration. Scale: 1 = barely survived, 2 = about right, 3 = had more in me, 4 = way too easy. Feeds directly into next-session volume calibration.

Completion below 80% is flagged for the performance adjuster.

**Source:** `apps/parakeet/src/app/(tabs)/session/complete.tsx`

---

## Disruptions

Reported via multi-step disruption form. Active disruptions feed into JIT Step 7.

| Field    | Values                                                         |
|----------|----------------------------------------------------------------|
| Type     | injury, illness, travel, fatigue, equipment\_unavailable, unprogrammed\_event |
| Severity | minor, moderate, major                                         |
| Duration | Start date, optional end date                                  |
| Notes    | Free-form description                                          |

Full modifier table: [adjustments.md](adjustments.md)

**Source:** `apps/parakeet/src/modules/disruptions/`

---

## Weekly / Cross-Session

| Signal                 | Frequency      | Content                                   | Used In |
|------------------------|----------------|-------------------------------------------|---------|
| Body review            | End of week    | Felt fatigue per muscle (1-5) vs predicted | Volume calibration, MRV adjustment |
| Bodyweight             | Periodic       | Used for Wilks score                       | — |
| RPE trend              | Cross-session  | Avg RPE deviation over last 3-5 sessions per lift | Volume calibration (Step 0) |
| Modifier calibration   | Cross-session  | Per-athlete learned corrections to default modifiers | Volume calibration (Step 0, planned) |

Body review mismatch threshold: |felt - predicted| >= 2 fatigue levels. "Recovering well" mismatches feed into next-week volume calibration increase. "Accumulating fatigue" mismatches feed into decrease.

**Source:** `apps/parakeet/src/app/(tabs)/session/weekly-review.tsx`, `packages/training-engine/src/analysis/modifier-effectiveness.ts`

---

## Signal Flow

```
Pre-session: soreness, sleep, energy, cycle phase
  |
  v
JIT Pipeline
  - Step 0: Volume calibration (RPE trends, capacity, readiness → set count +/-)
  - Step 1: Init base prescription
  - Step 4: Cycle phase
  - Step 5: Soreness
  - Step 6: MRV cap (from weekly volume)
  - Step 7: Disruptions
  |
  v
In-session: RPE, failed, weight, reps, rest time (per set)
  |
  v
Post-session: capacity assessment, session RPE, completion %, performance
  |
  v
Stored → feeds next session's Step 0 (volume calibration),
         Step 2 (RPE history), and Step 6 (volume-to-date)
```

**Source:** `packages/training-engine/src/generator/jit-session-generator.ts`
