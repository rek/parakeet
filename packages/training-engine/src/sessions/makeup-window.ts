import { Lift } from '@parakeet/shared-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionRef {
  id: string
  scheduledDate: string // ISO date 'YYYY-MM-DD'
  lift: Lift
  weekNumber: number
}

export interface MakeupWindowInput {
  missedSession: SessionRef
  allSessionsThisCycle: SessionRef[]
  today: Date
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse 'YYYY-MM-DD' as a local midnight Date (no UTC shift). */
function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Sunday of the week containing `date` (week starts Monday per spec: same calendar week). */
function sundayOfSameWeek(date: Date): Date {
  const d = new Date(date)
  // getDay() → 0=Sun, 1=Mon … 6=Sat
  // We want the Sunday that closes the week.  If date IS Sunday, that's itself.
  const daysUntilSunday = (7 - d.getDay()) % 7
  d.setDate(d.getDate() + daysUntilSunday)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Day before `date`, at end-of-day. */
function dayBefore(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  d.setHours(23, 59, 59, 999)
  return d
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Determines whether the makeup window for a missed session has expired.
 *
 * Rules:
 * 1. Find the next session of the same lift after missedSession.scheduledDate
 * 2. Makeup window end = day before that next session
 * 3. No next same-lift session → window end = Sunday of the missed session's week
 * 4. today > makeupWindowEnd → expired (true)
 * 5. today <= makeupWindowEnd → not expired (false)
 */
export function isMakeupWindowExpired(input: MakeupWindowInput): boolean {
  const { missedSession, allSessionsThisCycle, today } = input

  const missedDate = parseLocalDate(missedSession.scheduledDate)

  // Find next session of the same lift that occurs strictly after the missed date
  const sameLiftAfter = allSessionsThisCycle
    .filter(
      (s) =>
        s.lift === missedSession.lift &&
        s.id !== missedSession.id &&
        parseLocalDate(s.scheduledDate) > missedDate,
    )
    .sort(
      (a, b) =>
        parseLocalDate(a.scheduledDate).getTime() -
        parseLocalDate(b.scheduledDate).getTime(),
    )

  let makeupWindowEnd: Date

  if (sameLiftAfter.length > 0) {
    // Window ends the day before the next same-lift session
    const nextDate = parseLocalDate(sameLiftAfter[0].scheduledDate)
    makeupWindowEnd = dayBefore(nextDate)
  } else {
    // No next same-lift session: window ends Sunday of the missed session's week
    makeupWindowEnd = sundayOfSameWeek(missedDate)
  }

  // Normalize today to start-of-day for fair comparison
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)

  return todayStart > makeupWindowEnd
}
