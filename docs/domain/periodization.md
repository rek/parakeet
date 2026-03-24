# Periodization

Domain constants and logic for the Cube Method periodization scheme.

## Cube Method

### Rotation

3-week blocks with a fixed exercise-to-intensity-type rotation:

| Week in Block | Squat     | Bench     | Deadlift  |
|---------------|-----------|-----------|-----------|
| 1             | Heavy     | Rep       | Explosive |
| 2             | Explosive | Heavy     | Rep       |
| 3             | Rep       | Explosive | Heavy     |

### Block Arithmetic

| Derived Value   | Formula                               |
|-----------------|---------------------------------------|
| Block number    | `floor((weekNumber - 1) / 3) + 1`    |
| Week in block   | `((weekNumber - 1) % 3) + 1`         |

### Deload

- Scheduled programs: week 10.
- Unending programs: every 4th training week — `weekNumber % 4 === 0`.

**Source:** `packages/training-engine/src/cube/scheduler.ts`

---

## Block Loading (Male)

| Block | Intensity | %1RM | Sets  | Reps    | RPE |
|-------|-----------|------|-------|---------|-----|
| B1    | Heavy     | 80%  | 2     | 5       | 8.5 |
| B1    | Explosive | 65%  | 3     | 8       | 7.0 |
| B1    | Rep       | 70%  | 2–3   | 8–12    | 8.0 |
| B2    | Heavy     | 85%  | 2     | 3       | 9.0 |
| B2    | Explosive | 70%  | 2     | 6       | 7.5 |
| B2    | Rep       | 80%  | 2–3   | 4–8     | 8.0 |
| B3    | Heavy     | 90%  | 4     | 1–2     | 9.5 |
| B3    | Explosive | 75%  | 2     | 2       | 8.0 |
| B3    | Rep       | 85%  | 2–3   | 3–5     | 8.5 |
| —     | Deload    | 40%  | 3     | 5       | 5.0 |

**Source:** `packages/training-engine/src/cube/blocks.ts`

---

## Block Loading (Female)

Female loading uses the same %1RM and rep ranges but differs in sets and RPE targets.

| Block | Intensity | %1RM | Sets  | Reps    | RPE |
|-------|-----------|------|-------|---------|-----|
| B1    | Heavy     | 80%  | 3     | 5       | 8.0 |
| B1    | Explosive | 65%  | 3     | 8       | 6.5 |
| B1    | Rep       | 70%  | 3–4   | 8–12    | 7.5 |
| B2    | Heavy     | 85%  | 3     | 3       | 8.5 |
| B2    | Explosive | 70%  | 2     | 6       | 7.0 |
| B2    | Rep       | 80%  | 3–4   | 4–8     | 7.5 |
| B3    | Heavy     | 90%  | 4     | 1–2     | 9.0 |
| B3    | Explosive | 75%  | 2     | 2       | 7.5 |
| B3    | Rep       | 85%  | 2–3   | 3–5     | 8.0 |
| —     | Deload    | 40%  | 3     | 5       | 5.0 |

**Source:** `packages/training-engine/src/cube/blocks.ts`

---

## Progressive Overload

### Percentage Increment

- Heavy %1RM increases by **+5%** per block.

### Training Max Increases Per Cycle

| Sex    | Bench     | Squat      | Deadlift   |
|--------|-----------|------------|------------|
| Male   | 2.5–5 kg  | 5–10 kg    | 5–10 kg    |
| Female | 2.5 kg    | 5–7.5 kg   | 5–7.5 kg   |

### Weight Rounding

All prescribed weights are rounded to the nearest **2.5 kg**.

**Source:** `packages/training-engine/src/cube/blocks.ts`

---

## Rest Seconds

Research basis: Schoenfeld 2016 (RCT) — 3-min rest > 1-min for both strength and hypertrophy in trained men. Grgic 2017 (systematic review) — longer rest advantageous for trained individuals. Azevedo 2024 (Bayesian meta-analysis) — for strength at high intensity, 3-5 minutes is well-supported. Our B3 Heavy rest (300s/270s) aligns with this; B1 values (120-180s) reflect lower relative intensity. See [references.md](references.md).

### Male

| Block | Intensity | Rest (s) |
|-------|-----------|----------|
| B1    | Heavy     | 180      |
| B1    | Explosive | 120      |
| B1    | Rep       | 120      |
| B2    | Heavy     | 210      |
| B2    | Explosive | 150      |
| B2    | Rep       | 120      |
| B3    | Heavy     | 300      |
| B3    | Explosive | 180      |
| B3    | Rep       | 150      |
| —     | Deload    | 90       |
| —     | Auxiliary | 90       |

**Source:** `packages/training-engine/src/cube/blocks.ts`

---

### Female

All non-deload and non-auxiliary values are 30s less than male. Rationale: women recover faster between sets (Hicks 2018; Nuckols 2025). Deload and auxiliary remain 90s.

| Block | Intensity | Rest (s) |
|-------|-----------|----------|
| B1    | Heavy     | 150      |
| B1    | Explosive | 90       |
| B1    | Rep       | 90       |
| B2    | Heavy     | 180      |
| B2    | Explosive | 120      |
| B2    | Rep       | 90       |
| B3    | Heavy     | 270      |
| B3    | Explosive | 150      |
| B3    | Rep       | 120      |
| —     | Deload    | 90       |
| —     | Auxiliary | 90       |

**Source:** `packages/training-engine/src/cube/blocks.ts`

---

## Training Day Patterns

Day offsets are measured in days from Monday (0 = Monday).

| Days/Week | Offsets      |
|-----------|--------------|
| 3         | 0, 2, 4      |
| 4         | 0, 1, 3, 5   |
| 5         | 0, 1, 2, 4, 5 |

**Source:** `packages/training-engine/src/cube/scheduler.ts`

---

## Unending Mode

Unending programs generate sessions on-demand (lazy) rather than pre-building a full schedule.

| Aspect           | Behavior                                                                 |
|------------------|--------------------------------------------------------------------------|
| Session generation | On-demand at JIT time                                                  |
| Lift rotation    | S → B → D, determined from session history; falls back to counter-based |
| Block cycling    | `((floor((weekNumber - 1) / 3) % 3) + 1)`                              |
| Deload trigger   | Every 4th training week: `weekNumber % 4 === 0`                         |

**Source:** `packages/training-engine/src/cube/scheduler.ts`

---

## Planned: 4-Lift (OHP)

Not yet implemented. Planned extension to include Overhead Press as a fourth primary lift.

| Days/Week | Lift Order      |
|-----------|-----------------|
| 3         | S / B / D (unchanged) |
| 4         | S / B / D / OHP |

**Source:** `packages/training-engine/src/cube/blocks.ts` (planned)
