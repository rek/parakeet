import { describe, it, expect } from 'vitest'
import {
  detectSessionPRs,
  computeStreak,
  checkCycleCompletion,
  PRCheckInput,
  WeekStatus,
} from './pr-detection'

// ---------------------------------------------------------------------------
// detectSessionPRs
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-001'
const LIFT = 'squat' as const

function makeInput(overrides: Partial<PRCheckInput> = {}): PRCheckInput {
  return {
    sessionId: SESSION_ID,
    lift: LIFT,
    completedSets: [],
    historicalPRs: {
      best1rmKg: 0,
      bestVolumeKgCubed: 0,
      repPRs: {},
    },
    ...overrides,
  }
}

describe('detectSessionPRs — estimated 1RM PR', () => {
  it('new 1RM (RPE 9.0, 3×140kg) → 1rm PR returned', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 140, reps: 3, rpe: 9.0, estimated1rmKg: 156 },
      ],
      historicalPRs: { best1rmKg: 150, bestVolumeKgCubed: 0, repPRs: {} },
    })
    const prs = detectSessionPRs(input)
    const pr1rm = prs.find((p) => p.type === 'estimated_1rm')
    expect(pr1rm).toBeDefined()
    expect(pr1rm?.value).toBe(156)
    expect(pr1rm?.lift).toBe('squat')
    expect(pr1rm?.sessionId).toBe(SESSION_ID)
  })

  it('existing 1RM better than new → no 1RM PR', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 140, reps: 3, rpe: 9.0, estimated1rmKg: 156 },
      ],
      historicalPRs: { best1rmKg: 160, bestVolumeKgCubed: 0, repPRs: {} },
    })
    const prs = detectSessionPRs(input)
    expect(prs.find((p) => p.type === 'estimated_1rm')).toBeUndefined()
  })

  it('RPE < 8.5 → no 1RM PR eligible', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 140, reps: 3, rpe: 8.0, estimated1rmKg: 156 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: {} },
    })
    const prs = detectSessionPRs(input)
    expect(prs.find((p) => p.type === 'estimated_1rm')).toBeUndefined()
  })

  it('RPE exactly 8.5 → eligible for 1RM PR', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 140, reps: 3, rpe: 8.5, estimated1rmKg: 152 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: {} },
    })
    const prs = detectSessionPRs(input)
    expect(prs.find((p) => p.type === 'estimated_1rm')).toBeDefined()
  })

  it('set with no RPE → not eligible for 1RM PR', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 140, reps: 3, estimated1rmKg: 156 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: {} },
    })
    const prs = detectSessionPRs(input)
    expect(prs.find((p) => p.type === 'estimated_1rm')).toBeUndefined()
  })

  it('best set across multiple is used for 1RM comparison', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 130, reps: 3, rpe: 9.0, estimated1rmKg: 145 },
        { weightKg: 140, reps: 3, rpe: 9.0, estimated1rmKg: 156 },
      ],
      historicalPRs: { best1rmKg: 150, bestVolumeKgCubed: 0, repPRs: {} },
    })
    const prs = detectSessionPRs(input)
    const pr = prs.find((p) => p.type === 'estimated_1rm')
    expect(pr?.value).toBe(156)
  })
})

describe('detectSessionPRs — volume PR', () => {
  it('higher total volume than history → volume PR returned', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 100, reps: 5 },
        { weightKg: 100, reps: 5 },
        { weightKg: 100, reps: 5 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 1400, repPRs: {} },
    })
    // volume = 100×5 × 3 = 1500
    const prs = detectSessionPRs(input)
    const pr = prs.find((p) => p.type === 'volume')
    expect(pr).toBeDefined()
    expect(pr?.value).toBe(1500)
  })

  it('lower total volume than history → no volume PR', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 100, reps: 3 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 500, repPRs: {} },
    })
    const prs = detectSessionPRs(input)
    expect(prs.find((p) => p.type === 'volume')).toBeUndefined()
  })

  it('volume exactly equal to history → no PR', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 100, reps: 5 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 500, repPRs: {} },
    })
    const prs = detectSessionPRs(input)
    expect(prs.find((p) => p.type === 'volume')).toBeUndefined()
  })
})

describe('detectSessionPRs — rep-at-weight PR', () => {
  it('6 reps at 120kg when prev best was 5 → rep PR returned', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 120, reps: 6 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: { 120: 5 } },
    })
    const prs = detectSessionPRs(input)
    const pr = prs.find((p) => p.type === 'rep_at_weight')
    expect(pr).toBeDefined()
    expect(pr?.value).toBe(6)
    expect(pr?.weightKg).toBe(120)
  })

  it('reps equal to history → no rep PR', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 120, reps: 5 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: { 120: 5 } },
    })
    const prs = detectSessionPRs(input)
    expect(prs.find((p) => p.type === 'rep_at_weight')).toBeUndefined()
  })

  it('weight rounded to nearest 2.5kg for lookup (121kg → 120kg)', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 121, reps: 7 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: { 120: 5 } },
    })
    const prs = detectSessionPRs(input)
    const pr = prs.find((p) => p.type === 'rep_at_weight')
    expect(pr).toBeDefined()
    expect(pr?.weightKg).toBe(120)
    expect(pr?.value).toBe(7)
  })

  it('multiple rep PRs same session → capped at 3', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 100, reps: 10 },
        { weightKg: 110, reps: 8 },
        { weightKg: 120, reps: 6 },
        { weightKg: 130, reps: 4 },
        { weightKg: 140, reps: 2 },
      ],
      historicalPRs: {
        best1rmKg: 0,
        bestVolumeKgCubed: 0,
        repPRs: { 100: 5, 110: 5, 120: 5, 130: 3, 140: 1 },
      },
    })
    const prs = detectSessionPRs(input)
    const repPRs = prs.filter((p) => p.type === 'rep_at_weight')
    expect(repPRs.length).toBe(3)
  })

  it('cap keeps highest-weight rep PRs', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 100, reps: 10 },
        { weightKg: 110, reps: 8 },
        { weightKg: 120, reps: 6 },
        { weightKg: 130, reps: 4 },
      ],
      historicalPRs: {
        best1rmKg: 0,
        bestVolumeKgCubed: 0,
        repPRs: { 100: 5, 110: 5, 120: 5, 130: 1 },
      },
    })
    const prs = detectSessionPRs(input)
    const repPRs = prs.filter((p) => p.type === 'rep_at_weight')
    expect(repPRs.length).toBe(3)
    const weights = repPRs.map((p) => p.weightKg)
    expect(weights).toContain(130)
    expect(weights).toContain(120)
    expect(weights).toContain(110)
  })

  it('no prior record at weight → first time counts as PR (prev best = 0)', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 150, reps: 1 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: {} },
    })
    const prs = detectSessionPRs(input)
    expect(prs.find((p) => p.type === 'rep_at_weight')).toBeDefined()
  })
})

describe('detectSessionPRs — disruption gating', () => {
  it('Major disruption active → empty result', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 140, reps: 3, rpe: 9.0, estimated1rmKg: 200 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: {} },
      activeDisruptions: [{ severity: 'major' }],
    })
    expect(detectSessionPRs(input)).toEqual([])
  })

  it('Minor disruption → PRs still count', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 140, reps: 3, rpe: 9.0, estimated1rmKg: 156 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: {} },
      activeDisruptions: [{ severity: 'minor' }],
    })
    const prs = detectSessionPRs(input)
    expect(prs.length).toBeGreaterThan(0)
  })

  it('Moderate disruption → PRs still count', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 140, reps: 3, rpe: 9.0, estimated1rmKg: 156 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: {} },
      activeDisruptions: [{ severity: 'moderate' }],
    })
    const prs = detectSessionPRs(input)
    expect(prs.length).toBeGreaterThan(0)
  })

  it('no disruptions field → PRs count normally', () => {
    const input = makeInput({
      completedSets: [
        { weightKg: 140, reps: 3, rpe: 9.0, estimated1rmKg: 156 },
      ],
      historicalPRs: { best1rmKg: 0, bestVolumeKgCubed: 0, repPRs: {} },
    })
    const prs = detectSessionPRs(input)
    expect(prs.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// computeStreak
// ---------------------------------------------------------------------------

function makeWeek(
  weekStartDate: string,
  scheduled: number,
  completed: number,
  skippedWithDisruption = 0,
  unaccountedMisses = 0,
): WeekStatus {
  return { weekStartDate, scheduled, completed, skippedWithDisruption, unaccountedMisses }
}

describe('computeStreak', () => {
  it('empty history → streak = 0', () => {
    const result = computeStreak([])
    expect(result.currentStreak).toBe(0)
    expect(result.longestStreak).toBe(0)
    expect(result.lastCleanWeekDate).toBe('')
  })

  it('5 consecutive clean weeks → currentStreak = 5', () => {
    const weeks: WeekStatus[] = [
      makeWeek('2026-01-05', 4, 4),
      makeWeek('2026-01-12', 4, 4),
      makeWeek('2026-01-19', 4, 4),
      makeWeek('2026-01-26', 4, 4),
      makeWeek('2026-02-02', 4, 4),
    ]
    const result = computeStreak(weeks)
    expect(result.currentStreak).toBe(5)
    expect(result.longestStreak).toBe(5)
  })

  it('miss in week 3 (no disruption) → currentStreak = 2, streak broken', () => {
    const weeks: WeekStatus[] = [
      makeWeek('2026-01-05', 4, 4, 0, 0),   // clean
      makeWeek('2026-01-12', 4, 4, 0, 0),   // clean
      makeWeek('2026-01-19', 4, 3, 0, 1),   // unaccounted miss → breaks streak
      makeWeek('2026-01-26', 4, 4, 0, 0),   // clean
      makeWeek('2026-02-02', 4, 4, 0, 0),   // clean
    ]
    const result = computeStreak(weeks)
    expect(result.currentStreak).toBe(2)
    expect(result.longestStreak).toBe(2)
  })

  it('disruption-logged miss does not break streak', () => {
    const weeks: WeekStatus[] = [
      makeWeek('2026-01-05', 4, 3, 1, 0),   // 1 disruption-skip, unaccountedMisses=0 → clean
      makeWeek('2026-01-12', 4, 4, 0, 0),
      makeWeek('2026-01-19', 4, 4, 0, 0),
    ]
    const result = computeStreak(weeks)
    expect(result.currentStreak).toBe(3)
  })

  it('no-show (no log, no disruption) breaks streak', () => {
    const weeks: WeekStatus[] = [
      makeWeek('2026-01-05', 4, 4, 0, 0),
      makeWeek('2026-01-12', 4, 3, 0, 1),   // unaccountedMiss → not clean
      makeWeek('2026-01-19', 4, 4, 0, 0),
    ]
    const result = computeStreak(weeks)
    expect(result.currentStreak).toBe(1)
  })

  it('gap week (scheduled=0) is skipped — neither breaks nor extends streak', () => {
    const weeks: WeekStatus[] = [
      makeWeek('2026-01-05', 4, 4, 0, 0),
      makeWeek('2026-01-12', 0, 0, 0, 0),   // gap/deload
      makeWeek('2026-01-19', 4, 4, 0, 0),
    ]
    const result = computeStreak(weeks)
    expect(result.currentStreak).toBe(2)
  })

  it('all gap weeks → streak = 0', () => {
    const weeks: WeekStatus[] = [
      makeWeek('2026-01-05', 0, 0),
      makeWeek('2026-01-12', 0, 0),
    ]
    const result = computeStreak(weeks)
    expect(result.currentStreak).toBe(0)
    expect(result.longestStreak).toBe(0)
  })

  it('longestStreak tracks the best run across full history', () => {
    const weeks: WeekStatus[] = [
      makeWeek('2026-01-05', 4, 4, 0, 0),   // clean
      makeWeek('2026-01-12', 4, 4, 0, 0),   // clean
      makeWeek('2026-01-19', 4, 4, 0, 0),   // clean  ← longest run = 3
      makeWeek('2026-01-26', 4, 3, 0, 1),   // miss
      makeWeek('2026-02-02', 4, 4, 0, 0),   // clean
      makeWeek('2026-02-09', 4, 4, 0, 0),   // clean  ← current = 2
    ]
    const result = computeStreak(weeks)
    expect(result.currentStreak).toBe(2)
    expect(result.longestStreak).toBe(3)
  })

  it('single clean week → streak = 1', () => {
    const result = computeStreak([makeWeek('2026-02-02', 3, 3)])
    expect(result.currentStreak).toBe(1)
    expect(result.longestStreak).toBe(1)
  })

  it('lastCleanWeekDate is the most recent clean week', () => {
    const weeks: WeekStatus[] = [
      makeWeek('2026-01-26', 4, 4, 0, 0),
      makeWeek('2026-02-02', 4, 4, 0, 0),
    ]
    const result = computeStreak(weeks)
    expect(result.lastCleanWeekDate).toBe('2026-02-02')
  })
})

// ---------------------------------------------------------------------------
// checkCycleCompletion
// ---------------------------------------------------------------------------

describe('checkCycleCompletion', () => {
  it('16/20 sessions completed, 0 disruptions → 80% → qualifies', () => {
    const result = checkCycleCompletion({
      totalScheduledSessions: 20,
      completedSessions: 16,
      skippedWithDisruption: 0,
    })
    expect(result.completionPct).toBe(0.8)
    expect(result.qualifiesForBadge).toBe(true)
    expect(result.isComplete).toBe(false)
  })

  it('15/20 → 75% → does not qualify', () => {
    const result = checkCycleCompletion({
      totalScheduledSessions: 20,
      completedSessions: 15,
      skippedWithDisruption: 0,
    })
    expect(result.completionPct).toBe(0.75)
    expect(result.qualifiesForBadge).toBe(false)
  })

  it('18/20 + 2 disruption-skipped → 100% → qualifies', () => {
    const result = checkCycleCompletion({
      totalScheduledSessions: 20,
      completedSessions: 18,
      skippedWithDisruption: 2,
    })
    expect(result.completionPct).toBe(1.0)
    expect(result.qualifiesForBadge).toBe(true)
    expect(result.isComplete).toBe(true)
  })

  it('0 sessions → completionPct = 0 → does not qualify', () => {
    const result = checkCycleCompletion({
      totalScheduledSessions: 0,
      completedSessions: 0,
      skippedWithDisruption: 0,
    })
    expect(result.completionPct).toBe(0)
    expect(result.qualifiesForBadge).toBe(false)
    expect(result.isComplete).toBe(false)
  })

  it('exactly 80% with disruptions counted → qualifies', () => {
    const result = checkCycleCompletion({
      totalScheduledSessions: 10,
      completedSessions: 6,
      skippedWithDisruption: 2,
    })
    expect(result.completionPct).toBe(0.8)
    expect(result.qualifiesForBadge).toBe(true)
  })

  it('isComplete = true only at 100%', () => {
    const full = checkCycleCompletion({
      totalScheduledSessions: 10,
      completedSessions: 10,
      skippedWithDisruption: 0,
    })
    expect(full.isComplete).toBe(true)

    const partial = checkCycleCompletion({
      totalScheduledSessions: 10,
      completedSessions: 9,
      skippedWithDisruption: 0,
    })
    expect(partial.isComplete).toBe(false)
  })
})
