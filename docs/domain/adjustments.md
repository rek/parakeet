# Adjustments

All modifiers that alter session prescription based on athlete state. Each modifier feeds into a specific step of the JIT pipeline (see [session-prescription.md](session-prescription.md)).

---

## Soreness Modifiers

Worst soreness score across the session's primary muscles determines the modifier. Primary muscles per lift: squat = quads/glutes/lower\_back, bench = chest/triceps/shoulders, deadlift = hamstrings/glutes/lower\_back/upper\_back.

### Male

| Level | Description | Sets Reduced | Intensity Multiplier | Recovery Mode |
|-------|-------------|--------------|----------------------|---------------|
| 1     | Fresh       | 0            | 1.0                  | No            |
| 2     | Mild        | 0            | 1.0                  | No            |
| 3     | Moderate    | 1            | 1.0                  | No            |
| 4     | High        | 2            | 0.95                 | No            |
| 5     | Severe      | --           | 0.0                  | Yes           |

### Female

Same as male except level 4:

| Level | Sets Reduced | Intensity Multiplier | Rationale                                                 |
|-------|--------------|----------------------|-----------------------------------------------------------|
| 4     | 1            | 0.97                 | Females experience less acute muscle damage at equivalent relative intensities |

### Recovery Mode (Level 5)

Overrides all other modifiers. Produces a fixed recovery session:

| Parameter | Value                                  |
|-----------|----------------------------------------|
| Weight    | `max(barWeightKg, 0.4 x plannedWeight)` |
| Sets      | 3                                      |
| Reps      | 5                                      |
| RPE       | 5.0                                    |

**Source:** `packages/training-engine/src/adjustments/soreness-adjuster.ts`

---

## Readiness Modifiers

Sleep and energy are each rated 1-3 (1=poor, 2=normal, 3=great). `undefined` is treated as normal (2).

| Sleep | Energy | Sets Reduced | Intensity Multiplier | Rationale                           |
|-------|--------|--------------|----------------------|-------------------------------------|
| 1     | 1      | 1            | 0.95                 | Poor sleep and low energy           |
| 1     | 2-3    | 0            | 0.975                | Poor sleep only                     |
| 2-3   | 1      | 0            | 0.975                | Low energy only                     |
| 3     | 3      | 0            | 1.025                | Great sleep and high energy (boost) |
| other | other  | 0            | 1.0                  | Neutral                             |

**Source:** `packages/training-engine/src/adjustments/readiness-adjuster.ts`

---

## Cycle Phase Modifiers

Based on McNulty et al. 2020 meta-analysis (78 studies) of menstrual cycle and exercise performance.

| Phase       | Days (28-day) | Intensity Multiplier | Volume Modifier |
|-------------|---------------|----------------------|-----------------|
| Menstrual   | 1-5           | 0.95                 | -1 set          |
| Follicular  | 6-11          | 1.0                  | 0               |
| Ovulatory   | 12-16         | 1.0                  | 0               |
| Luteal      | 17-23         | 0.975                | 0               |
| Late Luteal | 24-end        | 0.95                 | -1 set          |

**Research context:** McNulty 2020 found only a trivial overall effect (ES = -0.06, 95% CrI: -0.16 to 0.04) — early follicular vs late follicular was the largest differential (ES = -0.14). Hayashida et al. 2024 meta-analysis (22 studies) found medium effect for isometric strength in late follicular (peak) but small/negligible effects for dynamic strength. Colenso-Semple et al. 2023 umbrella review concluded it is "premature to conclude that short-term fluctuations in reproductive hormones appreciably influence acute exercise performance." Our modifiers are conservative — they accommodate individual variation without over-correcting based on group-level effects that are statistically trivial. See [references.md](references.md).

### Phase Calculation

Day of cycle: `(daysSincePeriodStart % cycleLength) + 1`

Non-28-day scaling: `scaledDay = round(dayOfCycle x 28 / cycleLength)`

**Source:** `packages/training-engine/src/adjustments/cycle-phase-adjuster.ts`, `formulas/cycle-phase.ts`

---

## Disruption Modifiers

| Type                  | Severity | Action               | Reduction                     |
|-----------------------|----------|----------------------|-------------------------------|
| Injury                | Major    | Session skipped      | --                            |
| Injury                | Moderate | Weight reduced       | -40%                          |
| Injury                | Minor    | Weight reduced       | -20%                          |
| Illness               | Major    | Session skipped      | --                            |
| Illness               | Moderate | Weight + reps reduced| -25% weight, -2 reps          |
| Illness               | Minor    | Reps reduced         | -2 reps                       |
| Travel                | Any      | Weight reduced       | -30%                          |
| Fatigue               | Major    | Session skipped      | --                            |
| Fatigue               | Moderate | Weight reduced       | -20%                          |
| Fatigue               | Minor    | No auto-action       | Recorded in context only      |
| Equipment unavailable | Any      | Exercise substituted | Bodyweight alternatives added |

**Source:** `packages/training-engine/src/adjustments/disruption-adjuster.ts`

---

## Volume Recovery

Offers to add back sets that were removed by soreness/readiness/cycle-phase/disruption modifiers, when actual RPE shows the lifter has more capacity than expected.

### Trigger Conditions

All must be true:

| Condition | Threshold |
|-----------|-----------|
| Average RPE gap (target - actual) | >= 1.5 |
| Completed sets with RPE data | >= 1 |
| Sets previously removed | > 0 |
| NOT in recovery mode | Soreness != 5 |

When triggered, offers to add back `totalSetsRemoved` sets at current working weight and reps.

**Source:** `packages/training-engine/src/adjustments/volume-recovery.ts`

---

## Performance Adjuster

Longer-term RPE trend detection for formula config suggestions.

| Parameter                      | Male | Female |
|--------------------------------|------|--------|
| RPE deviation threshold        | 1.0  | 1.5    |
| Consecutive sessions required  | 2    | 3      |
| Incomplete session threshold   | 80%  | 80%    |
| Max suggestions per lift       | 1    | 1      |
| Adjustment per suggestion      | +/- 2.5% | +/- 2.5% |

Female thresholds are more conservative because RPE fluctuates across the menstrual cycle; higher thresholds prevent false positives during late luteal phase.

**Source:** `packages/training-engine/src/adjustments/performance-adjuster.ts`

---

## Volume Increase Triggers (Planned)

The system currently only reduces volume. The adaptive volume calibration step (JIT Step 0, planned) adds the ability to increase volume based on capacity signals. See [adaptive-volume design](../design/adaptive-volume.md).

| Signal | Condition | Effect | Confidence needed |
|--------|-----------|--------|-------------------|
| RPE trend | Avg gap >= 1.0 below target over 3+ sessions | +1 set | Medium |
| RPE trend | Avg gap >= 1.5 below target over 3+ sessions AND low soreness + high readiness | +2 sets | Medium |
| Post-session capacity | Consistently "had more in me" (3/4) or "way too easy" (4/4) | +1 set | Low (direct signal) |
| Weekly mismatch | "Recovering well" for primary muscles | +1 set next week | Medium |
| Modifier calibration | System consistently over-reduces for this athlete | Reduce future reductions | High |

**Guardrails:** Volume calibration cannot push total sets above MRV. Soreness >= 7/10 or major disruption overrides any calibration increase. Minimum confidence thresholds prevent premature adaptation for new users.

---

## Compounding Rules

When multiple adjustments are active simultaneously:

| Rule | Detail |
|------|--------|
| Soreness + disruption | Take `min()` per dimension (sets, intensity) -- not additive |
| Major disruption | Full override -- skip session, ignore prior adjustments |
| Soreness = 5 | Recovery mode -- ignore all other adjustments |
| RPE + soreness <= 3 | Both apply independently |
| Readiness | Always applies (independent) |
| Cycle phase | Always applies (independent) |
| Volume calibration (Step 0) | Runs first. Reductions apply on top of calibrated base. |
| MRV cap | Always last -- hard constraint after all modifiers, including calibration |

**Source:** `packages/training-engine/src/generator/jit-session-generator.ts`
