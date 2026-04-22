# Feature: Exercise Subtitles

**Status**: In Review

**Date**: 22 Apr 2026

## Overview

Some auxiliary exercises have meaningful variants that differ in load, ROM, and training stimulus. The subtitle field exposes those variants in the UI so the lifter always knows exactly which version was prescribed or selected.

## Problem Statement

Rack Pull is the primary case: "above the knee" and "below the knee" are mechanically distinct movements with different weight percentages. Currently both collapse to the same label — a lifter looking at their session or history has no way to tell which pin height was used.

## User Experience

### Affected Surfaces

1. **Session screen** — prescribed and ad-hoc aux exercise headers show name + subtitle
2. **AddExerciseModal / SlotDropdown** — exercise picker rows show subtitle below name
3. **Auxiliary pool settings** — pool list items show subtitle below name
4. **Aux results table** — history session summary shows subtitle below section header

### Visual Design

- Subtitle renders as a second line below the exercise name
- Smaller, muted colour (textTertiary) — clearly secondary
- No subtitle line if `subtitle` is absent

## Catalog Changes

Two Rack Pull entries replace the current single one:

| Name | Subtitle | weightPct | Notes |
|------|----------|-----------|-------|
| Rack Pull | Above the knee | 1.05 | Existing entry, short ROM supramax |
| Rack Pull Below Knee | Below the knee | 1.00 | New entry, meaningful ROM, full 1RM load |

## References

- GitHub: #205
- Spec: [spec-subtitles.md](./spec-subtitles.md)
