import { DayEvent, LifeScript } from '../types';

/** Generate N days of training following a 3-day/week schedule (Mon/Wed/Fri pattern) */
function weekPattern(weeks: number): DayEvent[] {
  const events: DayEvent[] = [];
  const trainingDaysInWeek = [0, 2, 4]; // Mon, Wed, Fri

  for (let week = 0; week < weeks; week++) {
    for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
      if (trainingDaysInWeek.includes(dayInWeek)) {
        events.push({ type: 'train' });
      } else {
        events.push({ type: 'rest' });
      }
    }
  }

  return events;
}

/**
 * Struggling lifter — 12 weeks, fully adherent (no skips, no disruptions).
 * The challenge comes purely from set failures driven by the STRUGGLING_MODEL.
 * Tests that the intra-session adapter responds correctly to consecutive failures.
 */
export const FAILED_SETS_SCRIPT: LifeScript = {
  name: 'failed-sets',
  description:
    '12-week cycle, perfect attendance, set failures drive intra-session adaptations',
  events: weekPattern(12),
};
