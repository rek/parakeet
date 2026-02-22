# Feature: User Onboarding

**Status**: Planned

**Date**: 2026-02-22

## Overview

User Onboarding takes a new user from account creation to an activated, personalized training program in three screens. The goal is to eliminate all friction that isn't strictly necessary and get the user to their first workout as fast as possible.

## Problem Statement

Strength training apps typically fail at onboarding in one of two ways: they ask too much (extensive questionnaires, equipment setup, goals framework) and users abandon before seeing value, or they ask too little (one-size-fits-all programs) and users churn when the program doesn't fit their actual strength level.

**Pain points:**
- Requiring an exact 1RM creates a barrier for users who don't test singles regularly
- Long onboarding flows with many steps feel like commitment before the user has seen value
- Programs that ignore actual strength levels feel generic and untrustworthy
- Users don't understand why the app needs their max lifts — the purpose isn't explained

**Desired outcome:** A new user completes onboarding in under 5 minutes, with a program that is visibly personalized to their actual strength, and understands exactly what Parakeet will do for them before they commit.

## User Experience

### User Flows

**Primary Flow (3 screens, 1RM input):**

1. **Welcome screen**
   - Brief value proposition: "Cube Method programming. Personalized weights. No spreadsheets."
   - "Sign in with Google" and "Sign in with Apple" buttons
   - No email/password — OAuth only for speed

2. **Enter Your Lifts screen**
   - Three sections: Squat, Bench Press, Deadlift
   - Each section has a toggle: "1RM" | "3RM"
   - Default is 3RM (more users have a recent 3RM than a true 1RM)
   - On 3RM mode: two fields — weight and reps (pre-filled to 3)
   - Under each section, a small grey line: "Estimated 1RM: — lbs" (updates live as user types)
   - lb/kg toggle at the top right (persisted to user preferences)
   - "Next" button becomes active when all three lifts have valid input

3. **Program Settings screen**
   - Duration: segmented control showing "8 weeks / 10 weeks / 12 weeks" (default: 10)
   - Days per week: stepper control, 3–5 (default: 3)
   - Start date: date picker (default: next Monday)
   - "Generate My Program" large CTA button

4. **Program Preview screen** (after generation, before activation)
   - Shows Week 1 sessions as horizontal scrollable cards
   - Each card: lift name, intensity type badge, weight × sets × reps
   - "Looks good — Activate" button and "Edit Inputs" link (returns to screen 2)
   - Activating navigates to the Today tab

**Alternative Flow (skip maxes, use defaults):**

1. On the Enter Your Lifts screen, a "I don't know my maxes" link appears at the bottom
2. Tapping it sets placeholder maxes (Squat 135, Bench 95, Deadlift 185 lbs — typical beginner starting point)
3. User is shown a banner: "Using estimated starting weights. Update your maxes after your first session for a personalized program."
4. Program is generated and activated normally
5. After the first session is logged, the app prompts the user to enter their actual maxes

**Returning User Flow:**

- If user has signed in before (Firebase UID matches existing user), skip all onboarding and navigate directly to the Today tab

### Visual Design Notes

- Welcome screen: full-bleed dark background, minimal text, large sign-in buttons — no distractions
- Enter Your Lifts: clean white card per lift, toggle switch prominent, estimated 1RM updates with smooth number animation as the user types
- Program Settings: generous spacing, each control is large and tap-friendly
- Program Preview: the session cards use the same design as they will in the main app — the user is already seeing their real interface

## User Benefits

**Low barrier to entry**: Supporting 3RM input means users who have never tested a 1-rep max can still get a personalized program. The app does the math.

**Visible personalization**: The moment the user enters their lifts, they see real weights calculated for their specific numbers — not "X% of your max" but "252.5 lbs". This immediately demonstrates value.

**Commitment only after seeing output**: The preview screen lets users see their Week 1 before activating. They're not committing to a program they haven't seen.

## Implementation Status

### Planned

- Google and Apple OAuth sign-in
- 1RM / 3RM toggle per lift with live Epley estimation
- lb / kg preference
- Program duration and frequency selection
- Start date picker
- Program preview before activation
- "Don't know maxes" fallback path
- Returning user fast-path (skip onboarding)

## Future Enhancements

**Phase 2:**
- Onboarding for users returning from a long break: reduced max input flow with conservative starting weights
- Coach-assigned program: coach shares a link; athlete signs up and the program is pre-loaded

**Long-term:**
- Import max history from another app (CSV or API integration)
- In-app 1RM estimation protocol: guided warm-up ramp to estimate max without actually testing it

## Open Questions

- [ ] Should we collect a goal (competition date, general fitness, muscle building) during onboarding to influence program selection in future phases?
- [ ] What is the minimum viable "onboarding complete" state — must the user activate a program, or can they explore the app first?

## References

- Related Design Docs: [program-generation.md](./program-generation.md)
