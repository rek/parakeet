# Spec: Edge Case Report Screen

**Status**: Planned
**Domain**: Mobile App

## What This Covers

The screen where users report injuries, illness, travel, or other disruptions and review/confirm proposed session adjustments.

## Tasks

**`apps/mobile/app/edge-case/report.tsx`:**
- Accessible from: Today screen (floating action / banner tap), Settings → "Report Issue"
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
- "Review Adjustments" → call `POST /v1/edge-cases`, show loading

**Adjustment Review screen (rendered after API response):**
- List of affected sessions with before/after comparison cards
- Each card: session date, lift, planned weight (strikethrough) → adjusted weight; or "Session Skipped" label
- "Apply All Adjustments" primary button → call `POST /v1/edge-cases/:caseId/apply-adjustment`
- "Skip — Keep Original Plan" secondary button → navigate back without applying

**Active edge case list (accessible from Settings):**
- List of active edge cases with resolve button per case

## Dependencies

- [edge-cases-001-report-api.md](./edge-cases-001-report-api.md)
- [edge-cases-002-apply-adjustment-api.md](./edge-cases-002-apply-adjustment-api.md)
- [mobile-001-expo-router-layout.md](./mobile-001-expo-router-layout.md)
