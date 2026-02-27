# Feature: In-Session History Access

**Status**: Approved

**Author**: Adam

**Date**: 2026-02-27

> **Design Doc Philosophy**: This document describes WHAT the feature does and WHY, from a user perspective. Technical implementation details (HOW) are tracked in Beads for granular task management. Keep this doc user-focused, concise, and free of code/implementation specifics.

## Overview

While logging sets during a workout, users can freely navigate to any screen in the app — history, trends, volume, achievements — and return to their active session at any time. A persistent banner shows which session is in progress and counts down remaining rest time.

## Problem Statement

Rest periods between heavy sets can last 3–5 minutes. Users are curious about their performance history during this time but are currently trapped on the session screen with no way to browse data. Navigating away loses the rest timer state entirely.

**Pain points:**

- Can't check historical 1RM trends while resting
- Can't review weekly volume vs. MRV targets mid-session
- Can't look at past cycle reviews or achievements while waiting
- Navigating away loses the rest countdown, forcing a guess on return

**Desired outcome:** The app feels open and explorable during workouts, not like a locked-down logging form.

## User Experience

### User Flows

**Primary Flow — browse during rest:**

1. User completes a set; rest timer starts
2. User taps the History or any other tab
3. Session screen unmounts; rest timer keeps ticking in the background
4. A floating banner appears at the bottom of every screen: "Squat — Heavy · Block 3 | Rest: 1:32"
5. Countdown in the banner decreases in real time
6. When rest is up, banner changes to "Rest done" in a warning color
7. User taps banner → returns to session screen; timer reflects actual elapsed time
8. User taps "Done resting" and continues logging

**Alternative Flow — app backgrounded:**

1. Timer is running; user switches to another app
2. On return, elapsed time has advanced by the time spent away
3. Banner and session screen both reflect realistic elapsed time

**Alternative Flow — session completed while browsing:**

1. User somehow navigates back to session without the banner and completes the session
2. Banner disappears immediately; session is over

### Visual Design Notes

- **Banner**: Floating pill above the tab bar on all non-session screens; shows lift name + block/week context + live rest countdown
- **Countdown**: Ticks every second; turns a warning color when overtime ("Rest done" instead of a negative number)
- **Banner hidden**: When on the session screen itself (no banner needed there) and when no session is active
- **No new button on session screen**: Users navigate away naturally via the tab bar; no extra affordance needed

## User Benefits

**Full data access during rest**: Browse all of your historical data — trends, PRs, volume, cycle reviews, achievements — without interrupting the workout.

**Timer keeps running**: Rest time tracks accurately even when you're reading your history. No more guessing how long you've been resting.

**No workflow disruption**: Returning to the session is one tap. The session exactly where you left it.

## Implementation Status

### 📋 Planned

- Persist rest timer state across navigation
- Persist session identity (lift name, block/week) for banner display
- Return-to-session floating banner with live countdown
- Session screen syncs timer on return (catches up to real elapsed time)

## Future Enhancements

**Phase 2:**

- Banner taps open a mini-history sheet for the current lift without leaving the session screen
- Haptic pulse when rest timer expires while browsing another screen

**Long-term:**

- Notification when rest is done (if app is backgrounded)

## Open Questions

- None — design decisions resolved before implementation

## References

- Related Design Docs: [rest-timer.md](./rest-timer.md)
