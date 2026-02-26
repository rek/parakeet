# Feature: Cycle Review & Longitudinal Insights

**Status**: Planned

**Date**: 2026-02-22

## Overview

At the end of each training cycle, Parakeet compiles all session data into a structured report and sends it to an LLM for expert-level analysis. The LLM acts as a coach reviewing a complete training log — finding what worked, what didn't, which auxiliary exercises correlated with main lift improvements, and what should change in the next cycle. This is the primary mechanism through which the system gets smarter about a specific lifter over time.

This is a separate concern from JIT session generation. JIT answers: *"What should I lift today, given how I feel right now?"* Cycle Review answers: *"What does 10–14 weeks of data tell us about how THIS lifter responds to training?"*

## Problem Statement

Formula engines and JIT generators are stateless in the long run — they adjust based on recent signals (last 2–6 sessions) but don't accumulate knowledge about the lifter across months and years. Important patterns go undetected:

- Aux Exercise X consistently precedes better squat performance two weeks later — but no formula can detect this
- This lifter recovers from heavy deadlifts faster than the MEV/MRV defaults assume — but the defaults never update
- Every time this lifter enters a luteal phase in week 3 of a block, performance dips and then rebounds in week 4 — a fixable scheduling insight
- Bench has stagnated for two cycles despite no formula changes — something structural needs to change

A human coach reviewing a full training log would catch all of these. Sending the structured cycle data to an LLM gives every lifter access to that level of analysis.

## Cycle Review Flow

### When It Triggers

The cycle review generates automatically when a training cycle is marked complete (≥80% of sessions completed/disrupted — same threshold as the cycle completion badge). It can also be triggered manually by the user at any point.

### What Data Is Compiled

The cycle report is a structured JSON document assembled from Supabase. It covers the entire completed cycle:

```
CycleReport {
  meta: {
    cycleNumber, programLengthWeeks, startDate, endDate
    biologicalSex, bodyWeightStart, bodyWeightEnd
    completionPct, streakWeeks, disruptionCount
  }

  liftSummary: {
    squat: {
      estimatedOneRmStart, estimatedOneRmEnd, oneRmChangeKg
      sessionCount, completedSets, missedSessions
      avgRpeVsTarget (per block), avgVolumePerWeek
      highConfidenceOneRmSets: [{date, weightKg, reps, rpe, conditions}]
    }
    // same for bench, deadlift
  }

  weeklyVolume: [{
    week, muscleGroup, setsCompleted, mrvPct, sorenessAvg
  }]  // full 14-week matrix

  auxiliaryWork: [{
    exercise, lift, block, setsTotal, weekFollowingData: {rpe, oneRmEstimate}
  }]  // maps each aux to subsequent main lift performance

  disruptions: [{type, severity, startDate, endDate, sessionsAffected}]

  menstrualCycleOverlay?: [{
    phase, weekNumber, avgRpe, avgVolumeCompleted, subjectedNotedDifficulty
  }]  // female users with tracking enabled

  formulaHistory: [{date, source, changeDescription}]

  performanceFlags: [{sessionId, flag, description}]  // incomplete sessions, extreme RPE, etc.
}
```

### LLM Analysis

The structured report is sent to an LLM with a system prompt that establishes it as an expert powerlifting coach reviewing a complete training cycle.

The LLM is asked to return a structured `CycleReview` object:

```typescript
interface CycleReview {
  overallAssessment: string          // 2-3 sentence summary
  progressByLift: Record<Lift, {
    rating: 'excellent' | 'good' | 'stalled' | 'concerning'
    narrative: string
  }>
  auxiliaryInsights: {
    mostCorrelated: {exercise: string, lift: string, explanation: string}[]
    leastEffective: {exercise: string, lift: string, explanation: string}[]
    recommendedChanges: {
      add?: string[], remove?: string[], reorder?: {exercise: string, newPosition: number}[]
    }
  }
  volumeInsights: {
    musclesUnderRecovered: string[]   // consistently near MRV
    musclesUndertrained: string[]     // consistently below MEV
    frequencyRecommendation?: string
  }
  formulaSuggestions: {
    description: string
    rationale: string
    priority: 'high' | 'medium' | 'low'
  }[]
  structuralSuggestions: {           // for developer review — may require code changes
    description: string
    rationale: string
    developerNote: string
  }[]
  nextCycleRecommendations: string   // natural language summary of key changes to make
  menstrualInsights?: string         // female users — cycle-performance patterns observed
}
```

### User Experience

1. Cycle completes → app notifies: "Your cycle review is ready"
2. User opens cycle review screen (History tab → completed cycle → "Review")
3. Screen shows:
   - **Overall summary card** (2–3 sentences from LLM)
   - **Lift-by-lift progress**: Squat ↑ 7.5kg / Bench stalled / Deadlift ↑ 5kg — with LLM narrative per lift
   - **Aux exercise insights**: "Pause Squat correlated strongly with Squat improvement in Block 2. Romanian Deadlift showed no clear correlation with Deadlift 1RM — consider rotating it out next cycle."
   - **Volume heatmap**: week × muscle group, colour-coded by % of MRV reached
   - **Formula suggestions**: surfaced as actionable suggestions the user can accept/dismiss (same flow as the formula suggestion system in Settings → Formulas)
   - **Developer suggestions**: separate section, clearly labelled "Technical feedback" — surfaced in a developer view
   - **Next cycle recommendations**: natural language summary ("Focus on squat specificity in Block 3. Consider replacing Romanian Deadlift with Deficit Deadlift based on your hamstring response pattern.")

### Aux Exercise Correlation Detection

This is one of the highest-value outputs of the cycle review. The `auxiliaryWork` section of the report includes, for each aux exercise performed, the main lift performance in the 1–2 weeks following those sessions. The LLM can reason about this:

> "Pause Squat was performed primarily in Block 2 (weeks 5–8). In the 2 weeks following Pause Squat sessions, Squat Heavy RPE was on average 0.4 lower than target despite the same prescribed intensity — suggesting this exercise is improving this lifter's bottom-end squat strength. By contrast, Box Squat sessions showed no RPE improvement in subsequent Squat sessions. Recommend prioritising Pause Squat and demoting Box Squat in the rotation."

The LLM can reason about correlation patterns because it has the temporal structure of the data — which aux exercises preceded which performance changes. Formula rules cannot do this.

### Menstrual Cycle Pattern Detection (Female Users)

If cycle tracking is enabled, the report includes a menstrual phase overlay across the training weeks. The LLM can detect whether this specific lifter shows significant cycle-performance correlation:

> "Performance data shows a consistent pattern: sessions in your late luteal phase (days 24–28) show RPE 0.8–1.2 above target, with volume completion averaging 78%. This is more pronounced than typical. In the next cycle, consider scheduling deload in week 4 rather than week 10, aligning it with your typical late luteal window."

This is personalised insight that no generic formula can produce — it requires seeing the specific user's data across multiple cycles.

## Longitudinal Learning Across Cycles

The cycle review generates suggestions, but the real value compounds across multiple cycles. With 2–3 completed cycles, the LLM has enough data to make increasingly specific observations.

### How Data Accumulates

Each completed `CycleReport` is stored in Supabase (`cycle_reviews` table). When generating the next cycle review, the LLM receives:
- The current cycle's `CycleReport`
- Summaries of the previous 2–3 cycles (not full reports — summarised key metrics to stay within context limits)

This allows observations like:
- "This is the third consecutive cycle where Bench has stalled in Block 2 — this is likely a structural issue with the programming, not day-to-day variation"
- "Over three cycles, your estimated Squat 1RM has increased 8.5% while your bodyweight has stayed flat — WILKS score is improving meaningfully"
- "Romanian Deadlift has been in the aux pool for two cycles with no measurable correlation with Deadlift performance. Removing it is now a high-confidence recommendation."

### Per-User Formula Calibration

Over time, the cycle review generates enough evidence to calibrate MEV/MRV defaults for this specific lifter. A lifter who consistently performs at full volume with low RPE may have a higher personal MRV than the population default. The LLM can surface this:

> "Over the past two cycles, you have consistently reached 18–20 quad sets per week with no recovery degradation. Your effective MRV for quads appears to be higher than the default of 20. Consider updating your Volume Config to MRV = 24 for quads."

This is a specific formula suggestion that gets routed through the standard suggestion/approval flow.

## Developer Suggestions Channel

Some insights require code changes — new auxiliary exercises, changes to the Cube Method rotation, structural program modifications. These are surfaced in a separate channel, clearly labelled as requiring developer attention.

Examples:
- "This lifter might benefit from a 5-day/week frequency option — currently only 3 and 4 are supported"
- "Consider adding Romanian Deadlift variant (Deficit RDL) to the Deadlift auxiliary pool"
- "The 2-week Explosive block structure appears to be insufficient for this lifter to see explosive strength benefits — consider extending Block 1 Explosive sessions"

Developer suggestions are stored in a `developer_suggestions` table and viewable in a developer-only screen. They are never shown to the user as actionable items — only as information for the developer to evaluate.

## Future Enhancements

**Phase 2:**
- Cycle comparison view: side-by-side two cycles, showing what changed and what the effect was
- Export cycle review as PDF (shareable with a coach)

**Long-term:**
- Automatic aux exercise pool curation: based on 3+ cycles of correlation data, the system suggests specific exercises to add to or remove from the pool rather than just reordering
- Federated insights: with user consent, anonymised cycle data from multiple users informs better population-level defaults (opt-in only)

## References

- Related Design Docs: [training-engine-architecture.md](./training-engine-architecture.md), [formula-management.md](./formula-management.md), [program-generation.md](./program-generation.md), [achievements.md](./achievements.md), [sex-based-adaptations.md](./sex-based-adaptations.md)
- Specs: [engine-005-performance-adjuster.md](../specs/04-engine/engine-005-performance-adjuster.md), [engine-012-cycle-review-generator.md](../specs/04-engine/engine-012-cycle-review-generator.md), [engine-024-developer-suggestions.md](../specs/04-engine/engine-024-developer-suggestions.md), [engine-025-multi-cycle-context.md](../specs/04-engine/engine-025-multi-cycle-context.md), [mobile-014-cycle-review-screen.md](../specs/09-mobile/mobile-014-cycle-review-screen.md)
