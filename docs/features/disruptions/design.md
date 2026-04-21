# Feature: Disruption Management

**Status**: Implemented

**Date**: 2026-02-22

## Overview

Disruption Management lets users communicate real-world disruptions — injury, illness, travel, extreme fatigue, equipment unavailability, or unprogrammed athletic events — so Parakeet can respond with appropriate program adjustments rather than letting those deviations silently undermine the training cycle.

## Problem Statement

Life constantly interrupts training. Without a structured way to log and respond to disruptions, users face a false choice: push through when they shouldn't (injury risk) or abandon the program after missing sessions (lost momentum and wasted planning).

**Pain points:**
- Missing sessions without logging them causes the program to desync from reality
- Pushing through an injury without reducing load risks turning a minor issue into a major setback
- Generic training apps have no concept of "this week was different because I was sick"
- Users lose trust in a program that doesn't acknowledge what happened and adapt accordingly
- Unprogrammed athletic events (e.g., a Hyrox competition) create real fatigue and soreness that the system can't see without being told

**Desired outcome:** A simple reporting flow that captures what went wrong, gives the user control over how the program adapts, and keeps the training log accurate even during disrupted periods.

## Disruption Types

| Type | Description |
|------|-------------|
| Injury | Pain or dysfunction in a specific area affecting one or more lifts |
| Illness | General illness reducing overall training capacity |
| Travel | Access to equipment is limited or unavailable |
| Fatigue | Unusually high fatigue (non-injury) — bad sleep, high stress, etc. |
| Equipment Unavailable | Specific equipment (e.g., squat rack) not accessible |
| Unprogrammed Event | A demanding athletic event outside the normal program (competition, race, team sport) |
| Other | Freeform — user describes the situation |

## User Experience

### User Flows

**Primary Flow (reporting an injury before training):**

1. User taps "Report Issue" from the Today screen (or Settings)
2. User selects issue type (see table above)
3. User selects severity: Minor / Moderate / Major
4. User sets the affected date range (start: today, end: optional — defaults to "ongoing")
5. User selects which lifts are affected (multi-select: Squat / Bench / Deadlift / All)
6. User adds an optional description ("Left knee pain, no pain on bench or deadlift")
7. App shows proposed adjustments:

**Automatic vs. Confirmed Adjustments:**

- **Minor severity**: The system automatically applies the adjustment without requiring user confirmation. The adjustment is shown in the session screen ("Knee issue — Squat weight auto-reduced 20%"), but no approval step is required. The assumption is that if the system judges the user is unable to lift at full intensity, it reduces the load.
- **Moderate severity**: User sees proposed adjustments and must confirm before they are applied
- **Major severity**: User sees proposed adjustments (session skip + note) and must confirm

**Adjustment rules by severity:**

See [domain/adjustments.md](../domain/adjustments.md#disruption-modifiers) for the complete disruption type x severity modifier table.

> **Fatigue type note:** For the Fatigue disruption type, the engine always applies `weight_reduced` (not `reps_reduced`), regardless of severity. Minor fatigue = 10% weight reduction (lighter than the generic 20% minor rule); moderate/major follow the standard table above.

8. Active disruption appears as a chip in the Today screen chip row until resolved or until `affected_date_end` passes (whichever comes first). Ongoing disruptions (no end date) remain until manually resolved.

**Unprogrammed Event Flow** *(partially implemented — spec disruptions-005)*:

1. User selects "Unprogrammed Event" as the disruption type
2. Severity is fixed at "major" automatically (full deload treatment for affected sessions)
3. User enters the event name (prepended to description)
4. User selects affected date range
5. App shows post-event soreness section: 6 muscle groups (Quads/Hamstrings/Glutes/Lower Back/Upper Back/Chest), each with None/Mild/Sore/Very Sore chips
6. On submit: soreness is injected into `soreness_checkins` (same table as pre-session check-in); next JIT generation picks it up automatically
7. No explicit weight adjustments are generated — soreness injection IS the adjustment

**Deload Overlap** *(known gap — not yet implemented)*:

If a disruption overlaps with a scheduled deload week, the intended behaviour is that the deload takes precedence and is not further modified by disruption, soreness, readiness, or cycle-phase adjustments. Currently, `applyDisruptionAdjustment` (Step 5) and `applySorenessAdjustment` (Step 3) and `applyReadinessAdjustment` have no deload guard. Combined reductions on an already light deload session can produce near-zero loading, which is counter to the recovery intent of the deload.

Required guards (tracked in jit-pipeline specs):
- `applySorenessAdjustment`: early return if `intensityType === 'deload'`
- `applyReadinessAdjustment`: early return if `intensityType === 'deload'`
- `applyCyclePhaseAdjustment`: early return if `intensityType === 'deload'`

Note: `applyDisruptionAdjustment` compounding on deload is documented as intentional conservative behaviour (see jit-pipeline/spec-generator.md Step 5). The soreness/readiness/cycle-phase guards are the priority fix.

**Mid-session Reporting** *(future enhancement — not planned for current sprint)*:

Reporting a disruption from within an active session (e.g., to immediately reduce the current session's weight) has no entry point built yet.

**Alternative Flows:**

- Reporting travel affecting multiple weeks: set end date to end of travel; all sessions in that range are marked with a travel note and volume is reduced
- Reporting illness that clears up early: tap the illness chip on the Today screen → bottom sheet → "Mark Resolved"; upcoming sessions revert to normal loading on next open
- Reporting "bad day" fatigue: type = Fatigue, severity = Minor → auto-applied at -10% weight (fatigue-specific minor rule); if more severe, set to Moderate and confirm a session skip

**Edit End Date Flow:**

1. User taps a disruption chip in the Today screen chip row
2. Bottom sheet modal shows type, severity, description, affected lifts, and "Until" row
3. User taps the "Until" row → inline date picker opens
4. User selects a new end date → "Save End Date" button appears
5. On save: `affected_date_end` is updated. The chip will disappear automatically once this date passes, or when the user taps "Mark Resolved" — whichever comes first.

This flow is useful for ongoing disruptions that have a known recovery date, or to shorten the affected range when recovering earlier than expected.

**Resolution Flow:**

1. User taps a disruption chip in the Today screen chip row
2. Bottom sheet modal shows type, severity, description, affected lifts, end date
3. User taps "Mark Resolved" → Alert confirms → disruption status → resolved; affected sessions have `planned_sets` cleared for JIT re-generation
4. Chip disappears from row; upcoming sessions regenerate at normal loading on next open

### Visual Design Notes

- Issue type selector: grid of cards with icons (bandage for injury, thermometer for illness, airplane for travel, flame for fatigue, dumbbell-slash for equipment, trophy for event, etc.)
- Severity selector: three clearly differentiated buttons with color coding (yellow/orange/red)
- Date range: start date picker (defaults to today) + end date picker (defaults to today; hidden when "ongoing" is toggled)
- Lift selector: tap-to-toggle chips for each lift, plus "All Lifts" shortcut
- Adjustment preview: two-column card per affected session — left side "Current", right side "Proposed" with weight and any substitution notes (shown for Moderate/Major; auto-applied for Minor)
- Active disruption chips: horizontal scrollable pill row on Today screen, one chip per active disruption, shows `⚡ {type}` with severity-colored border/dot (minor=amber, moderate=orange, major=red); tap → bottom sheet modal with details, an editable end date (tap "Until" row → inline date picker → "Save End Date"), and "Mark Resolved"; visible on rest days, workout-done days, and active session days

## User Benefits

**Program stays accurate**: Even during disrupted weeks, the log reflects what actually happened and why — no phantom "planned" sessions cluttering the history.

**Safe load management**: Minor disruptions are handled automatically without adding friction to the workout flow. Moderate and major disruptions surface for explicit confirmation so the user stays in control.

**Unprogrammed events acknowledged**: A Hyrox race or team sport competition is real physiological work. Logging it lets the system account for the resulting soreness and fatigue without the user having to manually fiddle with weights.

**Deload protection**: Deload weeks are not overridden by disruption logic — the planned recovery period is preserved.

**Pattern awareness over time**: Multiple disruption reports for the same lift (e.g., recurring knee pain) are visible in history, helping the user and eventually the system detect patterns before they become serious.

## Future Enhancements

**Phase 2:**
- Disruption recurrence detection (same lift, same type, within 8 weeks) → prompt to review loading
- Return-to-training protocol suggestions after major injuries (gradual percentage ramp-up over 3 weeks)

**Long-term:**
- Correlation with recovery data: if HRV is consistently low on days user reports fatigue disruptions, surface this pattern
- Coach visibility: coaches can see disruptions reported by athletes they manage

## References

- Related Design Docs: [performance-logging.md](./performance-logging.md), [formula-management.md](./formula-management.md)
- Spec: [disruptions-001-report.md](../specs/08-disruptions/disruptions-001-report.md)
- Spec: [disruptions-002-apply-adjustment.md](../specs/08-disruptions/disruptions-002-apply-adjustment.md)
- Spec: [disruptions-003-resolution.md](../specs/08-disruptions/disruptions-003-resolution.md)
- Spec: [disruptions-004-adjuster-engine.md](../specs/08-disruptions/disruptions-004-adjuster-engine.md)
- Spec: [disruptions-005-unprogrammed-event.md](../specs/08-disruptions/disruptions-005-unprogrammed-event.md)

## Domain References

- [domain/adjustments.md](../domain/adjustments.md) — disruption modifier table (type x severity)
- [domain/athlete-signals.md](../domain/athlete-signals.md) — disruption signal definitions

