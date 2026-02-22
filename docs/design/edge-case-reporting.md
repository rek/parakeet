# Feature: Edge Case Reporting

**Status**: Planned

**Date**: 2026-02-22

## Overview

Edge Case Reporting lets users communicate real-world disruptions — injury, illness, travel, extreme fatigue, equipment unavailability — so Parakeet can respond with appropriate program adjustments rather than letting those deviations silently undermine the training cycle.

## Problem Statement

Life constantly interrupts training. Without a structured way to log and respond to disruptions, users face a false choice: push through when they shouldn't (injury risk) or abandon the program after missing sessions (lost momentum and wasted planning).

**Pain points:**
- Missing sessions without logging them causes the program to desync from reality
- Pushing through an injury without reducing load risks turning a minor issue into a major setback
- Generic training apps have no concept of "this week was different because I was sick"
- Users lose trust in a program that doesn't acknowledge what happened and adapt accordingly

**Desired outcome:** A simple reporting flow that captures what went wrong, gives the user control over how the program adapts, and keeps the training log accurate even during disrupted periods.

## User Experience

### User Flows

**Primary Flow (reporting an injury before training):**

1. User taps "Report Issue" from the Today screen (or Settings)
2. User selects issue type: Injury / Illness / Travel / Fatigue / Equipment Unavailable / Other
3. User selects severity: Minor / Moderate / Major
4. User sets the affected date range (start: today, end: optional — defaults to "ongoing")
5. User selects which lifts are affected (multi-select: Squat / Bench / Deadlift / All)
6. User adds an optional description ("Left knee pain, no pain on bench or deadlift")
7. App shows proposed adjustments for affected upcoming sessions:
   - Minor injury: weight reduced 20%, maintain movement
   - Moderate injury: weight reduced 40%, consider substitution
   - Major injury: session skipped, note added to program
8. User reviews the side-by-side before/after for each affected session
9. User taps "Apply Adjustments" to confirm, or "Dismiss" to keep original plan
10. Active edge case appears as a banner on the Today screen until resolved

**Alternative Flows:**

- Reporting mid-session: user taps "Report Issue" from the active session screen; affected lift weight can be reduced immediately for the current session
- Reporting travel affecting multiple weeks: set end date to end of travel; all sessions in that range are marked with a travel note and volume is reduced
- Reporting illness that clears up early: tap "Mark as Resolved" from the edge case detail screen; program returns to normal schedule from that date
- Reporting "bad day" fatigue: severity = Minor, type = Fatigue; suggestion is to proceed at -10% weight or skip if severe

**Resolution Flow:**

1. User taps the active edge case banner on the Today screen
2. User taps "Mark as Resolved" (or sets a resolved date if it ended in the past)
3. App confirms: "Great — returning to normal schedule from [date]"
4. Banner disappears; upcoming sessions revert to original planned weights

### Visual Design Notes

- Issue type selector: grid of cards with icons (bandage for injury, thermometer for illness, airplane for travel, etc.)
- Severity selector: three clearly differentiated buttons with color coding (yellow/orange/red)
- Date range: start date picker (defaults to today) + optional end date picker
- Lift selector: tap-to-toggle chips for each lift, plus "All Lifts" shortcut
- Adjustment preview: two-column card per affected session — left side "Current", right side "Proposed" with weight and any substitution notes
- Active edge case banner: amber top-of-screen strip with issue type icon, severity, and "View Details" tap

## User Benefits

**Program stays accurate**: Even during disrupted weeks, the log reflects what actually happened and why — no phantom "planned" sessions cluttering the history.

**Safe load management**: The system's suggested reductions follow conservative injury management principles; users don't have to guess how much to reduce.

**Pattern awareness over time**: Multiple edge case reports for the same lift (e.g., recurring knee pain) are visible in history, helping the user and eventually the system detect patterns before they become serious.

## Implementation Status

### Planned

- Issue type and severity selection
- Affected date range and lift selection
- Automatic adjustment suggestions based on type + severity
- User confirmation before adjustments are applied
- Active edge case banner on Today screen
- Resolution flow
- Edge case history list

## Future Enhancements

**Phase 2:**
- Injury recurrence detection (same lift, same type, within 8 weeks) → prompt to review loading
- Return-to-training protocol suggestions after major injuries (gradual percentage ramp-up over 3 weeks)

**Long-term:**
- Correlation with recovery data: if HRV is consistently low on days user reports fatigue edge cases, surface this pattern
- Coach visibility: coaches can see edge cases reported by athletes they manage

## Open Questions

- [ ] Should the system automatically reduce load without user confirmation for minor edge cases, or always require explicit approval?
- [ ] How do we handle an edge case that overlaps with a deload week — no adjustment needed?

## References

- Related Design Docs: [performance-logging.md](./performance-logging.md), [formula-management.md](./formula-management.md)
