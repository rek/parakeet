# Volume Landmarks

MEV (Minimum Effective Volume) and MRV (Maximum Recoverable Volume) defaults used for auxiliary selection and MRV capping.

See [muscle-mapping.md](muscle-mapping.md) for how sets are attributed to muscles, and [session-prescription.md](session-prescription.md) for how these values gate the JIT pipeline.

**Caveat:** Most volume-dose research targets hypertrophy, not maximal strength. For strength, the dose-response with volume is flatter — fewer sets at higher intensity can produce comparable strength gains (Pelland et al. 2025). Our MRV values primarily cap fatigue accumulation rather than target optimal hypertrophy. See [references.md](references.md).

---

## MRV/MEV Defaults (Male)

Units: sets per week.

| Muscle      | MEV | MRV | Research range (MEV) | Research range (MRV) | Design choice |
|-------------|-----|-----|----------------------|----------------------|---------------|
| quads       | 8   | 20  | 6-12                 | 18-22                | Mid MEV, mid MRV. Squat frequency already high in cube rotation. |
| hamstrings  | 6   | 20  | 6-8                  | 16-20                | Low MEV, top of MRV range. Deadlift provides substantial volume. |
| glutes      | 0   | 22  | 0                    | 16-22                | MEV=0 correct per RP — compound squat/deadlift covers maintenance. MRV at top of range. |
| lower_back  | 6   | 18  | ~6                   | 12-18                | Top of MRV range. Erectors heavily loaded by squat + deadlift. |
| upper_back  | 10  | 22  | 10-14                | 20-25                | Low end of range. Upper back tolerates high volume. |
| chest       | 8   | 22  | 8-12                 | 20-22                | Low MEV, top MRV. Bench is primary driver. |
| triceps     | 6   | 20  | 6-8                  | 18-20                | Mid range. Gets indirect work from bench. |
| shoulders   | 8   | 20  | 8-12                 | 18-22                | Mid range. Gets indirect work from bench + overhead movements. |
| biceps      | 8   | 20  | 6-10                 | 18-22                | Mid range. Gets indirect work from rows/pulling. |
| core        | 4   | 20  | 0-8                  | 15-20                | Low MEV — powerlifters get substantial indirect core work from squats/deadlifts. |

Research basis: RP Strength volume landmarks (practitioner framework, not a meta-analysis). Schoenfeld 2017 meta-analysis found optimal hypertrophy at 10+ sets/week; Baz-Valle 2022 recommends 12-20 for trained men. For strength specifically, Pelland 2025 found diminishing returns are steeper than for hypertrophy.



**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`

---

## MRV/MEV Defaults (Female)

Female values are approximately 20-30% higher across most muscle groups.

| Muscle      | MEV | MRV | % vs Male MRV | Notes |
|-------------|-----|-----|---------------|-------|
| quads       | 10  | 26  | +30%          | |
| hamstrings  | 8   | 25  | +25%          | |
| glutes      | 0   | 28  | +27%          | Corrected — was 20, inverted vs male. |
| lower_back  | 7   | 20  | +11%          | Lower uplift than other groups |
| upper_back  | 12  | 28  | +27%          | |
| chest       | 10  | 26  | +18%          | |
| triceps     | 8   | 24  | +20%          | |
| shoulders   | 10  | 24  | +20%          | |
| biceps      | 10  | 24  | +20%          | |
| core        | 6   | 24  | +20%          | Lowered MEV — indirect core work from compounds. |

Research basis: Women demonstrate faster inter-set recovery and higher relative fatigue resistance (Roberts et al. 2020 meta-analysis; Hicks et al. 2018). However, no large-scale meta-analysis directly quantifies the female volume tolerance multiplier. The 20-30% uplift is derived from RP coaching data and individual studies, not meta-analyzed.


**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`

---

## Training Age Multipliers

Applied to MEV and MRV before use.

| Training Age  | MEV Multiplier | MRV Multiplier | Research basis |
|---------------|----------------|----------------|----------------|
| Beginner      | 1.0            | 0.8            | Beginners: 4-10 sets optimal (ACSM/NSCA). MRV x0.8 aligns with ~16 vs 20. |
| Intermediate  | 1.0            | 1.0            | Baseline. 10-16 sets/muscle/week. |
| Advanced      | 1.1            | 1.2            | Advanced: 12-20+ sets needed (Baz-Valle 2022). MRV x1.2 = ~24. |

Pelland 2025 meta-regression: dose-response follows a square root model — beginners get more per-set return, supporting lower MRV ceiling.


**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`

---

## Volume Status Classification

Used in the JIT pipeline MRV cap step and for UI feedback.

| Status            | Condition        |
|-------------------|------------------|
| `exceeded_mrv`    | sets > MRV       |
| `at_mrv`          | sets = MRV       |
| `approaching_mrv` | MRV - sets <= 2  |
| `in_range`        | sets >= MEV      |
| `below_mev`       | sets < MEV       |

**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`

---

## Remaining Capacity

Used by the MRV cap step in the JIT pipeline (step 6 in [session-prescription.md](session-prescription.md)).

```
remaining[muscle] = config[muscle].mrv - weeklyVolume[muscle]
```

**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`
