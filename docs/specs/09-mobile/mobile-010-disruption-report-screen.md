# Spec: Disruption Report Screen

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

The screen where users report injuries, illness, travel, or other disruptions and review/confirm proposed session adjustments.

## Tasks

**`apps/parakeet/app/disruption-report/report.tsx`:**

- Accessible from: Today screen — "Something's off? Report an issue" link below workout/rest card
- Multi-step form within a single scrollable screen:

**Step 1 — Issue Type:**
- Grid of type cards with icons and labels:
  - Injury (bandage icon), Illness (thermometer), Travel (airplane), Fatigue (battery low), Equipment Unavailable (dumbbell), Other
- Single select — tap to select, tapping again deselects

**Step 2 — Severity:**
- Three buttons with color coding:
  - Minor (yellow) — "Can train with modification"
  - Moderate (orange) — "Significantly impaired"
  - Major (red) — "Cannot train"

**Step 3 — Date Range:**
- Start date picker (defaults to today)
- End date picker (optional; "Ongoing" toggle)

**Step 4 — Affected Lifts:**
- Multi-select chips: Squat | Bench | Deadlift
- "All Lifts" toggle shortcut

**Step 5 — Description:**
- Optional text field: "Tell us more (optional)"
- Placeholder: "e.g., Left knee pain on descent, no pain on bench or deadlift"

**Submit button:**
- "Review Adjustments" → call `reportDisruption(userId, input)` from `apps/parakeet/lib/disruptions.ts`, show loading

**Adjustment Review screen (rendered after API response):**
- List of affected sessions with before/after comparison cards
- Each card: session date, lift, planned weight (strikethrough) → adjusted weight; or "Session Skipped" label
- "Apply All Adjustments" primary button → call `applyDisruptionAdjustment(disruptionId, userId)` from `apps/parakeet/lib/disruptions.ts`
- "Skip — Keep Original Plan" secondary button → navigate back without applying

**Active disruption banners (Today screen WorkoutCard):**

- Tappable banners above the workout card; tap opens an Alert with "Mark as resolved" option

## Dependencies

- [disruptions-001-report.md](../08-disruptions/disruptions-001-report.md)
- [disruptions-002-apply-adjustment.md](../08-disruptions/disruptions-002-apply-adjustment.md)
- [parakeet-001-expo-router-layout.md](./parakeet-001-expo-router-layout.md)
