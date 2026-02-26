# Feature: Rest Timer

**Status**: Designed (not implemented)
**Date**: 2026-02-25

## Overview

A between-set rest timer built into the session logging screen. Rest duration has three layers: formula defaults by intensity type, user-stored preferences, and AI suggestions embedded in the JIT output. The timer counts down automatically after each set is logged. The user can extend, shorten, or skip.

## Background

Rest period length directly affects training quality. Too short → performance decline mid-session, accumulated fatigue, RPE inflation. Too long → session drag, suboptimal hypertrophy stimulus for rep work. Optimal rest varies by:

- **Intensity type**: Heavy (85–92.5% 1RM, 1–5 reps) → 3–5 min. Rep / hypertrophy work → 1.5–2.5 min. Explosive → 2–3 min. Deload → 1–1.5 min.
- **How hard the last set felt**: RPE 9.5 on a Block 3 single → take the full 5 minutes. RPE 7 on a rep set → 90 seconds is fine.
- **Soreness and disruptions**: Elevated fatigue or active disruptions suggest slightly longer rest to protect quality.
- **Sex**: Female lifters recover between sets faster than males on average — female defaults are ~30 seconds shorter. Not enforced; just the starting default.

## Design Decisions

### 1. Formula Defaults by Intensity Type

A `DEFAULT_REST_SECONDS` table (part of `FormulaConfig`) provides per-intensity-type defaults for each block. These are used when no user preference is set.

| Block | Heavy | Explosive | Rep | Deload |
|-------|-------|-----------|-----|--------|
| 1     | 180s (3 min) | 120s | 120s | 90s |
| 2     | 210s (3.5 min) | 150s | 120s | 90s |
| 3     | 300s (5 min) | 180s | 150s | 90s |

Female defaults: subtract 30s from all non-deload values. Deload unchanged.

These are embedded in `FormulaConfig.rest_seconds` — same structure as the set/rep tables, so user formula overrides can adjust them.

### 2. JIT Output Carries Recommended Rest

Each `PlannedSet` gains an optional `rest_after_seconds?: number` field. The JIT generator populates this:

- **Formula path**: uses `FormulaConfig.rest_seconds` for the block/intensity type
- **LLM path**: the prompt includes session context (last RPE, soreness, block, set number) and the LLM can suggest a modified rest per set — constrained to ±60s of the formula default (hard constraint enforced post-LLM)

Auxiliary work sets get a fixed 90s rest (not intensity-dependent, not AI-modified).

### 3. User-Settable Defaults

Users can override the formula defaults in **Settings → Training → Rest Timer**. Overrides are stored per intensity-type, per lift (optional — lift-specific overrides are advanced). These are persisted in a `rest_configs` table and take precedence over formula defaults when building JIT output.

The formula default is the fallback when no user override exists for that lift/intensity combination.

### 4. AI Suggestion Display

When the LLM JIT strategy is active and the AI suggested a rest time different from the formula default by ≥30s, the timer UI shows a subtle note: _"AI: 4 min suggested for this set"_. The user can choose to follow it or not — it does not override the timer automatically. The timer still starts from the user's configured default; the AI note is advisory.

### 5. Extending / Shortening at Runtime

During the session, the user can tap **+30s**, **−30s**, or **Done** at any time. These are ephemeral — they do not persist to settings. If the user consistently taps +60s on heavy sets every session, future sessions will still start from the stored default.

## User Experience

### Session Screen (between sets)

After the user taps the checkmark to log a set, the timer **starts automatically** — no extra tap required:

1. Rest timer overlay appears (full-screen or bottom sheet)
2. Large countdown clock (MM:SS)
3. Subtle label: block/intensity type + "Block 3 · Heavy · 5 min rest"
4. If AI suggestion differs ≥30s: small chip "AI suggested 4:30"
5. Controls: **−30s** · **+30s** · **Done resting**
6. At 0:00: audio alert + haptic; timer turns red and counts up (overtime)
7. On "Done resting" or after logging next set: timer dismissed

### Settings → Training → Rest Timer

- Per-intensity-type default inputs: Heavy / Explosive / Rep / Deload (in minutes:seconds or seconds)
- Toggle: audio alert at 0:00 (default on)
- Toggle: haptic alert at 0:00 (default on)
- Toggle: AI rest suggestions (default on — requires LLM JIT strategy active)
- Reset to defaults button

### Auxiliary Work Rest

Auxiliary sets always use a fixed 90s rest. Not shown as prominently — a smaller pill timer in the auxiliary section, no AI suggestion.

## Data Model

Rest data is carried on `JITOutput`, not on `PlannedSet`, to keep `PlannedSet` a pure planned-weight/reps structure and avoid changing the shared-types surface used by the DB schema. `JITOutput` carries a `restRecommendations` field with per-set rest durations for the main lift and a single value per auxiliary exercise.

Rest defaults are part of `FormulaConfig` — the same block/intensity type structure as set/rep parameters — so user formula overrides can adjust them. User overrides are stored per intensity-type and optionally per lift in a `rest_configs` table in Supabase.

## Actual Rest Duration Logging

The actual rest taken between sets can be logged alongside the other per-set data. A key design question is how to measure it accurately: tapping the checkmark to log a set is a post-hoc action — the user may have finished the lift 30 seconds before logging it. Options:

1. **"Lift started" tap** — add a "Start lift" button the user taps before unracking. Timer stops and rest is calculated from previous log tap to this tap. Most accurate, adds friction.
2. **Timer-start = log tap** — assume rest starts when the user logs the set. Off by the logging latency (typically <10s). Simplest.
3. **User-declared** — at the end of the rest, ask "was that about right?" with a quick adjust. Preserves data quality without pre-set friction.

The design defaults to option 2, with option 1 as a potential future toggle in Settings → Training → Rest Timer.

## What This Does NOT Do

- Does not automatically pause the session if the user ignores the timer
- Does not sync timer state across devices (timer is local/ephemeral)
- Does not prescribe different rest for warmup sets (warmup rest is user-paced)
- Does not expose rest duration analytics yet (data is captured but UI is Phase 2)

## References

- [performance-logging.md](./performance-logging.md) — Rest timer was listed as a Phase 2 item; this doc supersedes that entry
- [sex-based-adaptations.md](./sex-based-adaptations.md) — Faster inter-set recovery for female lifters; sex-differentiated defaults here
- [engine-011-llm-jit-generator.md](../specs/04-engine/engine-011-llm-jit-generator.md) — LLM JIT strategy that will carry rest suggestions
