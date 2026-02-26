import { Lift, Severity } from '@parakeet/shared-types'

// ---------------------------------------------------------------------------
// PR Detection (engine-022)
// ---------------------------------------------------------------------------

export type PRType = 'estimated_1rm' | 'volume' | 'rep_at_weight'

export interface PR {
  type: PRType
  lift: Lift
  value: number        // kg for 1rm, kg (total volume) for volume, reps for rep_at_weight
  weightKg?: number    // only for rep_at_weight
  sessionId: string
  achievedAt: string   // ISO timestamp
}

export interface PRCheckInput {
  sessionId: string
  lift: Lift
  completedSets: Array<{
    weightKg: number
    reps: number
    rpe?: number
    estimated1rmKg?: number   // pre-computed by engine-001 if RPE was logged
  }>
  historicalPRs: {
    best1rmKg: number
    bestVolumeKgCubed: number          // max single-session sets×reps×weight
    repPRs: Record<number, number>     // weightKg → best reps ever at that weight
  }
  /** Active disruptions for this session — Major disruption suppresses all PRs */
  activeDisruptions?: Array<{ severity: Severity }>
}

const REP_PR_CAP = 3
const RPE_ELIGIBILITY_THRESHOLD = 8.5
const WEIGHT_ROUND_INCREMENT = 2.5

function roundToNearest2_5(weightKg: number): number {
  return Math.round(weightKg / WEIGHT_ROUND_INCREMENT) * WEIGHT_ROUND_INCREMENT
}

function hasMajorDisruption(disruptions: Array<{ severity: Severity }> | undefined): boolean {
  return (disruptions ?? []).some((d) => d.severity === 'major')
}

/**
 * Detect personal records earned during a single session.
 *
 * Returns up to one 1RM PR, one volume PR, and up to REP_PR_CAP rep-at-weight
 * PRs. Sessions with an active Major disruption return an empty array.
 */
export function detectSessionPRs(input: PRCheckInput): PR[] {
  const { sessionId, lift, completedSets, historicalPRs, activeDisruptions } = input

  if (hasMajorDisruption(activeDisruptions)) {
    return []
  }

  const achievedAt = new Date().toISOString()
  const results: PR[] = []

  // --- Estimated 1RM PR ---
  const best1rmSet = completedSets
    .filter((s) => s.rpe !== undefined && s.rpe >= RPE_ELIGIBILITY_THRESHOLD && s.estimated1rmKg !== undefined)
    .reduce<{ estimated1rmKg: number } | null>((best, s) => {
      const e1rm = s.estimated1rmKg as number
      if (best === null || e1rm > best.estimated1rmKg) return { estimated1rmKg: e1rm }
      return best
    }, null)

  if (best1rmSet !== null && best1rmSet.estimated1rmKg > historicalPRs.best1rmKg) {
    results.push({
      type: 'estimated_1rm',
      lift,
      value: best1rmSet.estimated1rmKg,
      sessionId,
      achievedAt,
    })
  }

  // --- Volume PR ---
  const sessionVolume = completedSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0)
  if (sessionVolume > historicalPRs.bestVolumeKgCubed) {
    results.push({
      type: 'volume',
      lift,
      value: sessionVolume,
      sessionId,
      achievedAt,
    })
  }

  // --- Rep-at-weight PRs (capped at REP_PR_CAP) ---
  // Collect unique weights with their best rep count for this session
  const sessionBestReps = new Map<number, number>()
  for (const s of completedSets) {
    const roundedWeight = roundToNearest2_5(s.weightKg)
    const current = sessionBestReps.get(roundedWeight) ?? 0
    if (s.reps > current) sessionBestReps.set(roundedWeight, s.reps)
  }

  const repPRs: PR[] = []
  for (const [roundedWeight, bestReps] of sessionBestReps) {
    const prevBest = historicalPRs.repPRs[roundedWeight] ?? 0
    if (bestReps > prevBest) {
      repPRs.push({
        type: 'rep_at_weight',
        lift,
        value: bestReps,
        weightKg: roundedWeight,
        sessionId,
        achievedAt,
      })
    }
  }

  // Suppress lower-significance ones if many detected — keep highest-weight PRs
  const cappedRepPRs = repPRs
    .sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0))
    .slice(0, REP_PR_CAP)

  results.push(...cappedRepPRs)

  return results
}

// ---------------------------------------------------------------------------
// Streak Calculation (engine-022)
// ---------------------------------------------------------------------------

export interface WeekStatus {
  weekStartDate: string        // ISO Monday
  scheduled: number
  completed: number
  skippedWithDisruption: number
  unaccountedMisses: number
}

export interface StreakResult {
  currentStreak: number        // consecutive clean weeks
  longestStreak: number
  lastCleanWeekDate: string
}

/**
 * A week is "clean" when it has scheduled sessions and zero unaccounted misses.
 * Weeks with no scheduled sessions are skipped — they neither break nor extend.
 * Walk backwards from the most recent entry to compute currentStreak.
 */
export function computeStreak(weekHistory: WeekStatus[]): StreakResult {
  if (weekHistory.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastCleanWeekDate: '' }
  }

  const isClean = (w: WeekStatus) => w.scheduled > 0 && w.unaccountedMisses === 0
  const hasScheduled = (w: WeekStatus) => w.scheduled > 0

  // Walk backwards to find currentStreak
  let currentStreak = 0
  let lastCleanWeekDate = ''
  for (let i = weekHistory.length - 1; i >= 0; i--) {
    const week = weekHistory[i]
    if (!hasScheduled(week)) continue   // skip gap weeks
    if (!isClean(week)) break           // streak broken
    currentStreak++
    if (lastCleanWeekDate === '') lastCleanWeekDate = week.weekStartDate
  }

  // Compute longestStreak across full history
  let longestStreak = 0
  let run = 0
  for (const week of weekHistory) {
    if (!hasScheduled(week)) continue   // skip gap weeks
    if (isClean(week)) {
      run++
      if (run > longestStreak) longestStreak = run
    } else {
      run = 0
    }
  }

  return { currentStreak, longestStreak, lastCleanWeekDate }
}

// ---------------------------------------------------------------------------
// Cycle Completion Detection (engine-022)
// ---------------------------------------------------------------------------

export interface CycleCompletionInput {
  totalScheduledSessions: number
  completedSessions: number
  skippedWithDisruption: number
}

export interface CycleCompletionResult {
  isComplete: boolean
  completionPct: number
  qualifiesForBadge: boolean    // completionPct >= 0.80
}

/**
 * Computes cycle completion percentage and badge eligibility.
 * Disruption-skipped sessions count toward completion.
 */
export function checkCycleCompletion(input: CycleCompletionInput): CycleCompletionResult {
  const { totalScheduledSessions, completedSessions, skippedWithDisruption } = input

  if (totalScheduledSessions === 0) {
    return { isComplete: false, completionPct: 0, qualifiesForBadge: false }
  }

  const completionPct = (completedSessions + skippedWithDisruption) / totalScheduledSessions
  const qualifiesForBadge = completionPct >= 0.80
  const isComplete = completionPct >= 1.0

  return { isComplete, completionPct, qualifiesForBadge }
}
