import { buildRestNotificationContent } from './rest-notification-helpers';

export { buildRestNotificationContent } from './rest-notification-helpers';

export async function scheduleRestNotification(
  lift: string,
  intensityType: string,
  delaySeconds: number
): Promise<string | null> {
  try {
    const Notifications = await import('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;

    const content = buildRestNotificationContent(lift, intensityType);
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
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelRestNotification(notifId: string): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {
    // notification may have fired or already been cleared
  }
}

export async function scheduleWeeklyReviewNotification(): Promise<string | null> {
  try {
    const Notifications = await import('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;

    const now = new Date();
    const day = now.getDay(); // 0=Sun, 6=Sat

    // Next Saturday (or Sunday if today is Saturday)
    const daysUntil = day === 6 ? 1 : (6 - day) || 7;
    const target = new Date(now);
    target.setDate(now.getDate() + daysUntil);
    target.setHours(10, 0, 0, 0);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Weekly body check-in',
        body: 'How did your body hold up this week?',
        data: { type: 'weekly_review' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: target,
      },
    });
    return id;
  } catch {
    return null;
  }
}
