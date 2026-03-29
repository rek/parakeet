# Competition Readiness Scoring

**Status:** Draft
**Issue:** GH#148 (extension)
**Date:** 29 Mar 2026

## Overview

Grade every rep in a training video against IPF competition standards — did the squat break parallel, did the deadlift lock out, did the bench pause and lock. Show a per-rep verdict (white light / red light / borderline) and an overall competition readiness percentage built from recent training videos.

## Problem Statement

Lifters preparing for a powerlifting meet need to know whether their training reps would pass in competition. Current video analysis shows form metrics (depth, lean, drift) but doesn't render a binary judgment: **would this rep get three white lights?**

- Lifters misjudge depth — "I thought I hit depth" is the most common failed squat
- Deadlift lockout is hard to feel from the inside — video is the only reliable check
- Bench press requires a visible pause and full lockout — hard to self-assess
- There's no longitudinal readiness signal — "am I competition-ready this week?"

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Federation | IPF rules only | IPF judging criteria are the strictest and most universal. USPA/WRPF differences are stance/equipment, not rep validity. |
| 2 | Grading model | Deterministic rules, not LLM | Pass/fail is objective rule application. LLM coaching references grades but doesn't compute them. |
| 3 | Verdict levels | `white_light`, `red_light`, `borderline` | Binary pass/fail misses the reps that are technically legal but dangerously close. Borderline = within 2cm of parallel or 5° of lockout. |
| 4 | Readiness score | % of white lights across last 5 videos per lift | Rolling window, not cumulative. Recent form matters more than historical. |
| 5 | Camera angle | Side view for all criteria; front view adds knee cave | Depth, lockout, pause, bar path are all visible from side. Knee valgus needs front. |
| 6 | Pause detection | Bar velocity near zero for ≥0.3s at bottom (bench only) | IPF bench requires a visible pause. Detected from bar path Y velocity stall. |

## User Experience

### Primary Flow

1. Lifter records a set and runs video analysis (existing flow)
2. Each rep shows a verdict badge: green check (white light), red X (red light), or yellow ~ (borderline)
3. Failed reps show the specific reason: "Hip crease 1.8cm above knee at bottom"
4. Below the rep cards, a **Competition Readiness** section shows:
   - Pass rate per lift: "Squat: 94% (17/18 reps)" across recent videos
   - Trend arrow: improving / stable / declining vs previous block
   - The single most common failure reason: "2 reps failed depth in the last 5 sessions"

### Edge Cases

- First video (no history): show per-rep verdicts but no readiness percentage
- Deload sessions: exclude from readiness calculation (lighter weights = different form)
- Front view only: skip depth/lockout grading (insufficient angle), show knee valgus only

## Competition Criteria by Lift

### Squat (IPF Technical Rules 3.1)
| Criterion | Detection | Pass | Borderline | Fail |
|-----------|-----------|------|------------|------|
| Depth | Hip crease Y vs knee Y | ≥2cm below | 0-2cm below | Above knee |
| Lockout | Knee angle at end frame | ≥175° | 170-175° | <170° |
| Forward motion | Bar path X monotonicity at top | No forward drift >2cm | 2-4cm | >4cm |

### Bench (IPF Technical Rules 4.1)
| Criterion | Detection | Pass | Borderline | Fail |
|-----------|-----------|------|------------|------|
| Chest contact | Bar Y reaches consistent bottom | Bottom Y stable ±1cm | Inconsistent | No clear bottom |
| Pause | Bar velocity ≈0 for ≥0.3s at bottom | ≥0.3s | 0.15-0.3s | <0.15s or no pause |
| Lockout | Elbow angle at top frame | ≥170° | 165-170° | <165° |
| Even press | Left/right wrist Y delta at lockout | <2cm | 2-4cm | >4cm |

### Deadlift (IPF Technical Rules 5.1)
| Criterion | Detection | Pass | Borderline | Fail |
|-----------|-----------|------|------------|------|
| Lockout | Hip angle at end frame | ≥175° | 170-175° | <170° |
| Knees locked | Knee angle at end frame | ≥175° | 170-175° | <170° |
| No downward motion | Bar path Y monotonicity during pull | Monotonic | ≤1cm dip | >1cm dip |
| Shoulders back | Shoulder X behind hip X at top | Behind | Aligned | Forward |

## User Benefits

**Meet confidence**: Know before competition day whether your reps would pass.

**Depth calibration**: Objective feedback on the exact centimeters — train your proprioception to match the actual standard.

**Trend tracking**: See whether competition readiness is improving across a training block, not just whether today's set was good.

## References

- IPF Technical Rules: [Section 3 (Squat), 4 (Bench), 5 (Deadlift)](https://www.powerlifting.sport/rules/codes/info/technical-rules)
- Existing detection: `fault-detector.ts`, `depth-detector.ts`, `angle-calculator.ts`
- Spec: `docs/specs/09-mobile/mobile-046-video-form-analysis.md` Phase 4
