import { DayEvent, LifeScript } from '../types'

/**
 * Illness script — trains normally for 4 weeks, then catches a cold.
 * Major illness (3 days bed rest), then 1 week of reduced training.
 */
export const ILLNESS_SCRIPT: LifeScript = {
  name: 'illness-recovery',
  description: '9-week program with major illness at week 5',
  events: (() => {
    const weeks = 9
    const events: DayEvent[] = []
    const trainingDaysInWeek = [0, 2, 4]

    for (let week = 0; week < weeks; week++) {
      for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
        // Week 5 (index 4): illness hits Monday
        if (week === 4 && dayInWeek === 0) {
          events.push({
            type: 'disrupt',
            disruption: {
              type: 'illness',
              severity: 'major',
              durationDays: 7,
              description: 'Flu — fever and body aches',
            },
          })
        } else if (week === 4) {
          // Skip entire week 5
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({ type: 'skip', reason: 'illness' })
          } else {
            events.push({ type: 'rest' })
          }
        } else if (week === 5) {
          // Week 6: returning from illness, low energy
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({
              type: 'train',
              sleep: 2,
              energy: 1,
              soreness: {
                ratings: { upper_back: 2, lower_back: 2 },
              },
            })
          } else {
            events.push({ type: 'rest' })
          }
        } else if (trainingDaysInWeek.includes(dayInWeek)) {
          events.push({ type: 'train' })
        } else {
          events.push({ type: 'rest' })
        }
      }
    }
    return events
  })(),
}

/**
 * Equipment unavailable — gym closes for renovation weeks 3-4.
 * Athlete trains bodyweight only during that period.
 */
export const NO_EQUIPMENT_SCRIPT: LifeScript = {
  name: 'no-equipment',
  description: '9-week program with 2 weeks of no gym access (weeks 3-4)',
  events: (() => {
    const weeks = 9
    const events: DayEvent[] = []
    const trainingDaysInWeek = [0, 2, 4]

    for (let week = 0; week < weeks; week++) {
      for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
        // Week 3 start: equipment disruption
        if (week === 2 && dayInWeek === 0) {
          events.push({
            type: 'disrupt',
            disruption: {
              type: 'equipment_unavailable',
              severity: 'moderate',
              durationDays: 14,
              description: 'Gym renovation — no barbell access',
            },
          })
        } else if ((week === 2 || week === 3) && trainingDaysInWeek.includes(dayInWeek)) {
          // Train through it (JIT will substitute bodyweight exercises)
          events.push({ type: 'train', energy: 2 })
        } else if (trainingDaysInWeek.includes(dayInWeek)) {
          events.push({ type: 'train' })
        } else {
          events.push({ type: 'rest' })
        }
      }
    }
    return events
  })(),
}

/**
 * Deload timing test — 12-week program where the athlete is consistently
 * fatigued in weeks 8-9 (high soreness, poor sleep).
 * Tests whether deload in week 12 provides adequate recovery.
 */
export const FATIGUE_ACCUMULATION_SCRIPT: LifeScript = {
  name: 'fatigue-accumulation',
  description: '12-week program with fatigue buildup weeks 8-9, tests deload timing',
  events: (() => {
    const weeks = 12
    const events: DayEvent[] = []
    const trainingDaysInWeek = [0, 2, 4]

    for (let week = 0; week < weeks; week++) {
      for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
        if (trainingDaysInWeek.includes(dayInWeek)) {
          if (week >= 7 && week <= 8) {
            // Weeks 8-9: fatigue buildup
            events.push({
              type: 'train',
              sleep: 1,
              energy: 1,
              soreness: {
                ratings: {
                  quads: 3,
                  hamstrings: 3,
                  lower_back: 3,
                  chest: 2,
                  upper_back: 2,
                },
              },
            })
          } else if (week >= 9 && week <= 10) {
            // Weeks 10-11: recovering but still not great
            events.push({
              type: 'train',
              sleep: 2,
              energy: 2,
              soreness: {
                ratings: {
                  quads: 2,
                  hamstrings: 2,
                  lower_back: 2,
                },
              },
            })
          } else {
            events.push({ type: 'train' })
          }
        } else {
          events.push({ type: 'rest' })
        }
      }
    }
    return events
  })(),
}
