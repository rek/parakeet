/**
 * Pure helpers for rest notification content — no expo-notifications import
 * so Vitest can import this file in a Node.js environment.
 */

function capitalize(v: string): string {
  if (!v) return v
  return v.charAt(0).toUpperCase() + v.slice(1)
}

export function buildRestNotificationContent(
  lift: string,
  intensityType: string,
): { title: string; body: string } {
  return {
    title: 'Rest done',
    body: `${capitalize(lift)} — ${capitalize(intensityType)} is ready`,
  }
}
