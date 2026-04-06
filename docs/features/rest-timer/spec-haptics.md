# Spec: Rest Expiry Haptics While Browsing

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Delivers haptic feedback when rest expires while the user is on a non-session screen but still inside an active in-progress workout.

## Tasks

**Detection rules**
- [x] Trigger haptic when active rest transitions from `remaining > 0` to `remaining <= 0`.
- [x] Trigger only once per rest interval (no repeated pulses each second in overtime).
- [x] Trigger only when app is foregrounded and user is not on the session route.

**`apps/parakeet/src/components/session/ReturnToSessionBanner.tsx`:**
- [x] Add a one-shot edge detector for rest-expiry transition.
- [x] Invoke haptic feedback on transition to overtime.
- [x] Reset detector state when a new timer starts or timer closes.

**Feedback behavior**
- [x] Default feedback: single warning pulse.
- [x] Respect app-level reduced-motion/feedback preferences if configured.
- [x] No sound required for this phase; haptics-only.

**Safety/UX**
- [x] Never block navigation, timer updates, or session-store writes.
- [x] If haptics API fails, fail silently and keep banner behavior unchanged.

## Dependencies

- [mobile-021-in-session-history.md](./mobile-021-in-session-history.md) — banner lifecycle and timer state source
- [mobile-017-rest-timer.md](./mobile-017-rest-timer.md) — rest state model
- [mobile-018-rest-timer-settings.md](./mobile-018-rest-timer-settings.md) — optional preference integration
