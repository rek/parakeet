import { useQuery } from '@tanstack/react-query';

import type {
  CycleBadge,
  HistoricalPRs,
} from '../application/achievement.service';
import {
  achievementQueries,
  type FunBadgeRow,
} from '../data/achievements.queries';
import type { StreakResult } from '../lib/engine-adapter';

export type { FunBadgeRow };

export interface AchievementsData {
  badges: CycleBadge[];
  streak: StreakResult | undefined;
  prs: Record<string, HistoricalPRs | undefined>;
  funBadges: FunBadgeRow[];
  isLoading: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAchievementsData(
  userId: string | undefined
): AchievementsData {
  const badgesQuery = useQuery(achievementQueries.badges(userId));
  const streakQuery = useQuery(achievementQueries.streak(userId));
  const squatPRsQuery = useQuery(achievementQueries.prs(userId, 'squat'));
  const benchPRsQuery = useQuery(achievementQueries.prs(userId, 'bench'));
  const deadliftPRsQuery = useQuery(achievementQueries.prs(userId, 'deadlift'));
  const funBadgesQuery = useQuery(achievementQueries.funBadges(userId));

  const isLoading =
    badgesQuery.isLoading ||
    streakQuery.isLoading ||
    squatPRsQuery.isLoading ||
    benchPRsQuery.isLoading ||
    deadliftPRsQuery.isLoading ||
    funBadgesQuery.isLoading;

  return {
    badges: badgesQuery.data ?? [],
    streak: streakQuery.data,
    prs: {
      squat: squatPRsQuery.data,
      bench: benchPRsQuery.data,
      deadlift: deadliftPRsQuery.data,
    },
    funBadges: funBadgesQuery.data ?? [],
    isLoading,
  };
}
