export type CyclePhase =
  | 'menstrual'    // days 1–5
  | 'follicular'   // days 6–11
  | 'ovulatory'    // days 12–16
  | 'luteal'       // days 17–23
  | 'late_luteal'  // days 24–cycleLength

export interface CycleContext {
  phase: CyclePhase
  dayOfCycle: number
  daysUntilNextPeriod: number
  isOvulatoryWindow: boolean
  isLateLuteal: boolean
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function computeCyclePhase(
  lastPeriodStart: Date,
  cycleLength = 28,
  referenceDate?: Date,
): CycleContext {
  const ref = referenceDate ?? new Date()
  const daysSincePeriodStart = Math.floor((ref.getTime() - lastPeriodStart.getTime()) / MS_PER_DAY)
  const dayOfCycle = (daysSincePeriodStart % cycleLength) + 1
  const daysUntilNextPeriod = cycleLength - dayOfCycle

  // Scale to 28-day equivalent before applying phase boundaries
  const scaledDay = cycleLength === 28
    ? dayOfCycle
    : Math.round(dayOfCycle * 28 / cycleLength)

  let phase: CyclePhase
  if (scaledDay <= 5)       phase = 'menstrual'
  else if (scaledDay <= 11) phase = 'follicular'
  else if (scaledDay <= 16) phase = 'ovulatory'
  else if (scaledDay <= 23) phase = 'luteal'
  else                      phase = 'late_luteal'

  return {
    phase,
    dayOfCycle,
    daysUntilNextPeriod,
    isOvulatoryWindow: scaledDay >= 12 && scaledDay <= 16,
    isLateLuteal: scaledDay >= 24,
  }
}
