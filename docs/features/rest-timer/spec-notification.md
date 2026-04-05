# Spec: Rest-Done Background Notification

**Status**: Implemented
**Domain**: parakeet App

## What This Covers

Sends a local notification when rest finishes while the app is backgrounded during an active session, so the user can return at the right time.

## Tasks

**Notification trigger**
- [ ] When rest timer is active and app moves to background, schedule a local notification for expected rest expiry time.
- [ ] If user returns and completes/dismisses rest before fire time, cancel the pending notification.
- [ ] If timer is extended/reduced while backgrounded is not possible, scheduled time remains based on last known duration+offset.

**Notification content**
- [ ] Title: `Rest done`
- [ ] Body: include lift/intensity context (for example `Squat — Heavy is ready`).
- [ ] Include deep link payload to return to active session route.

**App integration**
- [ ] Handle tap on notification by routing directly to session screen with current session context.
- [ ] Ensure stale notifications are ignored if session already completed/closed.

**Permissions and settings**
- [ ] Request notification permission lazily on first feature use.
- [ ] If permission denied, silently skip notification scheduling.
- [ ] Add a user toggle in rest/session settings to enable/disable background rest notifications.

**Reliability**
- [ ] Guarantee at most one active rest notification per active session timer.
- [ ] Cancel all scheduled rest notifications on session completion/reset/logout.

## Dependencies

- [mobile-021-in-session-history.md](./mobile-021-in-session-history.md) — session identity and timer persistence
- [mobile-017-rest-timer.md](./mobile-017-rest-timer.md) — rest lifecycle
- [mobile-001-expo-router-layout.md](./mobile-001-expo-router-layout.md) — deep link navigation path
- [mobile-018-rest-timer-settings.md](./mobile-018-rest-timer-settings.md) — user preferences surface
