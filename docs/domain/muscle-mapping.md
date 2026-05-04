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
| glutes     | 0.55       | 28-60% (depth-dependent) | Mid-range. Back squat glute EMG 28-60% MVIC vs quads 21-68%. |
| hamstrings | 0.5        | 4-12% (minimal) | Consistent with "twofold lower" than quads finding. |
| lower_back | 0.5        | Moderate-high (isometric) | Erectors stabilize; isometric not well captured by EMG. |

EMG sources: Kompf & Arandjelovic 2024 (biomechanical review); Neto et al. 2020 (glute systematic review, 23 studies). See [references.md](references.md).

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
| upper_back | 0.7        | Significant isometric demand | Traps, rhomboids, lats work hard isometrically during heavy pulls. |

EMG source: Martins-Costa et al. 2020 (deadlift systematic review, 20 studies). See [references.md](references.md).

**Source:** `packages/training-engine/src/volume/muscle-mapper.ts`

---

## RPE-to-Effective-Sets Curve

Only sets with sufficient proximity to failure count toward weekly volume. The curve uses piecewise linear interpolation between anchor points — half-point RPEs are valued proportionally, not floored to the bracket below.

### Anchor Points

| RPE       | RIR | Multiplier | Research basis |
|-----------|-----|------------|----------------|
| < 6       | 5+  | 0.0        | Sub-threshold for meaningful stimulus. Refalo 2023: sets far from failure produce minimal effect. |
| 6         | 4   | 0.15       | Boundary of effective range. Minimal contribution — mainly technical practice. |
| 6.5       | 3.5 | 0.30       | Conservative — still far from failure but beginning to accumulate meaningful stimulus. |
| 7         | 3   | 0.65       | Within effective zone. Research: ~80-90% of failure-level stimulus at 3 RIR. |
| 8         | 2   | 0.85       | High-stimulus zone. Very close to a full set per Refalo 2024 meta-regression. |
| 9-10      | 0-1 | 1.0        | Full hard set. Consensus. |
| undefined | --  | 1.0        | Conservative default — assume hard. |

### Interpolated Examples

| RPE  | Multiplier |
|------|------------|
| 6.25 | 0.225      |
| 6.75 | 0.475      |
| 7.5  | 0.75       |
| 8.5  | 0.925      |

Values between anchor points are linearly interpolated. This eliminates the step-function cliff that previously existed (e.g., RPE 6.9 → 0.15, RPE 7.0 → 0.65 was a 4.3x jump).

Research basis: Refalo et al. 2023 meta-analysis (15 studies): training to failure vs near-failure showed trivial ES = 0.12 (not significant). Robinson/Refalo 2024 meta-regression: hypertrophy increases closer to failure but relationship is nonlinear with diminishing returns. For strength specifically, confidence intervals for RIR slopes contained zero — negligible relationship between proximity to failure and strength gains.

**Strength implication:** For powerlifting, RPE 7-8 work is more valuable than a steep cliff at RPE 7.0 suggests, since strength gains are relatively insensitive to proximity to failure. The interpolated curve better reflects the continuous nature of RPE and the nonlinear stimulus relationship.

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

Volume attribution uses a `MuscleMapper` — a function `(lift, exercise?) → MuscleContribution[]` built per-user via `createMuscleMapper(customMuscleMap)`. The custom map carries the muscles the lifter selected when registering exercises that don't appear in the catalog (e.g. "Pec Deck", "Cable Fly").

When resolving an exercise, sources are consulted in priority order:

| Priority | Source                              | Contribution value       |
|----------|-------------------------------------|--------------------------|
| 1        | Catalog `muscleContributions` field | As specified             |
| 2        | Catalog `primaryMuscles` list       | 1.0 per listed muscle    |
| 3        | User custom muscle map              | 1.0 per listed muscle    |
| 4        | `LIFT_MUSCLES` map for primary lift | As per primary lift table|
| 5        | (none found)                        | Empty — no volume counted|

The catalog-only standalone exports `getMusclesForLift` and `getMusclesForExercise` are equivalent to a mapper with no custom map. Use them only when no user context is available (e.g. simulator, generic lookup helpers). Production attribution paths — JIT pipeline, weekly home-page volume, body review — all build a per-user mapper from the lifter's stored aux muscle map so user-defined exercises credit the muscles the lifter selected, regardless of the day's primary lift.

**Source:** `packages/training-engine/src/volume/muscle-mapper.ts`
