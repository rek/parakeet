# Feature: Prescription Reasoning

**Status**: In Progress

**Date**: 17 Mar 2026

## Overview

Every workout prescription element (weight, reps, exercise selection, rest duration) should be explainable to the user. Tap a weight to see why it was chosen; tap an exercise name to see why it was selected. The system already computes reasoning internally but discards it before the UI layer.

## Problem Statement

The JIT engine makes dozens of decisions per session using ~43 inputs (soreness, disruptions, cycle phase, readiness, RPE history, volume tracking, formula config). The user sees the output (120kg x 5 @ RPE 8) but has no way to understand *why* — why this weight, why this many sets, why this exercise was added.

- User can't debug unexpected prescriptions ("why is the weight so low today?")
- User can't learn how the system responds to their inputs ("did my soreness rating actually change anything?")
- Session-level rationale (`rationale[]`, `warnings[]`) exists in the engine but is stripped before reaching the UI

## User Experience

### Primary Flow

1. User opens session, completes soreness check-in, JIT runs
2. Session screen shows workout as usual — no visual clutter
3. User taps the weight number on any main lift set → bottom sheet opens showing weight derivation chain: `1RM (140kg) x block1 heavy (0.857) = 120kg`, then each modifier applied
4. User taps an auxiliary exercise name → sheet shows why it was selected (pool rotation, locked slot, or volume top-up) and its weight derivation
5. Collapsed card below session header shows session-level rationale — user can expand to read step-by-step adjustments

### Alternative Flows

- **No adjustments applied**: derivation shows clean path (1RM x block% = weight, no modifiers)
- **Recovery mode**: sheet explains soreness triggered recovery, shows reduced weight/volume
- **Skipped main lift**: sheet explains MRV exceeded or major disruption caused skip
- **Historical session**: user views completed session in history, taps "Why this?" to see persisted trace

## User Benefits

**Debuggability**: Understand exactly why a prescription differs from expectations — trace every modifier back to its source input.

**Trust**: Seeing the reasoning chain builds confidence that the system is responding correctly to body-state inputs.

**Learning**: Over time, the user understands how soreness ratings, sleep quality, and cycle phase affect their training — making them better at self-reporting.

## Phased Rollout

1. **Engine trace** — pure TypeScript types and builder, no UI changes
2. **App plumbing** — carry trace from engine through DB to session screen
3. **Session UI** — bottom sheet with derivation display, feature-flag gated
4. **History retrospective** — view reasoning for completed sessions

## Open Questions

- [x] Inline trace vs reconstruction? → Inline (build trace as pipeline runs)
- [x] Persist vs transient? → Persist in `sessions.jit_output_trace` JSONB
- [ ] Should the trace include LLM rationale text when hybrid/LLM strategy is used?
- [ ] Should the dashboard also display traces for developer analysis?

## References

- Spec: `docs/specs/04-engine/engine-036-prescription-trace.md` (Phase 1)
- Related: `docs/design/training-engine-architecture.md` (JIT pipeline)
