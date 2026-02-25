# Feature: Volume Management

**Status**: Planned

**Date**: 2026-02-22

## Overview

Parakeet tracks weekly training volume per muscle group and compares it against scientifically-backed thresholds (MEV and MRV). This data gates and modulates each JIT-generated session, ensuring the lifter trains hard enough to stimulate adaptation but not so hard they can't recover.

## Background: MEV and MRV

**MEV (Minimum Effective Volume):** The least amount of training volume per muscle group per week that produces meaningful adaptation. Training below MEV yields little benefit.

**MRV (Maximum Recoverable Volume):** The most volume a muscle group can receive in a week and still recover by the next session. Training above MRV consistently leads to overtraining, degraded performance, and injury risk.

The goal is to accumulate volume progressively across a training block, staying above MEV and approaching (but not exceeding) MRV by the final week before deload.

**The dose-response relationship:** A 2017 meta-analysis (Schoenfeld et al., *J Strength Cond Res*) found that more weekly sets per muscle group produce greater hypertrophy gains in a clear dose-response pattern. The MEV/MRV model reflects the asymptotic nature of this curve — gains are steep from MEV to ~75% MRV, then plateau and reverse past MRV as fatigue outpaces adaptation. Progressive volume accumulation across a block (e.g., 10 → 14 → 18 sets/week for quads) is more effective than starting at MRV, because it maximises the time spent in the steep part of the curve.

**The deload is not optional:** Removing the accumulated fatigue (deload week) is what reveals the adaptation that occurred during the block. Without it, MRV-level training simply maintains fitness rather than building it. This is the functional basis of the deload gate in the block structure.

**Source:** Dr. Mike Israetel's volume landmark research (Renaissance Periodization); Schoenfeld et al. (2017).

## Default Volume Landmarks

Defaults vary by biological sex. Female lifters can generally handle 20–30% more weekly volume and require more sets to achieve equivalent stimulus. See [sex-based-adaptations.md](./sex-based-adaptations.md) for the research basis.

**Male defaults:**

| Muscle | MEV (sets/wk) | MRV (sets/wk) |
|--------|---------------|---------------|
| Quads | 8 | 20 |
| Hamstrings | 6 | 20 |
| Glutes | 0 | 16 |
| Lower Back | 6 | 12 |
| Upper Back | 10 | 22 |
| Chest | 8 | 22 |
| Triceps | 6 | 20 |
| Shoulders | 8 | 20 |
| Biceps | 8 | 20 |

**Female defaults:**

| Muscle | MEV (sets/wk) | MRV (sets/wk) |
|--------|---------------|---------------|
| Quads | 10 | 26 |
| Hamstrings | 8 | 25 |
| Glutes | 0 | 20 |
| Lower Back | 7 | 15 |
| Upper Back | 12 | 28 |
| Chest | 10 | 26 |
| Triceps | 8 | 24 |
| Shoulders | 10 | 24 |
| Biceps | 10 | 24 |

The correct default table is selected automatically based on the biological sex recorded in the user profile. Users can override any value in Settings → Volume Config. Changes take effect immediately on the next JIT generation.

## Volume Counting

Volume is counted as **sets per muscle group per week**:
- Primary muscles: 1.0 sets credit per completed set
- Secondary muscles: 0.5 sets credit per completed set

**Lift → muscle group mapping:**
- Squat → Quads (1.0), Glutes (1.0), Hamstrings (0.5), Lower Back (0.5)
- Bench → Chest (1.0), Triceps (0.5), Shoulders (0.5)
- Deadlift → Hamstrings (1.0), Glutes (1.0), Lower Back (1.0), Upper Back (0.5)

Volume is computed from `session_logs` (actual completed sets), not `sessions.planned_sets`. Only completed sessions count.

## Pre-Workout Soreness Check-In

Before every session, the user rates soreness for the primary muscles involved in that day's lift. This must be completed before JIT generation runs.

**Scale:**
- 1: Fresh — no soreness
- 2: Mild — slight tightness, no impact on training
- 3: Moderate — noticeable, some movement restriction
- 4: High — significant discomfort or limited range
- 5: Severe — should not train this muscle today

**Which muscles are shown:**
- Squat sessions: Quads, Glutes, Lower Back
- Bench sessions: Chest, Triceps, Shoulders
- Deadlift sessions: Hamstrings/Glutes, Lower Back, Upper Back

**Why this matters:** Soreness is a recovery signal. By capturing it just before each session, the JIT generator can modulate volume and intensity in real time rather than guessing at recovery state.

## JIT Volume Modulation

When the JIT generator runs, it applies adjustments in this order:

1. **Base volume**: Sets/reps from the formula config for this block/intensity type
2. **Performance adjustment**: If recent sessions showed consistently high or low RPE, intensity is nudged ±2.5%
3. **Soreness adjustment**: Worst soreness rating across primary muscles drives set reductions
4. **MRV cap**: If planned sets would push weekly volume past MRV, sets are capped at the remaining capacity
5. **MRV exceeded**: If MRV is already reached for a primary muscle, the main lift is skipped for that muscle group, with a warning
6. **Auxiliary check**: Same soreness and MRV logic applied to auxiliary exercises

All adjustments are displayed to the user with plain-language rationale before they start lifting.

## Volume Dashboard

The Volume Dashboard shows current-week volume vs MRV/MEV for all 9 muscle groups. Accessible from:
- Today tab: compact volume card at the bottom of the screen
- Settings: full volume screen with all 9 muscle groups

**Bar chart:** Each bar runs from 0 to MRV. A vertical line marks MEV. Color coding:
- Orange: below MEV (not enough stimulus)
- Green: in range
- Yellow: within 2 sets of MRV (approaching)
- Red: at or above MRV

**Automatic warnings on Today screen:** If any primary muscle for the upcoming session is at MRV or MRV-exceeded, a banner appears: "Your [quads] have reached their weekly MRV. Today's squat volume has been automatically reduced."

## Implementation Status

### Planned

- `computeWeeklyVolume()` from session logs
- `classifyVolumeStatus()` per muscle (below MEV / in range / approaching MRV / at MRV / exceeded)
- MRV cap in JIT generator
- Soreness check-in screen before every session
- Volume Dashboard (compact + full view)
- User-editable MEV/MRV config (Settings → Volume Config)
- Warnings and rationale displayed on session screen

## Future Enhancements

**Phase 2:**
- Volume progression visualization across blocks (was MEV met each week? Did volume build appropriately?)
- Recovery score: composite of soreness, session RPE, and performance trend — displayed on Today screen

**Long-term:**
- Sleep/HRV integration to modulate MRV dynamically (if user sleeps poorly, reduce effective MRV)
- Per-user MRV calibration based on actual performance data (automate what Dr. Israetel's manual auditing process does)

## References

- Related Design Docs: [program-generation.md](./program-generation.md), [performance-logging.md](./performance-logging.md)
- Specs: [engine-006-mrv-mev-calculator.md](../specs/engine-006-mrv-mev-calculator.md), [engine-007-jit-session-generator.md](../specs/engine-007-jit-session-generator.md), [engine-009-soreness-adjuster.md](../specs/engine-009-soreness-adjuster.md), [parakeet-011-soreness-checkin-screen.md](../specs/parakeet-011-soreness-checkin-screen.md), [parakeet-012-volume-dashboard.md](../specs/parakeet-012-volume-dashboard.md)
- External: Dr. Mike Israetel, Renaissance Periodization — volume landmark research
