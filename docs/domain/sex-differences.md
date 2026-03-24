# Sex Differences

All male/female differentiation across the system. Each section links to the relevant domain doc for full tables.

Research basis: RP Strength volume landmarks, Judge & Burke 2010 (sex differences in recovery), Frontiers in Physiology 2018 (female fatigue resistance).

---

## Volume Thresholds

Female MRV/MEV defaults are approximately 20-30% higher than male across most muscle groups.

Full tables: [volume-landmarks.md](volume-landmarks.md)

---

## Block Loading

Female config uses the same %1RM but differs in sets and RPE targets. Key differences:

| Block | Intensity | Female Sets | Male Sets | Female RPE | Male RPE |
|-------|-----------|-------------|-----------|------------|----------|
| B1    | Heavy     | 3           | 2         | 8.0        | 8.5      |
| B1    | Explosive | 3           | 3         | 6.5        | 7.0      |
| B1    | Rep       | 3-4         | 2-3       | 7.5        | 8.0      |
| B2    | Heavy     | 3           | 2         | 8.5        | 9.0      |
| B3    | Heavy     | 4           | 4         | 9.0        | 9.5      |

Pattern: more sets at lower RPE -- higher work capacity with less maximal strain.

Full tables: [periodization.md](periodization.md)

---

## Performance Thresholds

| Parameter                      | Male | Female | Rationale |
|--------------------------------|------|--------|-----------|
| RPE deviation threshold        | 1.0  | 1.5    | RPE fluctuates across menstrual cycle |
| Consecutive sessions required  | 2    | 3      | More data needed to separate cycle effects from real trends |

**Source:** `packages/training-engine/src/adjustments/performance-adjuster.ts`

---

## Auxiliary Reps

| Sex    | Default Reps |
|--------|-------------|
| Male   | 10          |
| Female | 12          |

Per-exercise overrides (e.g., Barbell Box Squat = 4 reps) apply regardless of sex.

**Source:** `packages/training-engine/src/generator/steps/processAuxExercise.ts`

---

## Rest Times

Female rest is 30s shorter across all non-deload blocks. Deload and auxiliary rest are equal (90s).

Rationale: Women recover faster between sets (Frontiers in Physiology 2018).

Full tables: [periodization.md](periodization.md)

---

## Warmup Protocol

| Sex    | Steps | Percentages                          |
|--------|-------|--------------------------------------|
| Male   | 4     | 40%, 60%, 75%, 90%                   |
| Female | 5     | 40%, 55%, 70%, 85%, 92.5%            |

Female protocol has more gradual ramp to accommodate typically lower absolute loads and reduce injury risk.

**Source:** `packages/training-engine/src/generator/warmup-calculator.ts`

---

## Training Max Increases

| Sex    | Bench     | Squat      | Deadlift   |
|--------|-----------|------------|------------|
| Male   | 2.5-5 kg  | 5-10 kg    | 5-10 kg    |
| Female | 2.5 kg    | 5-7.5 kg   | 5-7.5 kg   |

Less aggressive progression for female lifters.

**Source:** `packages/training-engine/src/cube/blocks.ts`

---

## Soreness Level 4

| Sex    | Sets Reduced | Intensity Multiplier |
|--------|--------------|----------------------|
| Male   | 2            | 0.95                 |
| Female | 1            | 0.97                 |

Females experience less acute muscle damage at equivalent relative intensities.

Full table: [adjustments.md](adjustments.md)

---

## Menstrual Cycle

5-phase model with intensity and volume modifiers. Only applies when cycle tracking is enabled.

Full table: [adjustments.md](adjustments.md)

Phase calculation scales to user's configured cycle length (default 28 days).

**Source:** `packages/training-engine/src/formulas/cycle-phase.ts`
