# Spec: Weekly Body Review

**Status**: Done
**Domain**: Mobile App

## What This Covers

A post-session review screen triggered at the end of each program week. The lifter rates how each muscle group feels, sees the system's predicted fatigue, and reviews mismatches.

## Tasks

### Trigger Detection

**File: `apps/parakeet/src/modules/session/application/session.service.ts`**

After session completion, check if a weekly review should be prompted:

- [x] For scheduled programs:
  - Fetch the next session in the program. If `next.week_number > current.week_number` or no next session exists, this was the last session of the week.
  - Also trigger if there are no remaining sessions this week (all completed or skipped).

- [x] For unending programs:
  - Trigger every 3rd completed session (check `unending_session_counter % 3 === 0`).

- [x] For ad-hoc sessions:
  - Never trigger.

The trigger sets a flag that the completion screen reads to show the review prompt.

### Review Prompt Card

**File: `apps/parakeet/src/app/(tabs)/session/complete.tsx`**

When the weekly review trigger is set, show a card after the motivational message:

- [x] Header: "End of week — how does your body feel?"
- [x] Subtext: "Compare how you feel vs what the system predicted"
- [x] Button: "Review" → navigates to `session/weekly-review`
- [x] Dismiss: "Skip" → clears the trigger, no review stored

### Weekly Review Screen

**File: `apps/parakeet/src/app/(tabs)/session/weekly-review.tsx`**

New screen. No tab entry — only reachable from the completion screen prompt.

- [x] **Header**: "Week N Body Review" (or "Body Review" for unending programs)

- [x] **Body**: `ScrollView` with 9 muscle rows. Each row:
  - Muscle name (left)
  - 5 rating pills (1–5), pre-populated with predicted soreness from `computePredictedFatigue`
  - Below each row: thin horizontal bar showing `volumePct` (sets/MRV %), colored by volume status

- [x] **Data fetching**:
  ```typescript
  const { weekly, config } = useWeeklyVolume()
  const predicted = computePredictedFatigue(weekly, config)
  ```

- [x] **State**: `feltSoreness: Record<MuscleGroup, FatigueLevel>` initialized from predicted values. User adjusts by tapping pills.

- [x] **Notes**: Optional `TextInput` at bottom (placeholder: "Anything else to note?")

- [x] **Submit button**: "Save Review"
  - On submit:
    1. Call `detectMismatches(feltSoreness, predicted)`
    2. Store review via `saveWeeklyBodyReview(...)` (see [data-007-weekly-body-reviews.md](./spec-review-data.md))
    3. Navigate to mismatch summary (or show inline if no mismatches)

### Mismatch Summary

Shown after submit if mismatches exist:

- [x] List of muscles with ≥2-level mismatch
- [x] Each row shows: muscle name, felt level, predicted level, direction icon (↑ accumulating fatigue / ↓ recovering well)
- [x] When `accumulating_fatigue` mismatches are present: suggestion text "Consider reducing MRV for [muscle] in Settings > Volume Config"
- [x] "Done" button → returns to today screen

### Navigation

- [x] Add `weekly-review` route to the session stack in the appropriate `_layout.tsx`

### Cycle Report Integration

**File: `packages/training-engine/src/review/assemble-cycle-report.ts`**

When assembling the cycle report for LLM review, include weekly body review data:

- [x] Fetch `getWeeklyBodyReviews(userId, programId)` and add to the report context:
  - Number of reviews submitted
  - Muscles with recurring `accumulating_fatigue` mismatches (appearing in ≥2 reviews)
  - Average felt vs predicted delta per muscle

This gives the cycle review AI evidence like: "User consistently reported quad fatigue 2 levels above predicted across 3 of 4 weeks."

## Dependencies

- [engine-029-fatigue-predictor.md](./spec-fatigue-predictor.md) — `computePredictedFatigue` and `detectMismatches`
- [data-007-weekly-body-reviews.md](./spec-review-data.md) — `saveWeeklyBodyReview`, `getWeeklyBodyReviews`
- [mobile-012-volume-dashboard.md](./mobile-012-volume-dashboard.md) — `useWeeklyVolume` hook
- [engine-012-cycle-review-generator.md](../cycle-review/spec-generator.md) — cycle report assembly
- [mobile-029-motivational-message.md](./mobile-029-motivational-message.md) — completion screen card ordering
