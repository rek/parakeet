import { buildRestNotificationContent } from './rest-notification-helpers'

export { buildRestNotificationContent } from './rest-notification-helpers'

/**
 * Requests notification permission lazily and schedules a "rest done" local
 * notification to fire after `delaySeconds`.
 *
 * Returns the notification identifier (used for cancellation), or null if
 * the native module is unavailable, permission was denied, or scheduling failed.
 */
export async function scheduleRestNotification(
  lift: string,
  intensityType: string,
  delaySeconds: number,
): Promise<string | null> {
  try {
    const Notifications = await import('expo-notifications')
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') return null

    const content = buildRestNotificationContent(lift, intensityType)
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data: { type: 'rest_done' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(delaySeconds)),
      },
    })
    return id
  } catch {
    return null
  }
}

/**
 * Cancels a previously scheduled rest notification. Fails silently.
 */
export async function cancelRestNotification(notifId: string): Promise<void> {
  try {
    const Notifications = await import('expo-notifications')
    await Notifications.cancelScheduledNotificationAsync(notifId)
  } catch {
    // Ignore — notification may have already fired or been cleared
  }
}
