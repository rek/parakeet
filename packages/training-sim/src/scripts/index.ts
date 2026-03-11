import { DayEvent, LifeScript } from '../types'

/** Generate N days of training following a 3-day/week schedule (Mon/Wed/Fri pattern) */
function weekPattern(weeks: number, dayOverrides?: Partial<Record<number, DayEvent>>): DayEvent[] {
  const events: DayEvent[] = []
  // 3 training days: day 0 (Mon), day 2 (Wed), day 4 (Fri), rest on other days
  const trainingDaysInWeek = [0, 2, 4] // 0-indexed within a 7-day week

  for (let week = 0; week < weeks; week++) {
    for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
      const absoluteDay = week * 7 + dayInWeek
      if (dayOverrides?.[absoluteDay]) {
        events.push(dayOverrides[absoluteDay])
      } else if (trainingDaysInWeek.includes(dayInWeek)) {
        events.push({ type: 'train' })
      } else {
        events.push({ type: 'rest' })
      }
    }
  }

  return events
}

/**
 * Adherent male — 12 weeks, no disruptions, trains every scheduled day.
 * One travel disruption in week 8 (skips 2 days).
 */
export const ADHERENT_MALE: LifeScript = {
  name: 'adherent-male',
  description: '12-week cycle with one minor travel disruption in week 8',
  events: weekPattern(12, {
    // Week 8, day 1 (Tuesday) — travel disruption reported
    [7 * 7 + 1]: {
      type: 'disrupt',
      disruption: {
        type: 'travel',
        severity: 'minor',
        durationDays: 3,
        description: 'Work travel — limited gym access',
      },
    },
    // Skip Wed/Fri of week 8
    [7 * 7 + 2]: { type: 'skip', reason: 'travel' },
    [7 * 7 + 4]: { type: 'skip', reason: 'travel' },
  }),
}

/**
 * Adherent female — 12 weeks with cycle tracking.
 * Period starts at day 0, cycles every 28 days.
 * Moderate soreness in luteal phase.
 */
export const ADHERENT_FEMALE: LifeScript = {
  name: 'adherent-female',
  description: '12-week cycle with menstrual cycle tracking, period every 28 days',
  events: (() => {
    const weeks = 12
    const events: DayEvent[] = []
    const trainingDaysInWeek = [0, 2, 4]
    const cycleLength = 28

    for (let week = 0; week < weeks; week++) {
      for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
        const absoluteDay = week * 7 + dayInWeek
        const dayInCycle = absoluteDay % cycleLength

        if (absoluteDay % cycleLength === 0) {
          // Period start event
          events.push({ type: 'period-start' })
        } else if (trainingDaysInWeek.includes(dayInWeek)) {
          // Training day with cycle-phase-appropriate soreness
          const sleep: 1 | 2 | 3 = dayInCycle < 5 ? 2 : 3 // slightly worse sleep during menstruation
          const energy: 1 | 2 | 3 = dayInCycle < 5 ? 2 : dayInCycle > 21 ? 2 : 3

          events.push({
            type: 'train',
            sleep,
            energy,
            soreness: dayInCycle > 21 ? {
              ratings: { glutes: 2, hamstrings: 2, lower_back: 2 },
            } : undefined,
          })
        } else {
          events.push({ type: 'rest' })
        }
      }
    }
    return events
  })(),
}

/**
 * Injured lifter — trains normally for 3 weeks, then gets a moderate knee injury.
 * Skips week 4, returns week 5 with reduced capacity.
 */
export const INJURED_SCRIPT: LifeScript = {
  name: 'injured-lifter',
  description: '9-week program with moderate knee injury at week 4',
  events: weekPattern(9, {
    // Week 4, Monday — injury reported
    [3 * 7]: {
      type: 'disrupt',
      disruption: {
        type: 'injury',
        severity: 'moderate',
        affectedLifts: ['squat'],
        durationDays: 10,
        description: 'Knee tweak — pain on squat descent',
      },
    },
    // Skip rest of week 4
    [3 * 7 + 2]: { type: 'skip', reason: 'injury' },
    [3 * 7 + 4]: { type: 'skip', reason: 'injury' },
    // Week 5: still disrupted but training through it
    [4 * 7]: {
      type: 'train',
      soreness: { ratings: { quads: 3, glutes: 2 } },
    },
    [4 * 7 + 2]: {
      type: 'train',
      soreness: { ratings: { quads: 3 } },
    },
    [4 * 7 + 4]: {
      type: 'train',
      soreness: { ratings: { quads: 2 } },
    },
  }),
}

/**
 * Busy lifter — misses ~30% of sessions randomly.
 * Some days have low energy/sleep.
 */
export const BUSY_SCRIPT: LifeScript = {
  name: 'busy-lifter',
  description: '12-week program missing ~30% of sessions with poor sleep/energy',
  events: (() => {
    const weeks = 12
    const events: DayEvent[] = []
    const trainingDaysInWeek = [0, 2, 4]

    // Deterministic "random" — skip specific sessions
    const skipDays = new Set([
      2, 7, 11, 16, 21, 25, 30, 35, 42, 49, 53, 60, 67, 74, 79,
    ])

    for (let week = 0; week < weeks; week++) {
      for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
        const absoluteDay = week * 7 + dayInWeek

        if (skipDays.has(absoluteDay) && trainingDaysInWeek.includes(dayInWeek)) {
          events.push({ type: 'skip', reason: 'busy' })
        } else if (trainingDaysInWeek.includes(dayInWeek)) {
          // Vary sleep/energy — roughly 1/3 poor, 1/3 ok, 1/3 great
          const mod = absoluteDay % 3
          const sleep: 1 | 2 | 3 = mod === 0 ? 1 : mod === 1 ? 2 : 3
          const energy: 1 | 2 | 3 = mod === 0 ? 2 : mod === 1 ? 1 : 3
          events.push({ type: 'train', sleep, energy })
        } else {
          events.push({ type: 'rest' })
        }
      }
    }
    return events
  })(),
}

// Re-export new scripts
export { ILLNESS_SCRIPT, NO_EQUIPMENT_SCRIPT, FATIGUE_ACCUMULATION_SCRIPT } from './illness'

export const ALL_SCRIPTS: LifeScript[] = [
  ADHERENT_MALE,
  ADHERENT_FEMALE,
  INJURED_SCRIPT,
  BUSY_SCRIPT,
]
