import type { StreakResult } from '@parakeet/training-engine';
import { useQuery } from '@tanstack/react-query';

import {
  getCycleBadges,
  getPRHistory,
  getStreakData,
} from '../application/achievement.service';
import type {
  CycleBadge,
  HistoricalPRs,
} from '../application/achievement.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AchievementsData {
  badges: CycleBadge[];
  streak: StreakResult | undefined;
  prs: Record<string, HistoricalPRs | undefined>;
  isLoading: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAchievementsData(
  userId: string | undefined
): AchievementsData {
  const badgesQuery = useQuery({
    queryKey: ['achievements', 'badges', userId],
    queryFn: () => getCycleBadges(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const streakQuery = useQuery({
    queryKey: ['achievements', 'streak', userId],
    queryFn: () => getStreakData(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const squatPRsQuery = useQuery({
    queryKey: ['achievements', 'prs', userId, 'squat'],
    queryFn: () => getPRHistory(userId!, 'squat'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const benchPRsQuery = useQuery({
    queryKey: ['achievements', 'prs', userId, 'bench'],
    queryFn: () => getPRHistory(userId!, 'bench'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const deadliftPRsQuery = useQuery({
    queryKey: ['achievements', 'prs', userId, 'deadlift'],
    queryFn: () => getPRHistory(userId!, 'deadlift'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading =
    badgesQuery.isLoading ||
    streakQuery.isLoading ||
    squatPRsQuery.isLoading ||
    benchPRsQuery.isLoading ||
    deadliftPRsQuery.isLoading;

  return {
    badges: badgesQuery.data ?? [],
    streak: streakQuery.data,
    prs: {
      squat: squatPRsQuery.data,
      bench: benchPRsQuery.data,
      deadlift: deadliftPRsQuery.data,
    },
    isLoading,
  };
}
