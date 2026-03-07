import type { ProgramSessionView } from '@shared/types/domain'

export type ProgramSession = ProgramSessionView

export function groupByWeek(sessions: ProgramSession[]): [number, ProgramSession[]][] {
  const map = new Map<number, ProgramSession[]>()
  for (const s of sessions) {
    if (!map.has(s.week_number)) map.set(s.week_number, [])
    map.get(s.week_number)!.push(s)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b)
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export function currentBlockNumber(
  startDate: string,
  totalWeeks: number,
): 1 | 2 | 3 {
  const weeksPassed = Math.floor(
    (Date.now() - new Date(startDate).getTime()) / MS_PER_WEEK,
  )
  const weeksPerBlock = Math.floor(totalWeeks / 3)
  const block = Math.min(3, Math.floor(weeksPassed / weeksPerBlock) + 1)
  return block as 1 | 2 | 3
}

export function unendingBlockNumber(
  sessionCounter: number,
  daysPerWeek: number,
): 1 | 2 | 3 {
  const weekNumber = Math.floor(sessionCounter / daysPerWeek) + 1
  return ((Math.floor((weekNumber - 1) / 3) % 3) + 1) as 1 | 2 | 3
}

export function determineCurrentWeek(sessions: ProgramSession[]): number {
  const activeSession = sessions.find(
    (s) => s.status === 'planned' || s.status === 'in_progress',
  )
  return activeSession?.week_number ?? 1
}
