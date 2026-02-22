# Feature: Program Generation

**Status**: Planned

**Date**: 2026-02-22

## Overview

Parakeet generates a complete, personalized powerlifting program from three inputs: 1-rep max (or 3-rep max) values for Squat, Bench, and Deadlift, a desired program length, and training frequency. The program follows Brandon Lilly's Cube Method periodization structure, with all loading weights calculated automatically.

## Problem Statement

Intermediate powerlifters understand periodization concepts but struggle to translate them into precise week-by-week loading schemes. Manual spreadsheet programming is error-prone, time-consuming, and doesn't adapt when circumstances change.

**Pain points:**
- Calculating exact weights from percentages every week is tedious and easy to get wrong
- Generic programs don't use the lifter's actual strength levels
- Changing one input (e.g., updating a max) requires recalculating the entire program
- No easy way to see the full program structure at a glance before committing to it

**Desired outcome:** A lifter enters three numbers and receives a complete, ready-to-follow program — no spreadsheets, no manual calculations.

## User Experience

### User Flows

**Primary Flow (user has 1RM data):**

1. User taps "Create Program" from the home screen
2. User enters 1-rep max for Squat, Bench Press, and Deadlift
3. User selects program length (default 10 weeks) and training days per week (default 3)
4. User taps "Generate Program"
5. App displays a preview of Week 1 with all sessions and weights calculated
6. User reviews and taps "Activate Program"
7. App navigates to the "Today" screen showing the first upcoming session

**Alternative Flow (user has 3RM data):**

1. Same entry point, but user switches toggle from "1RM" to "3RM" on each lift
2. User enters the weight and rep count they achieved (e.g., 285 lbs × 3)
3. App shows the estimated 1RM in real-time as the user types (using the Epley formula)
4. Flow continues as above from step 3
5. The estimated 1RM and the raw 3RM input are both preserved for the program record

**Regeneration Flow:**

1. User updates their maxes after completing a training cycle
2. User taps "Regenerate" from the active program screen
3. App generates a new program version using updated maxes and current formula config
4. Previous program version is archived (full history preserved)
5. User reviews the new Week 1 and activates

**Alternative Flows / Edge Cases:**

- User wants to start mid-week: they choose a start date; the first session is placed on that date and remaining sessions fill the week appropriately
- User wants more or fewer training days: supported (3–5 days per week); lift distribution adjusts automatically
- User has an existing active program: app warns before creating a new one and offers to archive the current

### Visual Design Notes

- Each session card displays: lift name, intensity type (Heavy / Explosive / Rep), percentage, sets × reps, and calculated weight in lbs (or kg based on preference)
- Block color coding: Block 1 = blue, Block 2 = orange, Block 3 = red, Deload = grey
- Week 1 preview is shown as a horizontal scroll of 3 session cards before activation
- The full program view (10 weeks) uses a compact grid with expandable week rows

## User Benefits

**Zero calculation required**: The app handles all percentage-to-weight conversions, rounding to the nearest 2.5 lbs, and progressive loading increases across blocks.

**Transparent methodology**: Every session card shows the formula applied (e.g., "Block 2 Heavy: 85% × 2×3"), so the user understands exactly how their program was built and can verify it.

**Full history preserved**: Each program generation creates a new versioned record. Users can always look back at a previous program, compare it to the current one, and understand how their programming has evolved.

## Implementation Status

### Planned

- 1RM and 3RM input with live Epley estimation
- Full 10-week Cube Method program generation
- Program preview before activation
- Program versioning and history
- lb/kg preference support
- Regeneration with updated maxes

## Future Enhancements

**Phase 2:**
- Auto-regeneration prompt after each completed block with suggested max increases
- Competition date targeting (auto-calculate program length to peak on a specific date)

**Long-term:**
- Support for alternative programming systems (5/3/1, GZCLP, Juggernaut)
- Coach-assigned program import
- Multi-athlete program management for coaches

## Open Questions

- [ ] Should the app support programs shorter than 10 weeks (e.g., a 6-week mini-cycle)?
- [ ] What should happen if the user doesn't complete all sessions in a week — does the next week start anyway, or does it wait?

## References

- Related Design Docs: [user-onboarding.md](./user-onboarding.md), [formula-management.md](./formula-management.md)
- External: Brandon Lilly's Cube Method (10-week concurrent periodization structure)
