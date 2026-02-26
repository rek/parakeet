# Feature: Sex-Based Training Adaptations

**Status**: Planned

**Date**: 2026-02-22

## Overview

Parakeet adjusts its training engine for biological sex across eight areas: default volume thresholds (MEV/MRV), formula config defaults (sets/reps/intensity), warmup protocol defaults, soreness response sensitivity, performance adjuster thresholds, auxiliary work volume, WILKS score calculation, and optional menstrual cycle tracking. The goal is a program that reflects how female lifters actually respond to training — not a "female mode" with different exercises, but calibrated defaults and optional cycle context that make the adaptive systems more accurate.

## Background: Key Differences Between Male and Female Lifters

### Volume and Recovery

Research consistently shows female lifters can handle and _require_ more weekly training volume than male lifters for equivalent adaptation:

- **Higher MEV and MRV**: Women's default volume landmarks are approximately 20–30% higher than men's. A female lifter needs more sets per week to stimulate growth, but she can also recover from more volume before hitting her limit.
- **Faster inter-set recovery**: Women recover between sets faster than men. This affects rest time recommendations and how aggressively the JIT generator can schedule back-to-back sessions.
- **Less muscle damage per session**: Women experience less acute muscle damage from identical training stimuli, which supports higher training frequency.

Source: RP Strength volume landmark research; Dr. Mike Israetel's work on MEV/MRV by population.

### Menstrual Cycle and Strength Performance

The menstrual cycle introduces cyclical hormonal variation that has real physiological effects on training:

| Phase                 | Days (typical 28-day cycle) | Key hormones                | Physiological effects                                                                                               |
| --------------------- | --------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Menstrual**         | 1–5                         | Estrogen + progesterone low | Cramping, fatigue; training is fine if manageable                                                                   |
| **Follicular**        | 6–13                        | Estrogen rising             | Best neuromuscular coordination, moderate evidence for slight strength peak                                         |
| **Ovulatory**         | 12–16                       | Estrogen peaks, LH surge    | Peak strength potential; **highest injury risk** (ligament laxity)                                                  |
| **Luteal**            | 17–28                       | Progesterone dominant       | Higher RPE for same load, elevated core temperature, more fatigue; train normally but RPE signals are less reliable |
| **Late luteal / PMS** | 24–28                       | Both hormones dropping      | Often hardest phase; treat like a mild disruption if symptoms are significant                                       |

**What the science says about cycle-based periodization:**

A 2024 meta-analysis (Niering et al., _Sports_) found medium effect sizes for slightly higher maximal strength in the late follicular phase. However, a critical 2025 review in _Strength & Conditioning Journal_ found that **periodizing strength training specifically around the menstrual cycle has not been shown to produce better outcomes** than traditional training. Most studies in this area also have significant methodological weaknesses (hormone verification not done in 89% of screened studies per a 2025 _Journal of Applied Physiology_ systematic review).

**The pragmatic position:** The cycle has real effects on _perceived_ effort and fatigue. Parakeet already has systems (soreness check-in, RPE tracking, disruption reporting) that naturally capture this. The design does not hard-code phase-specific loading changes — instead, cycle phase provides _context_ that enhances interpretation of the adaptive signals that already exist.

### Injury Risk at Ovulation

Estrogen and relaxin peak at ovulation (~days 12–16). Both hormones increase ligament laxity and relax collagen cross-links. Meta-analysis shows significantly increased ACL laxity during the ovulatory phase. Women are 3–6× more likely to sustain ACL injuries than men, and ovulatory timing is a contributing factor.

This is relevant for powerlifting: heavy squat sessions during the ovulatory window involve high knee loads under conditions of increased laxity. The app surfaces this as an informational note, not a prescriptive load reduction.

Source: PMC11195904 (relaxin review), PMC5524267 (ACL laxity meta-analysis).

## Design Decisions

### 1. Biological Sex in User Profile

Biological sex is collected during onboarding (a single required field). It is used for:

- Selecting the correct default MEV/MRV table
- Selecting the correct WILKS polynomial coefficients
- Enabling the optional menstrual cycle tracking feature (female only)

This is **biological sex** (not gender identity) because it determines physiological defaults. The field options are: Female / Male / Prefer not to say (uses male defaults as the conservative option for volume).

### 2. Sex-Differentiated MEV/MRV Defaults

The default volume landmark table in `volume-management` is replaced with sex-specific values. Female defaults are approximately 20–30% higher:

| Muscle     | Male MEV | Male MRV | Female MEV | Female MRV |
| ---------- | -------- | -------- | ---------- | ---------- |
| Quads      | 8        | 20       | 10         | 26         |
| Hamstrings | 6        | 20       | 8          | 25         |
| Glutes     | 0        | 16       | 0          | 20         |
| Lower Back | 6        | 12       | 7          | 15         |
| Upper Back | 10       | 22       | 12         | 28         |
| Chest      | 8        | 22       | 10         | 26         |
| Triceps    | 6        | 20       | 8          | 24         |
| Shoulders  | 8        | 20       | 10         | 24         |
| Biceps     | 8        | 20       | 10         | 24         |

These are starting defaults — users can override any value in Settings → Volume Config as before.

### 3. WILKS Score — Sex-Specific Coefficients

WILKS uses different polynomial coefficients for male and female lifters. The app uses the **2020 updated Wilks formula** (not the original 1990s formula, not the IPF formula). The 2020 update better balances extreme bodyweight classes and aligns male/female performance comparisons.

- Female coefficients: polynomial in bodyweight (kg) valid for 40–150kg
- Male coefficients: polynomial in bodyweight (kg) valid for 40–200kg

If the user selected "Prefer not to say", the male coefficients are used (this affects score magnitude but not the trend tracking, which is the primary use case).

### 4. Optional Menstrual Cycle Tracking

Menstrual cycle tracking is an **optional feature**, off by default. It does not change the core training program. Its purpose is to provide context for the adaptive systems and give the user visibility into the connection between their cycle and their training.

**What it does:**

- User logs their cycle start date (or connects to a health app in a future phase)
- The app estimates the current phase based on average cycle length (default: 28 days), adjustable by the user
- Current phase is shown as a subtle indicator on the Today screen ("Follicular phase" / "Luteal phase")
- During the **late luteal phase (days 24–28)**: the app suggests considering the session as a Minor disruption if the user rates soreness high or notes significant symptoms — this routes through the existing disruption system, not a special code path
- During the **ovulatory phase (days 12–16)**: a subtle informational note on squat-heavy sessions ("High-load squat day during peak hormone laxity — focus on knee tracking and warm-up quality")
- The cycle phase is stored alongside each session log, allowing the user to review their history and see whether there are personal patterns (some women have large cycle-performance correlations, others have none)

**What it does NOT do:**

- It does not automatically adjust loading percentages based on cycle phase (not evidence-based for strength)
- It does not generate separate "follicular phase programs" or "luteal phase programs"
- It does not require the user to input symptoms — it simply tracks phase based on the logged start date

**Why this approach:**

The soreness check-in and RPE tracking already capture how the user is actually feeling. A lifter in a bad luteal phase will rate soreness high and log high RPE — the JIT generator will respond accordingly. The cycle tracking layer adds _explanatory context_ ("this was a tough week because of where you were in your cycle") and optional disruption routing for severe symptoms, without requiring the engine to make assumptions about what the cycle phase means for this particular individual.

## User Experience

### Onboarding

- Biological sex field added to the Profile/Settings screen created during onboarding (same step as body weight)
- If sex = Female: optional prompt "Would you like to track your menstrual cycle? This helps us understand your training patterns. (You can enable this later in Settings.)"
- If enabled: user enters average cycle length (default 28 days) and date of last period start. (Note: user should be prompted to update every cycle)

### Today Screen

- If cycle tracking is enabled: a small phase indicator pill appears on the Today screen (e.g., "Follicular · Day 9")
- No disruption is shown unless symptoms are manually reported
- On squat-heavy sessions during the ovulatory window: a subtle info chip appears on the session header — not an alarm, not a load reduction, just awareness

### Disruption Reporting

- Menstrual symptoms added as a sub-type under "Fatigue" disruption type ("Menstrual symptoms" as a named option)
- Selecting this auto-sets severity to Minor and lift selection to All Lifts, but user can adjust
- Works exactly like any other Minor disruption — auto-applied load reduction, logged in history

### Settings

- Settings → Profile: biological sex (editable)
- Settings → Cycle Tracking: toggle on/off, cycle length input, last period start date, phase calendar view

### History

- Each past session in the history view optionally shows the cycle phase it occurred in (if tracking was active)
- A "Cycle patterns" view in history: overlay RPE and volume data against cycle phase — see if there are personal trends

### 5. Formula Config (Sets / Reps / Intensity)

Current: a single `DEFAULT_FORMULA_CONFIG` in `blocks.ts` applies to all athletes.

Female lifters respond well to slightly higher volume at slightly lower absolute intensities. This is supported by faster inter-set recovery and different neuromuscular fatigue curves. Proposed sex-differentiated formula defaults:

- **Set counts:** +1 set on Block 1–2 heavy/rep days (e.g., 2→3 sets Block 1 heavy)
- **RPE targets:** −0.5 across all blocks (Block 1 heavy: 8.5→8.0; Block 3 heavy: 9.5→9.0) — female lifters frequently underestimate perceived effort relative to actual load; lower targets produce truer working sets
- **Training max increments:** Lower upper bound for bench (2.5 kg max vs 5 kg) and squat/deadlift (7.5 kg max vs 10 kg) — accounts for lighter absolute loads where fixed kg jumps are proportionally larger

Implementation approach: Add `DEFAULT_FORMULA_CONFIG_FEMALE` alongside the renamed `DEFAULT_FORMULA_CONFIG_MALE`. A `getDefaultFormulaConfig(biologicalSex?)` factory selects the right constant. `FormulaConfig` type is unchanged — user overrides always apply on top of whatever default is selected.

### 6. Warmup Protocol Defaults

Current: four presets (`standard`, `minimal`, `extended`, `empty_bar`), all sex-agnostic. Default is `standard` for everyone.

Female lifters' faster neuromuscular recovery means their peak output requires more sub-maximal priming reps — not because they need more time, but because the activation curve is steeper. A slightly longer warmup with a finer percentage progression reaches that activation peak more reliably. Proposed:

- New preset `standard_female`: 5 reps @ 40%, 4 @ 55%, 3 @ 70%, 2 @ 85%, 1 @ 92.5% (5 steps vs 4; adds a sub-60% step)
- `standard_female` becomes the **default assigned during onboarding for female lifters** — overridable in Settings → Warmup Protocol
- Male lifters continue to default to `standard` (unchanged)
- `WarmupPresetName` type gains `'standard_female'` as a valid option

### 7. Soreness Response

Current: fixed table (`soreness 3 → −1 set`, `soreness 4 → −2 sets + 5% intensity cut`, `soreness 5 → recovery session`). Sex-agnostic.

Research shows female lifters experience less acute muscle damage per training stimulus at equivalent relative intensities. The same soreness rating may encode less physiological damage in a female lifter than a male lifter, meaning the current table may over-adjust for females at level 4. Proposed:

- Soreness 4 (female): −1 set (not −2), intensity multiplier 0.97 (not 0.95)
- Soreness 5 (female): remains recovery session — this is a hard biological ceiling regardless of sex
- Soreness 3 (female): unchanged (−1 set is already a light touch)
- `getSorenessModifier(level, biologicalSex?)` gains an optional sex parameter; female-specific rows override the default table only at level 4

### 8. Performance Adjuster Thresholds

Current: `DEFAULT_THRESHOLDS` — RPE deviation ≥ 1.0 across 2 consecutive sessions triggers a ±2.5% intensity suggestion. Sex-agnostic.

Female lifters' RPE naturally fluctuates across the menstrual cycle (particularly in the late luteal phase, where perceived effort rises at identical absolute loads). Without cycle tracking enabled, a 1.0 RPE deviation threshold will generate false-positive adjustment suggestions. Proposed:

- `DEFAULT_THRESHOLDS_FEMALE`: RPE deviation threshold raised to 1.5, consecutive sessions raised to 3
- `DEFAULT_THRESHOLDS_MALE`: unchanged (current values)
- `suggestProgramAdjustments(logs, thresholds)` already accepts thresholds as a parameter — no signature change needed; the caller selects the threshold set based on `biologicalSex`
- When cycle tracking is enabled, female thresholds may be relaxed toward male defaults in the luteal phase (future enhancement, not in this design)

### 9. Auxiliary Work Volume

Current: all auxiliary work defaults to 3×10 @ RPE 7.5. Sex-agnostic.

Female lifters' higher MEV/MRV and faster inter-set recovery mean they can productively handle more auxiliary volume per session. The same absolute weight produces less muscle damage, so adding reps rather than sets is the appropriate lever. Proposed:

- Female default: 3×12 @ RPE 7.5 (same intensity, 2 more reps per set — consistent with higher volume tolerance without increasing session density)
- Male default: 3×10 @ RPE 7.5 (unchanged)
- This is the starting default; per-exercise overrides in Settings → Auxiliary Exercises take precedence
- `buildAuxiliaryWork()` gains a `biologicalSex` parameter and selects rep count accordingly

---

## Future Enhancements

**Phase 2:**

- Health app integration: import cycle data from Apple Health / Google Fit to avoid manual date entry
- Personal pattern analysis: after 3+ cycles of data, surface whether this user shows significant cycle-performance correlation (many don't — the app won't assume they do)

**Long-term:**

- If the scientific evidence for cycle-based strength periodization becomes robust, incorporate phase-specific loading modulation — this is explicitly not done now because the evidence doesn't yet support it

## References

- [Niering et al. 2024 — Systematic review, maximal strength and menstrual cycle phases](https://www.mdpi.com/2075-4663/12/1/31)
- [Frontiers 2025 — No influence of menstrual cycle on strength performance or adaptations](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2023.1054542/full)
- [NSCA 2025 — Evidence for periodizing training around menstrual cycle](https://journals.lww.com/nsca-scj/fulltext/2025/12000/evidence_for_periodizing_strength_and_or_endurance.4.aspx)
- [J. Applied Physiology 2025 — Methodological issues in menstrual cycle research](https://journals.physiology.org/doi/full/10.1152/japplphysiol.00223.2025)
- [PMC11195904 — Relaxin and ACL injuries systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC11195904/)
- [PMC5524267 — Menstrual cycle, contraceptives, ACL injuries meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC5524267/)
- [2020 Wilks Formula](https://worldpowerlifting.com/wilks-formula/)
- RP Strength — Volume landmarks and female training differences
- Related Design Docs: [volume-management.md](./volume-management.md), [disruption-management.md](./disruption-management.md), [user-onboarding.md](./user-onboarding.md), [achievements.md](./achievements.md)
