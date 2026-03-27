import { getActiveDisruptions } from '@modules/disruptions';
import {
  getProgramCompletionCounts,
  getSessionCompletionContext,
} from '@modules/session/application/session.service';
import type { Lift } from '@parakeet/shared-types';
import {
  checkCycleCompletion,
  estimateOneRepMax_Epley,
} from '@parakeet/training-engine';
import { weightGramsToKg } from '@shared/utils/weight';

import {
  getPRHistory,
  getStreakData,
  storePersonalRecords,
} from '../application/achievement.service';
import { detectBadges } from '../application/badge-detection.service';
import {
  detectSessionPRs,
  type EarnedBadge,
  type PR,
} from '../lib/engine-adapter';

export interface ActualSet {
  weight_grams: number;
  reps_completed: number;
  rpe_actual?: number;
  is_completed: boolean;
}

export interface AchievementResult {
  earnedPRs: PR[];
  streakWeeks: number | null;
  streakReset: boolean;
  cycleBadgeEarned: boolean;
  newBadges: EarnedBadge[];
}

/**
 * Detects achievements (PRs, streaks, cycle badge) after a completed session.
 * Extracted from session/complete.tsx for testability.
 */
export async function detectAchievements(
  sessionId: string,
  userId: string,
  actualSets: ActualSet[]
): Promise<AchievementResult> {
  const result: AchievementResult = {
    earnedPRs: [],
    streakWeeks: null,
    streakReset: false,
    cycleBadgeEarned: false,
    newBadges: [],
  };

  const [sessionContext, activeDisruptionRows] = await Promise.all([
    getSessionCompletionContext(sessionId),
    getActiveDisruptions(userId),
  ]);
  const lift = (sessionContext.primaryLift as Lift | null) ?? null;

  // Capture pre-upsert e1RM for "Technically a PR" badge
  const previousE1Rm: Record<string, number> = {};

  if (lift) {
    const historicalPRs = await getPRHistory(userId, lift);
    if (historicalPRs.best1rmKg > 0) {
      previousE1Rm[lift] = historicalPRs.best1rmKg;
    }

    const completedSetsForPR = actualSets
      .filter((s) => s.reps_completed > 0)
      .map((s) => ({
        weightKg: weightGramsToKg(s.weight_grams),
        reps: s.reps_completed,
        rpe: s.rpe_actual,
        estimated1rmKg:
          s.rpe_actual !== undefined &&
          s.rpe_actual >= 8.5 &&
          s.reps_completed >= 1 &&
          s.reps_completed <= 20
            ? estimateOneRepMax_Epley(
                weightGramsToKg(s.weight_grams),
                s.reps_completed
              )
            : undefined,
      }));

    const prs = detectSessionPRs({
      sessionId,
      lift,
      completedSets: completedSetsForPR,
      historicalPRs,
      activeDisruptions: activeDisruptionRows.map((d) => ({
        severity: d.severity as 'minor' | 'moderate' | 'major',
      })),
    });

    if (prs.length > 0) {
      await storePersonalRecords(userId, prs);
      result.earnedPRs = prs;
    }
  }

  const streakResult = await getStreakData(userId);
  if (streakResult.currentStreak > 0) {
    result.streakWeeks = streakResult.currentStreak;
  } else {
    result.streakReset = true;
  }

  // Unending programs have no fixed session count — cycle badge is not applicable.
  if (sessionContext.programId && sessionContext.programMode !== 'unending') {
    const { total, completed, skipped } = await getProgramCompletionCounts(
      sessionContext.programId,
      userId
    );
    const cycleResult = checkCycleCompletion({
      totalScheduledSessions: total,
      completedSessions: completed,
      skippedWithDisruption: skipped,
    });
    if (cycleResult.qualifiesForBadge) {
      result.cycleBadgeEarned = true;
    }
  }

  // Fun badges detection
  result.newBadges = await detectBadges({
    sessionId,
    userId,
    actualSets,
    earnedPRs: result.earnedPRs.map((pr) => ({
      type: pr.type,
      lift: pr.lift,
      value: pr.value,
      weightKg: pr.weightKg,
    })),
    streakWeeks: result.streakWeeks ?? 0,
    cycleBadgeEarned: result.cycleBadgeEarned,
    primaryLift: lift,
    programId: sessionContext.programId,
    previousE1Rm,
  });

  return result;
}
