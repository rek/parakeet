# Feature: In-Session History Access

**Status**: Approved

**Date**: 2026-02-27

## Overview

While logging sets during a workout, users can freely navigate to any screen in the app — history, trends, volume, achievements — and return to their active session at any time. A persistent banner shows which session is in progress and counts down remaining rest time.

## Problem Statement

Rest periods between heavy sets can last 3–5 minutes. Users want to navigate freely during rest without losing the timer. Navigating away loses the rest countdown, forcing a guess on return.

**Pain points:**

- Navigating away loses the rest countdown, forcing a guess on return
- Session screen feels like a locked-down form — can't naturally tab away and return

**Desired outcome:** The app feels open and explorable during workouts; rest timer persists across navigation.

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

**Timer keeps running**: Rest time tracks accurately even when you've navigated away. No more guessing how long you've been resting.

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
- Notification when rest is done (if app is backgrounded)

## Delivery Order

1. **Phase 2A — Mini History Sheet**
   - Spec: `mobile-022-in-session-mini-history-sheet.md`
   - Goal: improve in-session data access without leaving logging context.
2. **Phase 2B — Rest Expiry Haptics While Browsing**
   - Spec: `mobile-023-rest-expiry-haptics-while-browsing.md`
   - Goal: improve rest-timing awareness on non-session screens.
3. **Long-term — Background Rest-Done Notification**
   - Spec: `mobile-024-rest-done-background-notification.md`
   - Goal: preserve rest-timing awareness when app is backgrounded.

## Acceptance Gates

- **Gate A (for Phase 2A):**
  - Active session remains intact while mini-history sheet is opened/closed repeatedly.
  - Rest timer continuity is preserved during sheet interaction.
  - Empty/error/offline states are visible and non-blocking.

- **Gate B (for Phase 2B):**
  - Haptic triggers exactly once when rest crosses into overtime while browsing.
  - No repeated haptic spam in overtime.
  - No regressions to banner countdown or session return flow.

- **Gate C (for Long-term):**
  - Notification schedules on background with active rest and cancels on early return/completion.
  - Tap deep-links back to the active session correctly.
  - Stale notifications are ignored safely if session is no longer active.

## References

- Related Design Docs: [rest-timer.md](./rest-timer.md)
- Specs: [mobile-021-in-session-history.md](../specs/09-mobile/mobile-021-in-session-history.md), [mobile-022-in-session-mini-history-sheet.md](../specs/09-mobile/mobile-022-in-session-mini-history-sheet.md), [mobile-023-rest-expiry-haptics-while-browsing.md](../specs/09-mobile/mobile-023-rest-expiry-haptics-while-browsing.md), [mobile-024-rest-done-background-notification.md](../specs/09-mobile/mobile-024-rest-done-background-notification.md)
