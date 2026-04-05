# Feature: Feature Flags

**Status**: Implemented

**Date**: 8 Mar 2026

## Overview

A modular toggle system that lets users enable/disable app features, giving them control over app complexity. A user who just wants to squat/bench/deadlift sees a clean, minimal app. A user who wants volume tracking, cycle phase awareness, AI suggestions, and achievements can turn those on.

## Problem Statement

As Parakeet gains features (cycle tracking, disruptions, warmups, AI rest suggestions, achievements, Wilks, volume dashboards), the app risks becoming overwhelming. Users should control which features they see.

- A lifter who doesn't care about auxiliary exercises shouldn't see that section
- A male lifter shouldn't see cycle tracking (already handled), but may also not want disruption reporting
- A lifter who prefers simplicity shouldn't see volume MRV warnings, AI motivational messages, or streak pills
- The "Developer" settings are already niche — this generalizes that pattern

## User Experience

### Feature Categories

Features are grouped into categories for the settings UI:

**Core** (always on, not toggleable):
- Session logging (sets, reps, weight, RPE)
- Program view
- Today screen (basic workout card)

**Training Enhancements** (on by default):
- Warmup display
- Auxiliary exercises
- Rest timer
- Soreness check-in

**Analytics** (on by default):
- Volume dashboard & MRV warnings
- Achievements & PRs
- Streak tracking

**AI Features** (on by default):
- AI workout generation (LLM JIT)
- AI rest suggestions
- Motivational messages
- Formula AI suggestions

**Health & Recovery** (on by default):
- Disruption reporting
- Cycle tracking (already gated on biological sex)

**Advanced** (off by default):
- Wilks score
- Developer tools (JIT strategy, cycle feedback)

### User Flows

**Primary Flow — Toggle individual features:**
1. User goes to Settings
2. New "Features" section shows toggleable features grouped by category
3. User taps a toggle to enable/disable
4. Change takes effect immediately — disabled features disappear from relevant screens

**Secondary Flow — Presets:**
1. At the top of the Features screen, preset buttons: "Simple" / "Full"
2. "Simple" disables all optional categories except Training Enhancements
3. "Full" enables everything
4. User can still customize individual toggles after applying a preset

### Visual Design Notes

- Feature toggles screen: grouped sections with Switch components
- Each feature has a name and one-line description
- Preset buttons at top: pill-shaped, highlight active preset (or "Custom" if modified)
- Disabled features are hidden entirely from their screens (not greyed out)

## User Benefits

**Simplicity**: Users who want a basic training log get one, without UI clutter.

**Progressive disclosure**: New users start with defaults, discover and enable advanced features as they grow.

**Personalization**: Each user's app reflects what they actually use.

## Implementation Approach

- **AsyncStorage-backed** — device-local, instant, no DB migration needed
- **New `feature-flags` module** — follows existing module architecture
- **`useFeatureFlag` hook** — single boolean check per feature, used in screens/components
- **Feature registry** — `as const` array with metadata (id, label, description, category, default)
- **No conditional imports** — features are always bundled; the hook just controls rendering

## Open Questions

- [x] Should feature flags sync across devices via Supabase? → No, AsyncStorage is fine for now; can migrate to Supabase later if needed
- [x] Should disabling "AI features" also force JIT strategy to "formula"? → Yes, for consistency
- [ ] Any features the user considers "core" that I've categorized as optional?

## References

- Related Spec: `./spec-feature-flags.md`
- Related: `modules/settings/lib/settings.ts` (existing AsyncStorage pattern)
