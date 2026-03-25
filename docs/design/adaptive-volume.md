# Adaptive Volume Prescription

**Status**: Phase 1-2 implemented, Phase 3 planned

## Problem

A fixed program template prescribes the same volume regardless of who is lifting or how they feel. A beginner and an advanced lifter both get 2 heavy sets. A lifter who slept 9 hours and feels fresh gets the same prescription as one who slept 5 hours. The system reduces volume when the lifter is fatigued (soreness, disruptions, poor readiness) but never increases it when the lifter has demonstrated capacity.

Research shows trained lifters need 5+ working sets per exercise per week for optimal strength gains (Ralston 2017 meta-analysis) and that back-off sets are 99.6% likely to produce meaningful gains vs top sets alone (Androulakis-Korakakis 2021). But the right volume varies by individual, training phase, and daily readiness. Hardcoding more sets is not the answer — the system must learn what each lifter needs.

## Solution: The Adaptive Loop

The JIT pipeline becomes a closed feedback loop:

```
Pre-session check-in
    ↓
Volume calibration (adjust base set count from evidence)
    ↓
Reduction pipeline (soreness, readiness, cycle phase, disruption, MRV cap)
    ↓
Final prescription
    ↓
Workout → RPE + capacity logged per set
    ↓
Post-session evaluation ("could you have done more?")
    ↓
Cross-session learning (RPE trends, modifier calibration)
    ↓
Next session's volume calibration (loop closes)
```

Volume calibration adjusts the base set count **before** the reduction pipeline runs. The reductions then apply on top of the calibrated base. MRV cap is always the final hard constraint.

## Signal Collection

The system collects signals at four time scales:

### Pre-session (every workout)
- **Soreness** per muscle group — granular scale (1-10) to distinguish "slightly fatigued" from "fresh and ready for more"
- **Sleep quality** — 5-point scale (terrible → great) for asymmetric responses: good sleep enables volume boost, poor sleep triggers reduction
- **Energy level** — 5-point scale, same asymmetry
- **Cycle phase** — auto-calculated from period tracking, modulates intensity and volume

### In-session (per set)
- **RPE** — rate of perceived exertion, 6-10 scale. The most direct measure of actual difficulty vs prescribed difficulty.
- **Failed set flag** — explicit signal that the lifter hit their limit
- **Actual weight and reps** — deviation from prescription reveals calibration drift

### Post-session (every workout)
- **Capacity assessment** — "How do you feel? Could you have done more?" — 4-point scale from "barely survived" to "way too easy." The most direct signal for volume calibration.

### Weekly / cross-session
- **Body review** — per-muscle fatigue rating vs system prediction. Mismatches reveal where the system's model diverges from reality.
- **RPE trend analysis** — consistent RPE below target across 3+ sessions means the lifter has untapped capacity.
- **Modifier calibration** — per-athlete learned corrections to the default modifiers. When the system consistently over- or under-adjusts, the calibration narrows the error.

## Volume Calibration

### How it works

Volume calibration runs as Step 0 of the JIT pipeline, before all reduction steps. It produces an additive modifier to the base set count: -2 to +3 sets.

**Signals that increase volume:**
- RPE consistently below target (avg gap >= 1.0 over last 3 sessions for this lift)
- Post-session capacity assessment: "had more in me" or "way too easy"
- Low pre-session soreness for primary muscles (fresh and recovered)
- High readiness (good sleep + high energy)
- Weekly review: "recovering well" mismatch for primary muscles

**Signals that decrease volume:**
- RPE consistently above target (struggling with current prescription)
- Post-session: "barely survived"
- High soreness, poor readiness (existing reduction pipeline handles the acute case; calibration handles the trend)

**Guardrails:**
- MRV cap: never calibrate above maximum recoverable volume
- Minimum: never calibrate below 1 working set
- Soreness 5 (severe): recovery mode overrides everything, including calibration
- Major disruption: skip overrides everything

### Confidence and learning

The modifier calibration system tracks prediction accuracy over time. With few data points (<5 sessions), calibration is conservative (small adjustments). As confidence grows (10+ sessions), the system applies larger calibrations automatically. This means:

- New users get standard prescriptions while the system observes
- After 2-3 weeks, the system starts adapting to individual patterns
- After a full training block, the system has high-confidence calibration

## Interaction with Existing Systems

| Existing system | How it interacts with calibration |
|-----------------|----------------------------------|
| Soreness adjuster | Runs after calibration. A calibrated +2 sets that then gets -1 from soreness = net +1. |
| Readiness adjuster | Runs after calibration. Boost from good readiness stacks with calibration boost. |
| MRV cap | Always last. Calibration cannot push volume above MRV. |
| Volume top-up | Runs independently for auxiliary work. Calibration affects main lift only. |
| Volume recovery | Intra-session reactive offer. Calibration is proactive, pre-session. Both can fire: calibration adds sets up front, recovery adds more if RPE proves easy. |
| Performance adjuster | Currently post-hoc manual. Calibration replaces the need for manual intervention by applying similar logic automatically in the JIT pipeline. |

## Implementation Phases

### Phase 1: Enhanced signal collection
Expand soreness to 1-10, sleep/energy to 1-5, add post-session capacity assessment. Ships independently — more signal is always better regardless of whether volume calibration is active.

### Phase 2: Volume calibration step
Add Step 0 to JIT pipeline. Consumes signals from Phase 1 plus existing RPE history, weekly review data, and modifier calibration. Produces set count adjustment.

### Phase 3: Closed-loop learning
Wire modifier calibration into JIT automatically. Feed weekly review mismatches back into next-week baseline. Progressive volume within blocks: the system learns the right volume for this lifter in this training phase.

## Domain References

- [domain/session-prescription.md](../domain/session-prescription.md) — JIT pipeline steps
- [domain/adjustments.md](../domain/adjustments.md) — existing modifier tables
- [domain/athlete-signals.md](../domain/athlete-signals.md) — signal taxonomy
- [domain/volume-landmarks.md](../domain/volume-landmarks.md) — MRV/MEV as guardrails
- [domain/references.md](../domain/references.md) — Ralston 2017, Androulakis-Korakakis 2021
