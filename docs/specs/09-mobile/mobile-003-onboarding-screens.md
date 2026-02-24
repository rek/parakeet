# Spec: Onboarding Screens

**Status**: Implemented
**Domain**: Mobile App

## What This Covers

The three onboarding screens: lift max input, program settings, and program preview.

## Tasks

**`apps/mobile/app/(auth)/onboarding/lift-maxes.tsx`:**
- Three sections: Squat, Bench Press, Deadlift
- Per section:
  - Toggle: "1RM" | "3RM" (default 3RM)
  - On 1RM: single weight input field
  - On 3RM: weight input + reps input (default 3, range 2-10)
  - Below input: "Est. 1RM: — kg" — updates in real-time using Epley formula (computed client-side from the same formula as the engine)
- Validation: all three lifts must have valid input before "Next" is enabled
- "I don't know my maxes" link → sets defaults and shows warning banner

**`apps/mobile/app/(auth)/onboarding/program-settings.tsx`:**
- Duration selector: 3-button segmented control (8 weeks | 10 weeks | 12 weeks), default 10
- Days per week: stepper (3, 4, or 5), default 3
- Start date: `DateTimePicker` (expo-datetime-picker), default next Monday
- "Generate My Program" primary button
- On tap: call `submitMaxes()` from `apps/mobile/lib/lifter-maxes.ts`, then `createProgram()` from `apps/mobile/lib/programs.ts`; show loading state

**`apps/mobile/app/(auth)/onboarding/review.tsx`:**
- Horizontal scroll of Week 1 session cards (3 cards for 3-day program)
- Each card: lift name, intensity type badge (Heavy/Explosive/Rep), weight × sets × reps, planned date
- "Looks good — Start Training" button → navigate to `/(tabs)/today`
- "Edit Inputs" link → navigate back to lift-maxes screen

**State management:**
- Onboarding state held in local component state (not persisted — user must complete onboarding in one session or start over)
- After program activation: navigate and clear onboarding state

## Dependencies

- [mobile-002-auth-flow.md](./mobile-002-auth-flow.md)
- [programs-002-program-generation-api.md](../06-programs/programs-002-program-generation-api.md)
