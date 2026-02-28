export interface ProgramSession {
  id: string
  day_number: number
  primary_lift: string
  intensity_type: string
  planned_date: string
  completed_at: string | null
  status: string
  block_number: number | null
  week_number: number
}

/** Groups sessions by week_number, sorted ascending. */
export function groupByWeek(sessions: ProgramSession[]): [number, ProgramSession[]][] {
  const map = new Map<number, ProgramSession[]>()
  for (const s of sessions) {
    if (!map.has(s.week_number)) map.set(s.week_number, [])
    map.get(s.week_number)!.push(s)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b)
}

/** Returns the week_number of the first planned or in_progress session, defaulting to 1. */
export function determineCurrentWeek(sessions: ProgramSession[]): number {
  const activeSession = sessions.find(
    (s) => s.status === 'planned' || s.status === 'in_progress',
  )
  return activeSession?.week_number ?? 1
}
