# Feature: Disruption Management

**Status**: Planned

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

| Severity | Action |
|----------|--------|
| Minor | Weight reduced 20%, maintain movement pattern — applied automatically |
| Moderate | Weight reduced 40%, consider substitution — requires user confirmation |
| Major | Session skipped, note added to program — requires user confirmation |

8. Active disruption appears as a banner on the Today screen until resolved

**Unprogrammed Event Flow:**

1. User selects "Unprogrammed Event" as the disruption type
2. User enters the event name (e.g., "Hyrox competition")
3. User enters the event date(s)
4. App asks: "What's sore or hurting after this event?" — user can select from a muscle group list (same as soreness check-in) and rate severity
5. The reported soreness is injected into the soreness model the same as a pre-session soreness check-in, affecting the next JIT generation for any overlapping sessions
6. The event is logged in disruption history as an unprogrammed event; any sessions that were missed are marked as disruption-skipped

**Deload Overlap:**

If a disruption overlaps with a scheduled deload week, the deload takes precedence — **no additional adjustment is applied on top of the deload**. The deload itself already provides recovery. The disruption is still logged (for history purposes), but the session weights are left at deload levels.

**Alternative Flows:**

- Reporting mid-session: user taps "Report Issue" from the active session screen; affected lift weight can be reduced immediately for the current session
- Reporting travel affecting multiple weeks: set end date to end of travel; all sessions in that range are marked with a travel note and volume is reduced
- Reporting illness that clears up early: tap "Mark as Resolved" from the disruption detail screen; program returns to normal schedule from that date
- Reporting "bad day" fatigue: severity = Minor → auto-applied at -10% weight; if severe, set to Moderate and confirm a session skip

**Resolution Flow:**

1. User taps the active disruption banner on the Today screen
2. User taps "Mark as Resolved" (or sets a resolved date if it ended in the past)
3. App confirms: "Great — returning to normal schedule from [date]"
4. Banner disappears; upcoming sessions revert to original planned weights

### Visual Design Notes

- Issue type selector: grid of cards with icons (bandage for injury, thermometer for illness, airplane for travel, flame for fatigue, dumbbell-slash for equipment, trophy for event, etc.)
- Severity selector: three clearly differentiated buttons with color coding (yellow/orange/red)
- Date range: start date picker (defaults to today) + optional end date picker
- Lift selector: tap-to-toggle chips for each lift, plus "All Lifts" shortcut
- Adjustment preview: two-column card per affected session — left side "Current", right side "Proposed" with weight and any substitution notes (shown for Moderate/Major; auto-applied for Minor)
- Active disruption banner: amber top-of-screen strip with issue type icon, severity, and "View Details" tap

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
