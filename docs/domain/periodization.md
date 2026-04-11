# Periodization

Domain constants and logic for the Cube Method periodization scheme.

## Cube Method

Concurrent periodization (Brandon Lilly, 2013). Each lift gets a different stimulus each week (Heavy/Explosive/Rep) rather than the entire program being in one phase. This allows simultaneous development of maximal strength, speed, and work capacity.

### Known Limitation: Low Competition Lift Frequency

Each lift is trained **once per week** in the standard Cube rotation. This means weekly working sets per competition lift are only 2-3 (one session's worth). Research suggests 5+ weekly sets per exercise for trained lifters (Ralston et al. 2017 meta-analysis) and at least 3-6 sets/week at RPE 7.5-9.5 for meaningful powerlifting strength gains (Androulakis-Korakakis et al. 2021). The Cube compensates with auxiliary work (6 sets/session from 2 exercises) contributing to the same muscle groups, but this is less specific than competition lift volume.

Most modern powerlifting programs (Sheiko, GZCL, nSuns, Barbell Medicine) train each lift 2-3x/week. The Cube Method's 1x/week frequency is a known tradeoff: lower specificity but higher variation and recovery between heavy sessions.

**Comparison to established programs:**

| Program | Working sets/session (main lift) | Frequency/week | Weekly main lift volume |
|---------|--------------------------------|----------------|----------------------|
| Cube Method | 2-4 (varies by type) | 1x | 2-4 sets |
| 5/3/1 | 3 + supplemental (5x10 BBB) | 1x | 3-8 sets |
| Texas Method | 5 (volume) / 1 (intensity) | 2x | 6 sets |
| Sheiko | 6-10+ (sub-maximal) | 2-3x | 12-30 sets |
| GZCL | 3-5 (T1) + T2/T3 | 1-2x | 3-10 sets |
| Conjugate/Westside | 1 (ME max) + 8-12x2-3 (DE) | 2x | 9-13 sets |

Research basis: Ralston et al. 2017 meta-analysis — 5+ weekly sets significantly better than <=5 for multi-joint strength (ES=0.18). Androulakis-Korakakis et al. 2021 — back-off sets significantly more effective than single top sets (99.6% probability of meaningful gains). Pelland 2025 — per-session diminishing returns beyond ~2 direct sets for strength, but assumes adequate weekly frequency. See [references.md](references.md).

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

## Unending Intensity Selection

Unending programs do not use the CUBE rotation matrix. Intensity type is selected per-session based on athlete signals. Priority order — first matching rule wins:

| Priority | Condition | Result |
|----------|-----------|--------|
| 1 | Deload week (`weekNumber % 4 === 0`) | `deload` |
| 2 | Max soreness across primary muscles ≥ **7** | `rep` |
| 3 | Days since last session for this lift ≥ **10** | `heavy` |
| 4 | Avg RPE of last **3** sessions for this lift ≥ **8.5** | `explosive` |
| 5 | Would repeat last intensity type | next in `heavy → explosive → rep` |
| 6 | Default (no signal) | `heavy` |

### Thresholds

| Constant | Value | Rationale |
|----------|-------|-----------|
| Soreness threshold (high) | 7/10 | Matches soreness adjuster "high" level (7–8 = avoid heavy load) |
| Long-gap threshold | 10 days | Beyond normal 7-day deload tolerance; fully rested |
| RPE fatigue threshold | 8.5 avg | Sustained RPE 8.5+ = accumulated CNS stress; speed work reduces demand |
| Recent RPE window | 3 sessions | Short window — reacts to current block, not historical baseline |

**Source:** `packages/training-engine/src/cube/scheduler.ts` (`selectIntensityTypeForUnending`)

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
