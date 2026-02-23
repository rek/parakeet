# Feature: Formula Management

**Status**: Planned

**Date**: 2026-02-22

## Overview

Formula Management gives users full visibility into the Cube Method loading parameters that drive their program, and a structured way to review auto-generated adjustment suggestions — all with a complete version history and easy revert capability. The system is designed to be **automatic**: algorithmic suggestions are the primary mechanism for formula changes, not manual user editing.

## Problem Statement

Most training apps treat their programming logic as a black box. Advanced lifters benefit from understanding what drives their loading scheme — but they don't have the information (or the time) to tune individual formula parameters themselves. The right approach is a system that adjusts automatically, surfaces those adjustments transparently, and lets the user approve or reject them.

**Pain points:**
- Users can't see why their session calls for a specific weight — the calculation is hidden
- Auto-generated suggestions that silently modify programs erode trust
- There is no audit trail of what changed, when, and why

**Desired outcome:** The user can see exactly how every weight is calculated. The system automatically proposes formula adjustments based on performance data. The user approves or dismisses — but never needs to know the right numbers themselves.

## How the System Works: No LLM

It is important to be precise about what "automatic" means here. **There is no language model or external AI service involved.** All suggestion generation is deterministic, rule-based pattern detection that runs locally in the app after each session completion.

The rules (from `engine-005-performance-adjuster`):

| Pattern detected | Suggestion |
|-----------------|------------|
| Actual RPE > target RPE by 1.0+ for 2 consecutive sessions on the same lift | Reduce that block's intensity percentage by 2.5% |
| Actual RPE < target RPE by 1.0+ for 2 consecutive sessions on the same lift | Increase intensity percentage by 2.5% |
| Session completion < 80% | Flag for review (no formula change) |

The rationale text written into each suggestion is generated from a template (e.g., "Squat Heavy RPE has averaged 9.6 vs. target 9.0 over the last 3 sessions") — not from an LLM. The system is called "auto-suggestion" in the codebase, not "AI".

Similarly, **JIT session generation is entirely deterministic math** — Cube Method percentages applied to the user's current 1RM, then modulated by soreness, MRV limits, RPE history, and disruptions. No external service is involved. See [program-generation.md](./program-generation.md) for the full JIT pipeline.

The word "AI" in earlier versions of these docs was used loosely to mean "generated automatically by the system." It is avoided here to prevent confusion with language models.

## Design Principles

**The system adjusts automatically.** Formula parameters are not expected to be manually tuned by the user. The user does not have enough training science context to know whether Block 2 Heavy should be 82.5% vs 85% — the pattern detector does. The user's role is approval, not authorship.

**Per-lift formula overrides are not supported.** Formulas apply to all three lifts uniformly. The system may generate lift-specific suggestions (e.g., "reduce Squat Heavy intensity") but this is handled through the suggestion/approval flow, not a manual per-lift editing UI. The reason: users don't have enough information to make sound per-lift tuning decisions independently.

**No silent changes.** Every formula change is logged, dated, and visible in history. Nothing changes without the user seeing it.

**Zero suggestion backlog.** The system stops generating new suggestions if any unreviewed suggestions already exist. The user must review (accept or dismiss) pending suggestions before new ones are generated. This prevents suggestion fatigue and ensures each suggestion gets proper attention.

## User Experience

### User Flows

**Primary Flow (viewing current formula config):**

1. User navigates to Settings → Formulas
2. App shows the current active formula config, organized by block
3. Each block section shows Heavy / Explosive / Rep parameters in plain language:
   - "Block 1 Heavy: 80% of max — 2 sets of 5 reps — RPE target 8.5"
4. A small "Sample" card below each row shows what a session at those parameters would look like for the user's current Squat max
5. Parameters are read-only by default — the system manages them

**Auto-Suggestion Flow:**

1. After two consecutive sessions with Squat Heavy RPE consistently above target, the pattern detector triggers
2. User receives a notification: "Program adjustment suggestion ready"
3. User opens the suggestion from Settings → Formulas → Suggestions tab
4. App shows a side-by-side comparison:
   - Current: "Block 2 Heavy: 85% of max"
   - Suggested: "Block 2 Heavy: 82.5% of max"
   - Rationale: "Squat Heavy RPE has averaged 9.6 vs. target 9.0 over the last 2 sessions. Reducing intensity by 2.5% may improve session quality and recovery."
5. User taps "Accept" or "Dismiss"
6. If accepted, a new formula config version is created with source="auto_suggestion" and the program is regenerated
7. If dismissed, the suggestion is logged as dismissed and the detector will reconsider after more sessions are logged

**Suggestion Generation Rules:**
- A new suggestion is only generated if **zero** unreviewed suggestions currently exist
- Suggestions are generated on session completion when the detector finds a qualifying pattern
- Each suggestion covers one specific change with clear rationale

**History and Revert Flow:**

1. User taps "Formula History" from the Formulas screen
2. A list shows all versions: date, source (Auto-suggestion / System Default), and a summary of what changed
3. User taps any historical version to view its full parameters
4. User can tap "Reactivate this version" to roll back; this creates a new version (no destructive deletion)

### Visual Design Notes

- Formula screen: accordion-style block sections (Block 1, Block 2, Block 3, Deload)
- Each section shows the three intensity types as rows with key parameters
- Sample session card: small card below each block showing a real example session (with the user's actual Squat max applied)
- Suggestion badge: amber dot on the Settings icon when unreviewed suggestions exist
- Side-by-side comparison: left column "Current" (neutral), right column "Suggested" (highlighted in amber), with rationale text below
- History list: timeline view with source badge color coding (grey=system, amber=auto-suggestion)

## User Benefits

**Full transparency**: Every loading parameter is visible, labeled in plain language, and tied to a sample output using the user's actual max — no black box.

**Automatic optimization**: The system detects when loading is too high or too low and proposes corrections. Users benefit from performance science without needing to understand the underlying parameters.

**Trustworthy suggestions**: Auto-suggestions are never applied silently. They come with specific rationale, an exact before/after comparison, and require explicit user approval.

**Focused suggestions**: Because new suggestions are blocked until pending ones are reviewed, the user is never overwhelmed. Each suggestion gets a clear decision.

**Audit trail**: The formula history shows the full evolution of the program's parameters — useful for reflecting on what worked and what didn't over multiple training cycles.

## Implementation Status

### Planned

- View current formula config by block and intensity type (read-only display)
- Sample session preview per block (uses user's actual current maxes)
- Auto-suggestion generation via `suggestProgramAdjustments()` — rule-based, runs locally after each session
- Suggestion review (accept / dismiss) with side-by-side comparison and rationale
- Suggestion blocked if any unreviewed suggestion already exists
- Formula history list
- Reactivate any historical version

## Future Enhancements

**Phase 2:**
- Formula import/export: share a formula config with a coach or training partner (JSON format)
- Coach override mode: a coach can lock certain parameters so the athlete can't change them

**Long-term:**
- If an LLM integration is added in future (e.g., to generate natural-language training insights or suggest more nuanced formula changes), it would slot into this same suggestion/approval flow — the user-facing pattern stays the same regardless of what generates the suggestion

## References

- Related Design Docs: [program-generation.md](./program-generation.md), [performance-logging.md](./performance-logging.md), [cycle-review-and-insights.md](./cycle-review-and-insights.md)
- Spec: [engine-005-performance-adjuster.md](../specs/04-engine/engine-005-performance-adjuster.md)
- Related ADR: [005-training-engine-package.md](../decisions/005-training-engine-package.md)
