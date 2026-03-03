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

export function determineCurrentWeek(sessions: ProgramSession[]): number {
  const activeSession = sessions.find(
    (s) => s.status === 'planned' || s.status === 'in_progress',
  )
  return activeSession?.week_number ?? 1
}
