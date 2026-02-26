import { isMakeupWindowExpired, MakeupWindowInput, SessionRef } from './makeup-window'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(
  id: string,
  scheduledDate: string,
  lift: 'squat' | 'bench' | 'deadlift',
  weekNumber = 1,
): SessionRef {
  return { id, scheduledDate, lift, weekNumber }
}

function date(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ---------------------------------------------------------------------------
// Spec test cases
// ---------------------------------------------------------------------------

describe('isMakeupWindowExpired — spec cases', () => {
  // Spec: Missed Monday squat, next squat Friday → window ends Thursday → today=Wednesday → not expired
  it('missed Monday squat, next squat Friday, today=Wednesday → not expired', () => {
    const missedSession = makeSession('s1', '2026-02-23', 'squat') // Monday
    const nextSquat = makeSession('s2', '2026-02-27', 'squat')     // Friday
    const input: MakeupWindowInput = {
      missedSession,
      allSessionsThisCycle: [missedSession, nextSquat],
      today: date('2026-02-25'), // Wednesday
    }
    expect(isMakeupWindowExpired(input)).toBe(false)
  })

  // Spec: Missed Monday squat, next squat Friday → today=Friday → expired
  it('missed Monday squat, next squat Friday, today=Friday → expired', () => {
    const missedSession = makeSession('s1', '2026-02-23', 'squat') // Monday
    const nextSquat = makeSession('s2', '2026-02-27', 'squat')     // Friday
    const input: MakeupWindowInput = {
      missedSession,
      allSessionsThisCycle: [missedSession, nextSquat],
      today: date('2026-02-27'), // Friday (same as next session)
    }
    expect(isMakeupWindowExpired(input)).toBe(true)
  })

  // Spec: Missed last squat of cycle → window = end of same week
  it('missed last squat of cycle → window = Sunday of same week → today=Sunday → not expired', () => {
    const missedSession = makeSession('s1', '2026-02-23', 'squat', 3) // Monday week 3
    // Only a bench session exists after; no next squat
    const bench = makeSession('s2', '2026-02-25', 'bench', 3)
    const input: MakeupWindowInput = {
      missedSession,
      allSessionsThisCycle: [missedSession, bench],
      today: date('2026-03-01'), // Sunday of same week (Mon 2/23 → Sun 3/1)
    }
    expect(isMakeupWindowExpired(input)).toBe(false)
  })

  it('missed last squat of cycle → window = Sunday → today=Monday after → expired', () => {
    const missedSession = makeSession('s1', '2026-02-23', 'squat', 3) // Monday
    const bench = makeSession('s2', '2026-02-25', 'bench', 3)
    const input: MakeupWindowInput = {
      missedSession,
      allSessionsThisCycle: [missedSession, bench],
      today: date('2026-03-02'), // Monday — day after Sunday
    }
    expect(isMakeupWindowExpired(input)).toBe(true)
  })

  // Spec: Missed session, no next session of that lift → window = Sunday of same week
  it('no next session of that lift → window = Sunday of same week', () => {
    const missedSession = makeSession('s1', '2026-02-24', 'deadlift') // Tuesday
    const input: MakeupWindowInput = {
      missedSession,
      allSessionsThisCycle: [missedSession],
      today: date('2026-03-01'), // Sunday of the same week
    }
    // Tuesday 2/24: getDay()=2, days until Sunday = 7-2=5 → Sunday 3/1
    expect(isMakeupWindowExpired(input)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('isMakeupWindowExpired — edge cases', () => {
  it('today = day before next same-lift session → not expired (last day of window)', () => {
    const missed = makeSession('s1', '2026-02-23', 'bench')  // Monday
    const next = makeSession('s2', '2026-02-26', 'bench')    // Thursday
    // Window ends Wednesday 2/25
    const input: MakeupWindowInput = {
      missedSession: missed,
      allSessionsThisCycle: [missed, next],
      today: date('2026-02-25'), // Wednesday — last valid day
    }
    expect(isMakeupWindowExpired(input)).toBe(false)
  })

  it('today = next same-lift session day → expired', () => {
    const missed = makeSession('s1', '2026-02-23', 'bench')
    const next = makeSession('s2', '2026-02-26', 'bench')
    const input: MakeupWindowInput = {
      missedSession: missed,
      allSessionsThisCycle: [missed, next],
      today: date('2026-02-26'),
    }
    expect(isMakeupWindowExpired(input)).toBe(true)
  })

  it('other-lift sessions after missed do not affect window end', () => {
    const missed = makeSession('s1', '2026-02-23', 'squat')
    const benchSession = makeSession('s2', '2026-02-24', 'bench') // next day but different lift
    // No next squat → window = Sunday of missed week
    const input: MakeupWindowInput = {
      missedSession: missed,
      allSessionsThisCycle: [missed, benchSession],
      today: date('2026-02-25'), // Wednesday — still within Sunday window
    }
    expect(isMakeupWindowExpired(input)).toBe(false)
  })

  it('multiple same-lift sessions after: picks the soonest', () => {
    const missed = makeSession('s1', '2026-02-23', 'squat')     // Monday
    const next1 = makeSession('s2', '2026-02-27', 'squat')      // Friday
    const next2 = makeSession('s3', '2026-03-02', 'squat')      // following Monday
    // Window ends Thursday 2/26 (day before Friday)
    const input: MakeupWindowInput = {
      missedSession: missed,
      allSessionsThisCycle: [missed, next2, next1], // unsorted intentionally
      today: date('2026-02-26'), // Thursday — should be last valid day
    }
    expect(isMakeupWindowExpired(input)).toBe(false)
  })

  it('multiple same-lift sessions after: today = Friday → expired', () => {
    const missed = makeSession('s1', '2026-02-23', 'squat')
    const next1 = makeSession('s2', '2026-02-27', 'squat')
    const next2 = makeSession('s3', '2026-03-02', 'squat')
    const input: MakeupWindowInput = {
      missedSession: missed,
      allSessionsThisCycle: [missed, next2, next1],
      today: date('2026-02-27'),
    }
    expect(isMakeupWindowExpired(input)).toBe(true)
  })

  it('missed session on Saturday → Sunday is same day as end of week → not expired', () => {
    const missed = makeSession('s1', '2026-02-28', 'deadlift') // Saturday
    // No next deadlift → window = Sunday 3/1
    const input: MakeupWindowInput = {
      missedSession: missed,
      allSessionsThisCycle: [missed],
      today: date('2026-03-01'), // Sunday
    }
    expect(isMakeupWindowExpired(input)).toBe(false)
  })

  it('missed session on Saturday → expired on Monday', () => {
    const missed = makeSession('s1', '2026-02-28', 'deadlift')
    const input: MakeupWindowInput = {
      missedSession: missed,
      allSessionsThisCycle: [missed],
      today: date('2026-03-02'), // Monday
    }
    expect(isMakeupWindowExpired(input)).toBe(true)
  })

  it('missed session on Sunday → same-day Sunday → not expired', () => {
    const missed = makeSession('s1', '2026-03-01', 'bench') // Sunday
    const input: MakeupWindowInput = {
      missedSession: missed,
      allSessionsThisCycle: [missed],
      today: date('2026-03-01'), // same Sunday (makeup attempted immediately)
    }
    // sunday of same week: getDay()=0 → (7-0)%7=0 → no offset → same day
    expect(isMakeupWindowExpired(input)).toBe(false)
  })

  it('sessions before missed date of same lift are ignored', () => {
    const earlier = makeSession('s0', '2026-02-16', 'squat')   // prior week
    const missed = makeSession('s1', '2026-02-23', 'squat')    // Monday
    const next = makeSession('s2', '2026-02-27', 'squat')      // Friday
    const input: MakeupWindowInput = {
      missedSession: missed,
      allSessionsThisCycle: [earlier, missed, next],
      today: date('2026-02-25'), // Wednesday — within window
    }
    expect(isMakeupWindowExpired(input)).toBe(false)
  })
})
