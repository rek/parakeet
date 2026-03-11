export type CyclePhase =
  | 'menstrual' // days 1–5
  | 'follicular' // days 6–11
  | 'ovulatory' // days 12–16
  | 'luteal' // days 17–23
  | 'late_luteal'; // days 24–cycleLength

export interface CycleContext {
  phase: CyclePhase;
  dayOfCycle: number;
  daysUntilNextPeriod: number;
  isOvulatoryWindow: boolean;
  isLateLuteal: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getPhaseForDay(
  dayOfCycle: number,
  cycleLength = 28
): CyclePhase {
  const scaledDay =
    cycleLength === 28
      ? dayOfCycle
      : Math.round((dayOfCycle * 28) / cycleLength);

  if (scaledDay <= 5) return 'menstrual';
  if (scaledDay <= 11) return 'follicular';
  if (scaledDay <= 16) return 'ovulatory';
  if (scaledDay <= 23) return 'luteal';
  return 'late_luteal';
}

export function computeCyclePhase(
  lastPeriodStart: Date,
  cycleLength = 28,
  referenceDate?: Date
): CycleContext {
  const ref = referenceDate ?? new Date();
  const daysSincePeriodStart = Math.floor(
    (ref.getTime() - lastPeriodStart.getTime()) / MS_PER_DAY
  );
  const dayOfCycle = (daysSincePeriodStart % cycleLength) + 1;
  const daysUntilNextPeriod = cycleLength - dayOfCycle;

  const scaledDay =
    cycleLength === 28
      ? dayOfCycle
      : Math.round((dayOfCycle * 28) / cycleLength);

  return {
    phase: getPhaseForDay(dayOfCycle, cycleLength),
    dayOfCycle,
    daysUntilNextPeriod,
    isOvulatoryWindow: scaledDay >= 12 && scaledDay <= 16,
    isLateLuteal: scaledDay >= 24,
  };
}
