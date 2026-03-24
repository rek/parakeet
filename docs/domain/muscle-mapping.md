# Muscle Mapping

How primary lift sets are attributed to muscles and how RPE scales effective set counts.

See [volume-landmarks.md](volume-landmarks.md) for MEV/MRV values and [session-prescription.md](session-prescription.md) for how volume attribution feeds into the JIT pipeline.

---

## Primary Lift Muscle Contributions

Contribution factors represent the fractional set weight applied per completed set of each lift. EMG research provides activation ranges; our factors are a simplified model within those ranges.

### Squat

| Muscle     | Our Factor | EMG research range (%MVIC) | Design choice |
|------------|------------|---------------------------|---------------|
| quads      | 1.0        | 21-68% (highest of all muscles) | Primary mover — uncontested. |
| glutes     | 0.75       | 28-60% (depth-dependent) | High end of defensible range. See known issue. |
| hamstrings | 0.5        | 4-12% (minimal) | Consistent with "twofold lower" than quads finding. |
| lower_back | 0.5        | Moderate-high (isometric) | Erectors stabilize; isometric not well captured by EMG. |

EMG sources: Kompf & Arandjelovic 2024 (biomechanical review); Neto et al. 2020 (glute systematic review, 23 studies). See [references.md](references.md).

> **Known issue:** Glute factor 0.75 is at the high end. EMG studies show back squat glute activation at 28-60% MVIC vs quads at 21-68%. A factor of 0.5-0.6 better matches the data, especially for parallel-depth squats. See [#124](https://github.com/rek/parakeet/issues/124).

### Bench

| Muscle    | Our Factor | EMG research range (%MVIC) | Design choice |
|-----------|------------|---------------------------|---------------|
| chest     | 1.0        | ~53-100+% (load-dependent) | Primary mover — uncontested. |
| triceps   | 0.4        | Similar to pec at high loads | Defensible for powerlifting context — bench ROM limits triceps stimulus. |
| shoulders | 0.4        | ~60% (anterior delt) | Anterior delt only; full shoulder group lower. |

EMG sources: Lauver et al. 2020 (5 inclinations); Stastny et al. 2017 (bench systematic review); Coratella et al. 2023 (bench meta-analysis). See [references.md](references.md).

### Deadlift

| Muscle     | Our Factor | EMG research range | Design choice |
|------------|------------|-------------------|---------------|
| hamstrings | 1.0        | High (semitendinosus > biceps femoris) | Primary hip extensor. |
| glutes     | 0.75       | ~65% MVIC conventional | Significant hip extension role, especially lockout. |
| lower_back | 1.0        | Highest overall activation | Erectors are the most activated muscle in conventional DL. |
| upper_back | 0.5        | Significant isometric demand | See known issue. |

EMG source: Martins-Costa et al. 2020 (deadlift systematic review, 20 studies). See [references.md](references.md).

> **Known issue:** Upper back factor 0.5 likely underestimates isometric demand on traps, rhomboids, and lats during heavy deadlifts. A factor of 0.65-0.75 would better reflect the load, especially for competitive powerlifters. See [#125](https://github.com/rek/parakeet/issues/125).

**Source:** `packages/training-engine/src/volume/muscle-mapper.ts`

---

## RPE-to-Effective-Sets Curve

Only sets with sufficient proximity to failure count toward weekly volume.

| RPE       | RIR | Our Multiplier | Research basis |
|-----------|-----|----------------|----------------|
| < 6       | 5+  | 0.0            | Sub-threshold for meaningful stimulus. Refalo 2023: sets far from failure produce minimal effect. |
| 6         | 4   | 0.25           | Boundary of effective range. Generous for strength — serves technical practice role. |
| 7         | 3   | 0.5            | Within effective zone per Refalo. See known issue. |
| 8         | 2   | 0.75           | Squarely in high-stimulus zone. See known issue. |
| 9-10      | 0-1 | 1.0            | Full hard set. Consensus. |
| undefined | --  | 1.0            | Conservative default — assume hard. |

Research basis: Refalo et al. 2023 meta-analysis (15 studies): training to failure vs near-failure showed trivial ES = 0.12 (not significant). Robinson/Refalo 2024 meta-regression: hypertrophy increases closer to failure but relationship is nonlinear with diminishing returns. For strength specifically, confidence intervals for RIR slopes contained zero — negligible relationship between proximity to failure and strength gains.

**Strength implication:** For powerlifting, RPE 7-8 work is likely more valuable than the 0.5/0.75 multipliers suggest, since strength gains are relatively insensitive to proximity to failure. The conservative curve undervalues moderate-effort sets that are common in periodized powerlifting programs.

> **Known issue:** The curve is linear (0.25 increments). Research suggests a concave curve where RPE 8→10 difference is small but RPE 6→8 difference is large. A curve like {6: 0.15, 7: 0.65, 8: 0.85, 9: 1.0, 10: 1.0} would better match. See [#123](https://github.com/rek/parakeet/issues/123).

**Source:** `packages/training-engine/src/volume/rpe-scaler.ts`

---

## Volume Attribution Method

```
volume[muscle] += effectiveSets x contribution
```

- Method: Fractional set counting, validated by Pelland et al. 2025 meta-regression (67 studies, 2,058 subjects). Their "fractional" method (direct=1.0, indirect=0.5) had the strongest evidence for predicting both hypertrophy and strength outcomes.
- Our system is more granular: muscle-specific contribution factors (0.4-1.0) instead of a flat 0.5 for all indirect work.
- `effectiveSets` = sum of `rpeSetMultiplier(rpe)` across all sets. If no RPE data, `completedSets` is used directly.

**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`

---

## Exercise-to-Muscle Resolution

When attributing volume for an arbitrary catalog exercise, muscle contributions are resolved in priority order:

| Priority | Source                              | Contribution value       |
|----------|-------------------------------------|--------------------------|
| 1        | Catalog `muscleContributions` field | As specified             |
| 2        | Catalog `primaryMuscles` list       | 1.0 per listed muscle    |
| 3        | `LIFT_MUSCLES` map for primary lift | As per primary lift table|
| 4        | (none found)                        | Empty — no volume counted|

**Source:** `packages/training-engine/src/volume/muscle-mapper.ts`
