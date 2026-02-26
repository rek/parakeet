# Spec: Onboarding Screens

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

The three onboarding screens: lift max input, program settings, and program preview.

## Tasks

**`apps/parakeet/app/(auth)/onboarding/lift-maxes.tsx`:**
- Three sections: Squat, Bench Press, Deadlift
- Per section:
  - Toggle: "1RM" | "3RM" (default 3RM)
  - Toggle is independent per lift (mixed modes are supported in one submission)
  - On 1RM: single weight input field
  - On 3RM: weight input + reps input (default 3, range 2-10)
  - Below input: "Est. 1RM: — kg" — updates in real-time using Epley formula (computed client-side from the same formula as the engine)
- Validation: all three lifts must be valid before "Next", unless user explicitly selects estimated-start mode
- "I don't know my maxes" link:
  - clears all lift inputs
  - enables estimated-start mode
  - shows warning banner
  - passes `estimatedStart=1` to program settings

**`apps/parakeet/app/(auth)/onboarding/program-settings.tsx`:**
- Duration selector: 3-button segmented control (10 weeks | 12 weeks | 14 weeks), default 10
- Days per week: segmented control (3 or 4), default 3
- Start date: `DateTimePicker` (expo-datetime-picker), default next Monday
- Gender (required): Female / Male
- Birth year (required): 4 digits
- "Generate My Program" primary button
- On tap:
  - always updates profile demographics
  - if not estimated-start mode: calls `submitMaxes()` then `createProgram()`
  - if estimated-start mode: skips `submitMaxes()` and calls `createProgram()` directly
  - shows loading state and validation hints

**`apps/parakeet/app/(auth)/onboarding/review.tsx`:**
- Horizontal scroll of Week 1 session cards (3 cards for 3-day program)
- Each card: lift name, intensity type badge (Heavy/Explosive/Rep), weight × sets × reps, planned date
- "Looks good — Start Training" button → navigate to `/(tabs)/today`
- "Edit Inputs" link → navigate back to lift-maxes screen

**State management:**
- Onboarding state held in local component state (not persisted — user must complete onboarding in one session or start over)
- After program activation: navigate and clear onboarding state

## Dependencies

- [parakeet-002-auth-flow.md](./parakeet-002-auth-flow.md)
- [programs-002-program-generation-api.md](../06-programs/programs-002-program-generation-api.md)
