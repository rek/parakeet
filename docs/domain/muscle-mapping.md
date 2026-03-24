# Muscle Mapping

How primary lift sets are attributed to muscles and how RPE scales effective set counts.

See [volume-landmarks.md](volume-landmarks.md) for MEV/MRV values and [session-prescription.md](session-prescription.md) for how volume attribution feeds into the JIT pipeline.

---

## Primary Lift Muscle Contributions

Contribution factors represent the fractional set weight applied per completed set of each lift.

### Squat

| Muscle     | Contribution |
|------------|--------------|
| quads      | 1.0          |
| glutes     | 0.75         |
| hamstrings | 0.5          |
| lower_back | 0.5          |

> **Known issue:** Glute contribution of 0.75 is higher than EMG data for conventional squat mechanics suggests. See [#124](https://github.com/rek/parakeet/issues/124).

### Bench

| Muscle    | Contribution |
|-----------|--------------|
| chest     | 1.0          |
| triceps   | 0.4          |
| shoulders | 0.4          |

### Deadlift

| Muscle     | Contribution |
|------------|--------------|
| hamstrings | 1.0          |
| glutes     | 0.75         |
| lower_back | 1.0          |
| upper_back | 0.5          |

> **Known issue:** Upper back contribution of 0.5 likely underestimates the isometric demand on upper back musculature during a maximal deadlift. See [#125](https://github.com/rek/parakeet/issues/125).

**Source:** `packages/training-engine/src/volume/muscle-mapper.ts`

---

## RPE-to-Effective-Sets Curve

Only sets with sufficient proximity to failure count toward weekly volume, per the RP framework (0–3 RIR threshold).

| RPE         | Set Multiplier |
|-------------|----------------|
| < 6         | 0.0            |
| 6           | 0.25           |
| 7           | 0.5            |
| 8           | 0.75           |
| 9–10        | 1.0            |
| undefined   | 1.0            |

Rationale: Sets well below failure (high RIR) produce minimal hypertrophic or strength stimulus and are excluded from volume accounting.

> **Known issue:** The curve is conservative at RPE 7–8. RPE 8 (2 RIR) is commonly considered a hard working set in strength training; 0.75 multiplier may undercount accumulated fatigue. See [#123](https://github.com/rek/parakeet/issues/123).

**Source:** `packages/training-engine/src/volume/rpe-scaler.ts`

---

## Volume Attribution Method

```
volume[muscle] += effectiveSets × contribution
```

- Method: Fractional set counting per Pelland et al. 2024/2025.
- `effectiveSets` = sum of `rpeSetMultiplier(rpe)` across all sets for the exercise. If no RPE data is present, `completedSets` is used directly (treated as fully effective).

**Source:** `packages/training-engine/src/volume/muscle-mapper.ts`

---

## Exercise-to-Muscle Resolution

When attributing volume for an arbitrary catalog exercise (not a primary lift), muscle contributions are resolved in priority order:

| Priority | Source                              | Contribution value       |
|----------|-------------------------------------|--------------------------|
| 1        | Catalog `muscleContributions` field | As specified             |
| 2        | Catalog `primaryMuscles` list       | 1.0 per listed muscle    |
| 3        | `LIFT_MUSCLES` map for primary lift | As per primary lift table|
| 4        | (none found)                        | Empty — no volume counted|

**Source:** `packages/training-engine/src/volume/muscle-mapper.ts`
