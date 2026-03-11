export const CYCLE_LENGTH_MIN = 24
export const CYCLE_LENGTH_MAX = 35

export function clampCycleLength(length: number): number {
  return Math.min(CYCLE_LENGTH_MAX, Math.max(CYCLE_LENGTH_MIN, length))
}

export function computeNextPeriodDate(lastPeriodStart: string, cycleLength: number): string {
  const d = new Date(lastPeriodStart)
  d.setDate(d.getDate() + cycleLength)
  return d.toISOString().split('T')[0]
}

export const MIN_CYCLES_FOR_PATTERNS = 2
