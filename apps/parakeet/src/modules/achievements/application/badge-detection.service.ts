import type { BadgeCheckContext } from '@parakeet/training-engine';
import {
  checkConsistencyBadges,
  checkCouplesBadges,
  checkLiftIdentityBadges,
  checkPerformanceBadges,
  checkProgramLoyaltyBadges,
  checkRestPacingBadges,
  checkRpeEffortBadges,
  checkSessionMilestoneBadges,
  checkSituationalBadges,
  checkVolumeRepBadges,
  checkWildRareBadges,
  detectStreakBreakAndRebuild,
} from '@parakeet/training-engine';

import {
  fetchAllLiftE1RMs,
  fetchBadgeProfile,
  fetchBadgeSessionLog,
  fetchCompletedSessionCount,
  fetchConsecutiveFullRestSessions,
  fetchConsistencyData,
  fetchDisruptionContext,
  fetchDisruptionsForStreak,
  fetchPartnerCompletedToday,
  fetchPreviousSession,
  fetchProgramLoyaltyData,
  fetchPrTypeCounts,
  fetchSessionsForStreak,
  fetchSorenessData,
  fetchUniqueAuxExercisesInCycle,
} from '../data/achievement.repository';
import { fetchUserBadgeIds, insertBadges } from '../data/badge.repository';
import type { ActualSet } from '../hooks/useAchievementDetection';
import {
  BADGE_CATALOG,
  type BadgeId,
  type EarnedBadge,
} from '../lib/engine-adapter';
import { buildWeekStatuses } from '../utils/week-status-builder';

// ── Types ────────────────────────────────────────────────────────────────────

interface BadgeDetectionInput {
  sessionId: string;
  userId: string;
  actualSets: ActualSet[];
  earnedPRs: Array<{
    type: string;
    lift: string;
    value: number;
    weightKg?: number;
  }>;
  streakWeeks: number;
  cycleBadgeEarned: boolean;
  primaryLift: string | null;
  programId: string | null;
  /** Pre-upsert e1RM values per lift (for "Technically a PR"). */
  previousE1Rm?: Record<string, number>;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export async function detectBadges(
  input: BadgeDetectionInput
): Promise<EarnedBadge[]> {
  const {
    sessionId,
    userId,
    actualSets,
    earnedPRs,
    streakWeeks,
    cycleBadgeEarned,
    primaryLift,
    programId,
  } = input;

  // 1. Fetch all supporting data in parallel
  const [
    alreadyEarned,
    sessionLog,
    profile,
    sessionCount,
    previousSession,
    sorenessData,
    disruptionData,
    allLiftE1RMs,
    prCounts,
    consistencyData,
    programLoyaltyData,
    uniqueAuxCount,
    consecutiveFullRest,
    streakBreakRebuild,
    partnerCompletedToday,
  ] = await Promise.all([
    fetchUserBadgeIds(userId),
    fetchBadgeSessionLog(sessionId),
    fetchBadgeProfile(userId),
    fetchCompletedSessionCount(userId),
    fetchPreviousSession(userId, sessionId),
    fetchSorenessData(sessionId),
    fetchDisruptionContext(userId),
    fetchAllLiftE1RMs(userId),
    fetchPrTypeCounts(userId),
    fetchConsistencyData(userId, sessionId, streakWeeks),
    fetchProgramLoyaltyData(userId, programId),
    fetchUniqueAuxExercisesInCycle(userId, programId),
    fetchConsecutiveFullRestSessions(userId, sessionId),
    fetchStreakBreakAndRebuild(userId),
    fetchPartnerCompletedToday(userId),
  ]);

  // 2. Pull rest seconds from set_logs (fetched alongside sessionLog)
  const logActualSets = sessionLog?.set_log_sets ?? [];

  // 3. Build context for pure checkers
  const ctx: BadgeCheckContext = {
    sessionId,
    actualSets: actualSets.map((s, i) => ({
      set_number: i + 1,
      weight_grams: s.weight_grams,
      reps_completed: s.reps_completed,
      rpe_actual: s.rpe_actual,
      actual_rest_seconds: logActualSets[i]?.actual_rest_seconds,
      is_completed: s.is_completed,
    })),
    plannedSets: (
      (Array.isArray(sessionLog?.planned_sets)
        ? sessionLog.planned_sets
        : []) as Array<Record<string, unknown>>
    ).map((s: Record<string, unknown>) => ({
      set_number: (s.set_number as number) ?? 0,
      weight_grams: (s.weight_grams as number) ?? 0,
      reps: (s.reps as number) ?? 0,
      rpe_target: s.rpe_target as number | undefined,
    })),
    startedAt: sessionLog?.started_at ?? null,
    completedAt: sessionLog?.completed_at ?? null,
    durationSeconds: sessionLog?.duration_seconds ?? null,
    primaryLift,
    isDeload: sessionLog?.is_deload ?? false,
    programId,

    earnedPRs,
    totalCompletedSessions: sessionCount,
    completedCycles: cycleBadgeEarned ? 1 : 0,
    allLiftE1RMs,
    bodyweightKg: profile?.bodyweight_kg ?? null,
    streakWeeks,

    sleepQuality: sorenessData.sleepQuality,
    energyLevel: sorenessData.energyLevel,

    hasActiveMajorDisruption: disruptionData.hasActiveMajor,
    daysSinceLastDisruption: disruptionData.daysSinceLast,
    lastDisruptionDurationDays: disruptionData.lastDurationDays,

    completedAtHour: sessionLog?.completed_at
      ? new Date(sessionLog.completed_at).getHours()
      : null,

    previousSessionWasDeload: previousSession?.is_deload ?? false,
    previousE1Rm: input.previousE1Rm ?? {},

    volumePrCount: prCounts.volumePrCount,
    oneRmPrCount: prCounts.oneRmPrCount,
    uniqueAuxExercisesInCycle: uniqueAuxCount,
    consecutiveFullRestSessions: consecutiveFullRest,
    hadStreakBreakAndRebuild: streakBreakRebuild,
    partnerCompletedToday,
  };

  // 4. Run all checkers
  const candidates: BadgeId[] = [
    ...checkPerformanceBadges(ctx),
    ...checkSituationalBadges(ctx),
    ...checkRpeEffortBadges(ctx),
    ...checkVolumeRepBadges(ctx),
    ...checkSessionMilestoneBadges(ctx),
    ...checkWildRareBadges(ctx),
    ...checkLiftIdentityBadges(ctx),
    ...checkRestPacingBadges(ctx),
    ...checkConsistencyBadges(consistencyData),
    ...checkProgramLoyaltyBadges(programLoyaltyData),
    ...checkCouplesBadges(ctx),
  ];

  // 5. Filter already earned
  const newBadgeIds = candidates.filter((id) => !alreadyEarned.has(id));
  if (newBadgeIds.length === 0) return [];

  // 6. Persist
  await insertBadges(
    userId,
    newBadgeIds.map((id) => ({ badgeId: id, sessionId }))
  );

  // 7. Return for UI
  return newBadgeIds.map((id) => {
    const def = BADGE_CATALOG[id];
    return { id, name: def.name, emoji: def.emoji, flavor: def.flavor };
  });
}

// ── Streak Break & Rebuild ──────────────────────────────────────────────────

async function fetchStreakBreakAndRebuild(userId: string): Promise<boolean> {
  const todayStr = new Date().toISOString().split('T')[0];

  const [sessions, disruptions] = await Promise.all([
    fetchSessionsForStreak(userId),
    fetchDisruptionsForStreak(userId),
  ]);

  const weekStatuses = buildWeekStatuses(sessions, disruptions, todayStr);
  return detectStreakBreakAndRebuild(weekStatuses);
}
