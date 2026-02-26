# Feature: User Onboarding

**Status**: Planned

**Date**: 2026-02-22

## Overview

User Onboarding takes a new user from account creation to an activated, personalized training program in four screens. The goal is to eliminate all friction that isn't strictly necessary and get the user to their first workout as fast as possible.

## Problem Statement

Strength training apps typically fail at onboarding in one of two ways: they ask too much (extensive questionnaires, equipment setup, goals framework) and users abandon before seeing value, or they ask too little (one-size-fits-all programs) and users churn when the program doesn't fit their actual strength level.

**Pain points:**

- Requiring an exact 1RM creates a barrier for users who don't test singles regularly
- Long onboarding flows with many steps feel like commitment before the user has seen value
- Programs that ignore actual strength levels feel generic and untrustworthy
- Users don't understand why the app needs their max lifts — the purpose isn't explained

**Desired outcome:** A new user completes onboarding in under 5 minutes, with a program that is visibly personalized to their actual strength, and understands exactly what Parakeet will do for them before they commit.

## Design Principles

**Goal is implicit, not collected.** Parakeet's goal is always stronger lifts — higher numbers in Squat, Bench, and Deadlift. There is no goal selection screen because the app serves one purpose. Offering goals like "muscle building" or "general fitness" would be misleading.

**Onboarding completion requires program activation.** Users cannot explore the app before completing onboarding. The Today tab, session screen, and History tab are gated until a program is active. This ensures the first experience is the intended one: a structured workout.

## User Experience

### User Flows

**Primary Flow (4 screens):**

1. **Welcome screen**
   - Brief value proposition: "Cube Method programming. Personalized weights. No spreadsheets."
   - "Sign in with Google" button
   - No email/password — OAuth only for speed
   - Uses Supabase Auth via `supabase.auth.signInWithIdToken()`

2. **Enter Your Lifts screen** (`/onboarding/lift-maxes`)
   - Three sections: Squat, Bench Press, Deadlift
   - Each section has a toggle: "1RM" | "3RM"
   - Toggles are independent per lift (mixed entry is allowed, e.g. Squat 1RM + Bench 3RM + Deadlift 1RM)
   - Default is 3RM (more users have a recent 3RM than a true 1RM)
   - On 3RM mode: two fields — weight (kg) and reps (pre-filled to 3)
   - Under each section, a small grey line: "Estimated 1RM: — kg" (updates live as user types using Epley formula)
   - All weights displayed and entered in **kilograms only**
   - "Next" button becomes active when all three lifts have valid input

3. **Program Settings screen** (`/onboarding/program-settings`)
   - Duration: segmented control "10 / 12 / 14 weeks" (default: 10)
   - Days per week: picker, 3 or 4 (default: 3)
   - Start date: date picker (default: next Monday)
   - Biological sex: segmented control "Female / Male" — required; used for MEV/MRV defaults and WILKS calculation (see [sex-based-adaptations.md](./sex-based-adaptations.md))
   - Birth year: numeric input (YYYY) — required; used for age-aware context and estimates
   - If Female: optional prompt to enable menstrual cycle tracking (can also be done later in Settings)
   - "Preview My Program" CTA button

4. **Program Preview screen** (`/onboarding/review`)
   - Shows Week 1 sessions as horizontal scrollable cards
   - Each card: lift name, intensity type badge, auxiliary exercises for the block
   - Note: actual weights are NOT shown here (they are JIT-generated at workout time)
   - Shows session type labels: "Squat — Heavy Day", "Bench — Rep Day", etc.
   - Shows auxiliary exercise pair for each session: "Auxiliaries: Pause Squat + Box Squat"
   - "Activate Program" button → calls `createProgram()` → navigates to Today tab
   - "Edit Inputs" link → returns to lift-maxes screen

**Alternative Flow (skip maxes, estimated start):**

1. On the Enter Your Lifts screen, a "I don't know my maxes" link appears at the bottom
2. Tapping it clears all lift input fields and enables "estimated start" mode
3. User sees a banner: "Maxes left blank. We'll estimate your starting loads and calibrate from your logged sessions."
4. Program is generated without writing an onboarding lifter_maxes row; first-session JIT uses demographic estimates until real performance data is logged

**Returning User Flow:**

- If user has signed in before (Supabase user ID matches existing `profiles` row), skip all onboarding and navigate directly to the Today tab

**New Cycle Body Weight Capture:**

At the start of each new training cycle (including the first), the user enters their current body weight. This is used for WILKS score calculation and trend tracking across cycles. It is prompted:
- During initial onboarding (Program Settings screen)
- When activating a new program after completing a cycle (pre-fills from last recorded weight; user can update)

Body weight is stored per cycle — not per session — to track how strength-to-bodyweight ratio changes across training history.

### Visual Design Notes

- Welcome screen: full-bleed dark background, minimal text, large sign-in buttons
- Enter Your Lifts: clean white card per lift, toggle switch prominent, estimated 1RM updates with smooth number animation as the user types
- Program Settings: generous spacing, each control is large and tap-friendly; body weight field alongside duration/frequency
- Program Preview: session cards use the same design as the main app — the user is already seeing their real interface

## User Benefits

**Low barrier to entry**: Supporting 3RM input means users who have never tested a 1-rep max can still get a personalized program. The app does the math.

**Visible personalization**: The moment the user enters their lifts, they see real weights calculated for their specific numbers. This immediately demonstrates value.

**Commitment only after seeing output**: The preview screen lets users see their Week 1 before activating. They're not committing to a program they haven't seen.

**JIT transparency**: The preview explains that exact weights are calculated fresh each workout based on current data — users understand the system before they use it.

**Body weight tracked from day one**: WILKS score and strength-to-bodyweight trends are available from the first cycle.

### Settings → Profile

After onboarding, the user can view and edit their profile at **Settings → Profile**. This screen is the authoritative place for the app's understanding of who the athlete is. It surfaces:

- **Biological sex** — editable selector (Female / Male). Shows a brief note explaining what it affects ("used to set training defaults — you can override anything")
- **Age** — derived from date of birth (birth year); editable. Displayed as age, not raw DOB.
- **Body weight** — editable (kg). Used for Wilks calculation.
- **Wilks score** — read-only, auto-computed. Shows the user's current Wilks2020 score based on their estimated 1RMs and body weight. Requires both body weight and at least one recent max. If data is missing, shows "–" with a note.
- **Performance label** — a plain-English label derived from the Wilks score, giving context without exposing a raw number to users who find it opaque:

  | Wilks range | Label |
  |-------------|-------|
  | < 150 | Getting started |
  | 150–200 | Building a base |
  | 200–250 | Intermediate |
  | 250–300 | Solid competitor |
  | 300–350 | Advanced |
  | 350–400 | Elite amateur |
  | > 400 | Elite |

  These thresholds are the same for both sexes — Wilks normalises for bodyweight and sex, so a score of 300 means the same thing regardless.

The Wilks score and performance label are computed client-side using `computeWilks2020` from the training engine. No server-side computation.

## Future Enhancements

**Phase 2:**

- Onboarding for users returning from a long break: reduced max input flow with conservative starting weights
- MRV/MEV config step during onboarding (currently uses research defaults; user can edit later in Settings)

**Long-term:**

- Import max history from another app (CSV)
- In-app 1RM estimation protocol: guided warm-up ramp

## References

- Related Design Docs: [program-generation.md](./program-generation.md), [volume-management.md](./volume-management.md), [achievements.md](./achievements.md)
- Specs: [auth-001-supabase-auth-setup.md](../specs/auth-001-supabase-auth-setup.md), [programs-001-lifter-maxes-api.md](../specs/programs-001-lifter-maxes-api.md)
