import { DayEvent, LifeScript } from '../types';

/**
 * Peaking script — 12-week program with a dedicated peaking block.
 * Weeks 1-8: normal training, good sleep/energy.
 * Weeks 9-11: peaking block — accumulated fatigue with increasing soreness.
 * Week 12: competition week, trains Monday only.
 */
export const PEAKING_SCRIPT: LifeScript = {
  name: 'peaking',
  description:
    '12-week program with peaking block weeks 9-11 and competition week 12',
  events: (() => {
    const weeks = 12;
    const events: DayEvent[] = [];
    const trainingDaysInWeek = [0, 2, 4];

    for (let week = 0; week < weeks; week++) {
      for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
        if (week < 8) {
          // Weeks 1-8: normal training, good sleep/energy
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({ type: 'train', sleep: 3, energy: 3 });
          } else {
            events.push({ type: 'rest' });
          }
        } else if (week === 8) {
          // Week 9: peaking starts — moderate accumulated fatigue
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({
              type: 'train',
              sleep: 2,
              energy: 2,
              soreness: { ratings: { quads: 3, hamstrings: 3 } },
            });
          } else {
            events.push({ type: 'rest' });
          }
        } else if (week === 9) {
          // Week 10: increasing fatigue
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({
              type: 'train',
              sleep: 2,
              energy: 2,
              soreness: { ratings: { quads: 6, hamstrings: 6, lower_back: 3 } },
            });
          } else {
            events.push({ type: 'rest' });
          }
        } else if (week === 10) {
          // Week 11: peak fatigue before taper
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({
              type: 'train',
              sleep: 2,
              energy: 1,
              soreness: {
                ratings: { quads: 6, hamstrings: 6, lower_back: 6, chest: 3 },
              },
            });
          } else {
            events.push({ type: 'rest' });
          }
        } else {
          // Week 12: competition week — train Monday only, skip Wed/Fri
          if (dayInWeek === 0) {
            events.push({ type: 'train', sleep: 3, energy: 3 });
          } else if (dayInWeek === 2 || dayInWeek === 4) {
            events.push({ type: 'skip', reason: 'competition taper' });
          } else {
            events.push({ type: 'rest' });
          }
        }
      }
    }
    return events;
  })(),
};

/**
 * Competition prep script — 9-week final prep + competition.
 * Weeks 1-6: normal training.
 * Week 7: last heavy session.
 * Week 8: deload week — low soreness, good sleep.
 * Week 9: competition day — train Monday only, skip rest of week.
 */
export const COMPETITION_PREP_SCRIPT: LifeScript = {
  name: 'competition-prep',
  description:
    '9-week final prep with deload (week 8) and competition day (week 9 Monday)',
  events: (() => {
    const weeks = 9;
    const events: DayEvent[] = [];
    const trainingDaysInWeek = [0, 2, 4];

    for (let week = 0; week < weeks; week++) {
      for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
        if (week < 6) {
          // Weeks 1-6: normal training
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({ type: 'train' });
          } else {
            events.push({ type: 'rest' });
          }
        } else if (week === 6) {
          // Week 7: last heavy session — train all days
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({ type: 'train', sleep: 3, energy: 3 });
          } else {
            events.push({ type: 'rest' });
          }
        } else if (week === 7) {
          // Week 8: deload — easy training, good recovery
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({
              type: 'train',
              sleep: 3,
              energy: 3,
              soreness: { ratings: { quads: 1, hamstrings: 1 } },
            });
          } else {
            events.push({ type: 'rest' });
          }
        } else {
          // Week 9: competition — Monday only
          if (dayInWeek === 0) {
            events.push({ type: 'train', sleep: 3, energy: 3 });
          } else if (dayInWeek === 2 || dayInWeek === 4) {
            events.push({ type: 'skip', reason: 'competition week' });
          } else {
            events.push({ type: 'rest' });
          }
        }
      }
    }
    return events;
  })(),
};

/**
 * Return from layoff script — 12-week program where the athlete takes 3 weeks
 * completely off, then gradually returns over weeks 4-6 with high soreness.
 * Weeks 7-12: normal training as readaptation completes.
 */
export const RETURN_FROM_LAYOFF_SCRIPT: LifeScript = {
  name: 'return-from-layoff',
  description:
    '12-week program: 3-week layoff, gradual return weeks 4-6, full training weeks 7-12',
  events: (() => {
    const weeks = 12;
    const events: DayEvent[] = [];
    const trainingDaysInWeek = [0, 2, 4];

    for (let week = 0; week < weeks; week++) {
      for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
        if (week < 3) {
          // Weeks 1-3: complete layoff — skip all training days
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({ type: 'skip', reason: 'layoff' });
          } else {
            events.push({ type: 'rest' });
          }
        } else if (week === 3) {
          // Week 4: return with high soreness everywhere, low energy
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({
              type: 'train',
              sleep: 2,
              energy: 1,
              soreness: {
                ratings: {
                  quads: 8,
                  hamstrings: 6,
                  lower_back: 6,
                  chest: 6,
                  upper_back: 6,
                },
              },
            });
          } else {
            events.push({ type: 'rest' });
          }
        } else if (week === 4) {
          // Week 5: improving — soreness decreasing
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({
              type: 'train',
              sleep: 2,
              energy: 2,
              soreness: {
                ratings: { quads: 6, hamstrings: 3, lower_back: 3 },
              },
            });
          } else {
            events.push({ type: 'rest' });
          }
        } else if (week === 5) {
          // Week 6: mild soreness, nearly back to normal
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({
              type: 'train',
              sleep: 3,
              energy: 2,
              soreness: {
                ratings: { quads: 3, hamstrings: 3 },
              },
            });
          } else {
            events.push({ type: 'rest' });
          }
        } else {
          // Weeks 7-12: normal training, readaptation complete
          if (trainingDaysInWeek.includes(dayInWeek)) {
            events.push({ type: 'train' });
          } else {
            events.push({ type: 'rest' });
          }
        }
      }
    }
    return events;
  })(),
};
