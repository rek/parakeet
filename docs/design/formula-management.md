# Feature: Formula Management

**Status**: Planned

**Date**: 2026-02-22

## Overview

Formula Management gives users full visibility into the Cube Method loading parameters that drive their program, the ability to override any parameter, and a structured way to review AI-generated adjustment suggestions — all with a complete version history and easy revert capability.

## Problem Statement

Most training apps treat their programming logic as a black box. Advanced lifters often want to deviate from textbook parameters based on individual response (e.g., they know they recover faster from explosive work, or they need heavier rep day weights). There is no standard tool that exposes these parameters transparently and tracks changes over time.

**Pain points:**
- Users can't see why their session calls for a specific weight — the calculation is hidden
- Modifying a program parameter usually means starting from scratch with a different template
- AI-generated suggestions that silently modify programs erode trust
- There is no audit trail of what changed, when, and why

**Desired outcome:** The user can see exactly how every weight is calculated, change any parameter with full understanding of the impact, and review AI suggestions with clear rationale before accepting or dismissing them.

## User Experience

### User Flows

**Primary Flow (viewing current formula config):**

1. User navigates to Settings → Formulas
2. App shows the current active formula config, organized by block
3. Each block section shows Heavy / Explosive / Rep parameters in plain language:
   - "Block 1 Heavy: 80% of max — 2 sets of 5 reps — RPE target 8.5"
4. A small "Sample" card below each row shows what a session at those parameters would look like for the user's current Squat max

**Editing Flow:**

1. User taps any parameter row (e.g., Block 1 Heavy percentage)
2. Inline numeric edit field appears (or a modal with a slider for percentages)
3. As the user adjusts the value, the Sample card updates live
4. User taps Save → app creates a new formula config version (the previous one is preserved)
5. User is prompted: "Apply to current program? This will regenerate your upcoming sessions."
6. If user confirms, the program is regenerated with the new formula

**AI Suggestion Flow:**

1. After logging several sessions with consistently high RPE on Squat Heavy days, the system generates a suggestion
2. User receives a notification: "Program adjustment suggestion for Squat Heavy"
3. User opens the suggestion from Settings → Formulas → Suggestions tab
4. App shows a side-by-side comparison:
   - Current: "Block 2 Heavy: 85% of max"
   - Suggested: "Block 2 Heavy: 82.5% of max"
   - Rationale: "Squat Heavy RPE has averaged 9.6 vs. target 9.0 over the last 3 sessions. Reducing intensity by 2.5% may improve session quality and recovery."
5. User taps "Accept" or "Dismiss"
6. If accepted, a new formula config version is created with source="ai_suggestion" and the program is regenerated

**History and Revert Flow:**

1. User taps "Formula History" from the Formulas screen
2. A list shows all versions: date, source (User / AI Suggestion / System Default), and a summary of what changed
3. User taps any historical version to view its full parameters
4. User can tap "Reactivate this version" to roll back; this creates a new version (no destructive deletion)

### Visual Design Notes

- Formula screen: accordion-style block sections (Block 1, Block 2, Block 3, Deload)
- Each section shows the three intensity types as rows with key parameters
- Sample session card: small card below each block showing a real example session (with the user's actual Squat max applied)
- AI suggestion badge: amber dot on the Settings icon when unreviewed suggestions exist
- Side-by-side comparison: left column "Current" (neutral), right column "Suggested" (highlighted in amber), with rationale text below
- History list: timeline view with source badge color coding (grey=system, blue=user, amber=AI)

## User Benefits

**Full transparency**: Every loading parameter is visible, labeled in plain language, and tied to a sample output using the user's actual max — no black box.

**Safe experimentation**: Every change creates a new version. Reverting to any previous state is a single tap. Users can experiment without fear.

**Trust in AI suggestions**: AI suggestions are never applied silently. They come with specific rationale and require explicit user approval, building trust over time.

**Audit trail**: The formula history shows the full evolution of the program's parameters — useful for reflecting on what worked and what didn't over multiple training cycles.

## Implementation Status

### Planned

- View current formula config by block and intensity type
- Inline parameter editing with live session preview
- Save as new version with optional program regeneration
- AI suggestion review (accept / dismiss)
- Formula history list
- Reactivate any historical version

## Future Enhancements

**Phase 2:**
- Formula import/export: share a formula config with a coach or training partner (JSON format)
- Coach override mode: a coach can lock certain parameters so the athlete can't change them

**Long-term:**
- Community formula library: browse and import formula configs shared by other users (with performance context)
- System-generated templates for specific goals (meet peaking, hypertrophy emphasis, injury prevention)

## Open Questions

- [ ] Should users be able to set different formula overrides per lift (e.g., modify only Squat parameters, not Bench)?
- [ ] How many unreviewed AI suggestions should accumulate before we stop generating new ones?

## References

- Related Design Docs: [program-generation.md](./program-generation.md), [performance-logging.md](./performance-logging.md)
- Related ADR: [005-training-engine-package.md](../decisions/005-training-engine-package.md)
