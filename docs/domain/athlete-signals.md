# Athlete Signals

All inputs the system collects from the lifter. Each signal feeds into a specific JIT pipeline step (see [session-prescription.md](session-prescription.md)) or is stored for trend analysis.

---

## Pre-Session

Collected on the soreness check-in screen before each workout.

| Signal        | Scale | Values                           | Used In         |
|---------------|-------|----------------------------------|-----------------|
| Soreness      | 1-5   | Per muscle group (9 muscles)     | JIT Step 5      |
| Sleep quality | 1-3   | 1=poor, 2=normal, 3=great       | JIT Step 3      |
| Energy level  | 1-3   | 1=low, 2=normal, 3=great        | JIT Step 3      |
| Cycle phase   | auto  | Calculated from last period start | JIT Step 4     |

Soreness is checked for the session's primary lift muscles only. Sleep and energy are optional -- `undefined` = normal.

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

| Signal              | Type     | Purpose                           |
|---------------------|----------|-----------------------------------|
| Session RPE         | 1-10     | Overall difficulty (optional)     |
| Completion %        | derived  | Completed sets / planned sets     |
| Performance vs plan | enum     | over / at / under / incomplete    |
| Session notes       | text     | Free-form (optional)              |

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

## Weekly Signals

| Signal        | Frequency    | Content                                   |
|---------------|--------------|-------------------------------------------|
| Body review   | End of week  | Felt fatigue per muscle (1-5) vs predicted |
| Bodyweight    | Periodic     | Used for Wilks score                       |

Body review mismatch threshold: |felt - predicted| >= 2 fatigue levels.

**Source:** `apps/parakeet/src/app/(tabs)/session/weekly-review.tsx`

---

## Signal Flow

```
Pre-session: soreness, sleep, energy, cycle phase
  |
  v
JIT Pipeline (Steps 2-7)
  - Step 2: RPE history (from prior sessions)
  - Step 3: Readiness (sleep + energy)
  - Step 4: Cycle phase
  - Step 5: Soreness
  - Step 6: MRV cap (from weekly volume)
  - Step 7: Disruptions
  |
  v
In-session: RPE, failed, weight, reps, rest time (per set)
  |
  v
Post-session: session RPE, completion %, performance
  |
  v
Stored -> feeds next session's Step 2 (RPE history) and Step 5 (volume-to-date)
```

**Source:** `packages/training-engine/src/generator/jit-session-generator.ts`
