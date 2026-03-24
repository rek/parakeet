# Performance Analysis

Formulas and algorithms for tracking, scoring, and calibrating athlete performance.

---

## 1RM Estimation

### Epley Formula (default)

```
1RM = weight x (1 + reps / 30)
```

If `reps === 1`, returns `weight` directly.

### Brzycki Formula (alternative)

```
1RM = weight / (1.0278 - 0.0278 x reps)
```

### Constraints

| Parameter | Range  |
|-----------|--------|
| Reps      | 1-20   |
| Weight    | > 0 kg |

**Source:** `packages/training-engine/src/formulas/one-rep-max.ts`

---

## Working 1RM

When the lifter's stored 1RM drifts from their actual performance, the system computes a "working 1RM" from recent sessions.

| Parameter                  | Value                              |
|----------------------------|------------------------------------|
| Qualifying sessions        | >= 3 with RPE data                 |
| Method                     | Median Epley e1RM from qualifying sets |
| Floor                      | 85% of stored 1RM                 |
| Ceiling                    | 110% of stored 1RM                |
| Rounding                   | Nearest 2.5 kg                    |

When working 1RM is used, both `storedOneRmKg` and `workingOneRmKg` are recorded in the prescription trace for observability.

**Source:** `packages/training-engine/src/analysis/weight-deviation.ts`

---

## Wilks 2020 Score

Normalizes total lifted weight for bodyweight and sex.

```
coefficient = 600 / (a + b*bw + c*bw^2 + d*bw^3 + e*bw^4 + f*bw^5)
score = totalKg x coefficient
```

### Coefficients

| Coefficient | Female               | Male                |
|-------------|----------------------|---------------------|
| a           | 594.31747775582      | -216.0475144        |
| b           | -27.23842536447      | 16.2606339          |
| c           | 0.82112226871        | -0.002388645        |
| d           | -0.00930733913       | -0.00113732         |
| e           | 0.00004731582        | 0.00000701863       |
| f           | -0.00000009054       | -0.00000001291      |

### Bodyweight Clamp

| Sex    | Min    | Max     |
|--------|--------|---------|
| Female | 40 kg  | 150 kg  |
| Male   | 40 kg  | 200 kg  |

Values outside range are clamped (not rejected).

**Source:** `packages/training-engine/src/formulas/wilks.ts`

---

## PR Detection

Three PR types, checked after each session:

| Type            | Condition                                           |
|-----------------|-----------------------------------------------------|
| Estimated 1RM   | Set RPE >= 8.5 with new personal-best Epley e1RM   |
| Volume          | Session total (sum weight x reps) exceeds history   |
| Rep at Weight   | More reps at a given weight (rounded 2.5 kg) than ever before |

### Gates

| Gate                    | Rule                                      |
|-------------------------|-------------------------------------------|
| Major disruption active | All PR detection blocked                  |
| Minor/moderate          | PR detection allowed                      |
| Rep PR cap              | Max 3 rep-at-weight PRs per session       |

**Source:** `packages/training-engine/src/badges/checkers/`, `engine-022`

---

## Modifier Calibration

Tracks whether modifiers (soreness, readiness, etc.) are producing accurate prescriptions by comparing predicted RPE to actual RPE over time.

| Parameter              | Value            |
|------------------------|------------------|
| Confidence: Exploring  | < 5 samples      |
| Confidence: Low        | 5-9 samples      |
| Confidence: Medium     | 10-19 samples    |
| Confidence: High       | >= 20 samples    |
| Auto-apply gate        | Medium+ confidence AND < 5% adjustment |
| Large adjustment gate  | Requires LLM review                    |
| Bias clamp             | +/- 0.15                               |

**Source:** `packages/training-engine/src/analysis/modifier-effectiveness.ts`

---

## Weight Rounding

All prescribed weights are rounded to the nearest increment:

```
roundToNearest(weightKg, increment = 2.5) = round(weightKg / increment) x increment
```

Unit conversions:
- `gramsToKg(g) = g / 1000`
- `kgToGrams(kg) = round(kg x 1000)`
- Working weight estimate: `round(oneRmKg x 0.8 x 2) / 2`

**Source:** `packages/training-engine/src/formulas/weight-rounding.ts`
