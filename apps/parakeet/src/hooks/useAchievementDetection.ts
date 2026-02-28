import {
  detectSessionPRs,
  checkCycleCompletion,
  estimateOneRepMax_Epley,
} from '@parakeet/training-engine'
import type { PR } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import {
  getSessionCompletionContext,
  getProgramCompletionCounts,
} from '../lib/sessions'
import { getPRHistory, getStreakData, storePersonalRecords } from '../lib/achievements'

export interface ActualSet {
  weight_grams: number
  reps_completed: number
  rpe_actual?: number
  is_completed: boolean
}

export interface AchievementResult {
  earnedPRs: PR[]
  streakWeeks: number | null
  streakReset: boolean
  cycleBadgeEarned: boolean
}

/**
 * Detects achievements (PRs, streaks, cycle badge) after a completed session.
 * Extracted from session/complete.tsx for testability.
 */
export async function detectAchievements(
  sessionId: string,
  userId: string,
  actualSets: ActualSet[],
): Promise<AchievementResult> {
  const result: AchievementResult = {
    earnedPRs: [],
    streakWeeks: null,
    streakReset: false,
    cycleBadgeEarned: false,
  }

  const sessionContext = await getSessionCompletionContext(sessionId)
  const lift = (sessionContext.primaryLift as Lift | null) ?? null

  if (lift) {
    const historicalPRs = await getPRHistory(userId, lift)
    const completedSetsForPR = actualSets
      .filter((s) => s.reps_completed > 0)
      .map((s) => ({
        weightKg:       s.weight_grams / 1000,
        reps:           s.reps_completed,
        rpe:            s.rpe_actual,
        estimated1rmKg: s.rpe_actual !== undefined && s.rpe_actual >= 8.5
          && s.reps_completed >= 1 && s.reps_completed <= 20
          ? estimateOneRepMax_Epley(s.weight_grams / 1000, s.reps_completed)
          : undefined,
      }))

    const prs = detectSessionPRs({
      sessionId,
      lift,
      completedSets: completedSetsForPR,
      historicalPRs,
    })

    if (prs.length > 0) {
      await storePersonalRecords(userId, prs)
      result.earnedPRs = prs
    }
  }

  const streakResult = await getStreakData(userId)
  if (streakResult.currentStreak > 0) {
    result.streakWeeks = streakResult.currentStreak
  } else {
    result.streakReset = true
  }

  if (sessionContext.programId) {
    const { total, completed, skipped } = await getProgramCompletionCounts(
      sessionContext.programId,
      userId,
    )
    const cycleResult = checkCycleCompletion({
      totalScheduledSessions: total,
      completedSessions:      completed,
      skippedWithDisruption:  skipped,
    })
    if (cycleResult.qualifiesForBadge) {
      result.cycleBadgeEarned = true
    }
  }

  return result
}
