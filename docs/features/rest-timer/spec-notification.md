# Spec: Rest-Done Background Notification

**Status**: Complete
**Domain**: parakeet App

## What This Covers

Sends a local notification when rest finishes while the app is backgrounded during an active session, so the user can return at the right time.

## Tasks

**Notification trigger**
- [x] When rest timer is active and app moves to background, schedule a local notification for expected rest expiry time.
- [x] If user returns and completes/dismisses rest before fire time, cancel the pending notification.
- [x] If timer is extended/reduced while backgrounded is not possible, scheduled time remains based on last known duration+offset.

**Notification content**
- [x] Title: `Rest done`
- [x] Body: include lift/intensity context (for example `Squat — Heavy is ready`).
- [x] Include deep link payload to return to active session route (`sessionId` in notification data).

**App integration**
- [x] Handle tap on notification by routing directly to session screen with current session context (`useRestNotificationTapHandler`).
- [x] Ensure stale notifications are ignored if session already completed/closed (sessionId mismatch or timer no longer active).

**Permissions and settings**
- [x] Request notification permission lazily on first feature use (via `requestPermissionsAsync` in `scheduleRestNotification`).
- [x] If permission denied, silently skip notification scheduling.
- [x] Add a user toggle in rest/session settings to enable/disable background rest notifications (`backgroundRestNotification` pref).

**Reliability**
- [x] Guarantee at most one active rest notification per active session timer (`pendingNotifIdRef` in `useRestNotifications`).
- [x] Cancel all scheduled rest notifications on session completion/reset/logout (notification cancelled when `timerState.visible` becomes false).

## Dependencies

- [mobile-021-in-session-history.md](./mobile-021-in-session-history.md) — session identity and timer persistence
- [mobile-017-rest-timer.md](./mobile-017-rest-timer.md) — rest lifecycle
- [mobile-001-expo-router-layout.md](./mobile-001-expo-router-layout.md) — deep link navigation path
- [mobile-018-rest-timer-settings.md](./mobile-018-rest-timer-settings.md) — user preferences surface
