# Volume Landmarks

MEV (Minimum Effective Volume) and MRV (Maximum Recoverable Volume) defaults used for auxiliary selection and MRV capping.

See [muscle-mapping.md](muscle-mapping.md) for how sets are attributed to muscles, and [session-prescription.md](session-prescription.md) for how these values gate the JIT pipeline.

---

## MRV/MEV Defaults (Male)

Units: sets per week.

| Muscle      | MEV | MRV |
|-------------|-----|-----|
| quads       | 8   | 20  |
| hamstrings  | 6   | 20  |
| glutes      | 0   | 22  |
| lower_back  | 6   | 18  |
| upper_back  | 10  | 22  |
| chest       | 8   | 22  |
| triceps     | 6   | 20  |
| shoulders   | 8   | 20  |
| biceps      | 8   | 20  |
| core        | 8   | 20  |

Rationale: RP Strength volume landmarks research.

**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`

---

## MRV/MEV Defaults (Female)

Female values are approximately 20–30% higher, per Judge & Burke (2010).

| Muscle      | MEV | MRV |
|-------------|-----|-----|
| quads       | 10  | 26  |
| hamstrings  | 8   | 25  |
| glutes      | 0   | 20  |
| lower_back  | 7   | 20  |
| upper_back  | 12  | 28  |
| chest       | 10  | 26  |
| triceps     | 8   | 24  |
| shoulders   | 10  | 24  |
| biceps      | 10  | 24  |
| core        | 10  | 24  |

> **Known issue:** Female glute MRV (20) is lower than male glute MRV (22) — this is inverted relative to the general female-higher pattern. See [#122](https://github.com/rek/parakeet/issues/122).

> **Known issue:** Core MEV of 8 (male) is high for powerlifters whose core is already trained indirectly through the primary lifts. See [#126](https://github.com/rek/parakeet/issues/126).

**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`

---

## Training Age Multipliers

Applied to MEV and MRV before use.

| Training Age  | MEV Multiplier | MRV Multiplier |
|---------------|----------------|----------------|
| Beginner      | 1.0            | 0.8            |
| Intermediate  | 1.0            | 1.0            |
| Advanced      | 1.1            | 1.2            |

> **Known issue:** Beginner MEV multiplier is 1.0 (unchanged), but beginners require less volume to achieve an effective stimulus. This should likely be < 1.0. See [#127](https://github.com/rek/parakeet/issues/127).

**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`

---

## Volume Status Classification

Used in the JIT pipeline MRV cap step and for UI feedback.

| Status          | Condition              |
|-----------------|------------------------|
| `exceeded_mrv`  | sets > MRV             |
| `at_mrv`        | sets = MRV             |
| `approaching_mrv` | MRV − sets ≤ 2       |
| `in_range`      | sets ≥ MEV             |
| `below_mev`     | sets < MEV             |

**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`

---

## Remaining Capacity

Used by the MRV cap step in the JIT pipeline (step 6 in [session-prescription.md](session-prescription.md)).

```
remaining[muscle] = config[muscle].mrv - weeklyVolume[muscle]
```

**Source:** `packages/training-engine/src/volume/mrv-mev-calculator.ts`
