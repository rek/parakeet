// @spec docs/features/achievements/spec-screen.md
import { getCurrentWilksSnapshot } from '@modules/wilks';
import { queryOptions, skipToken } from '@tanstack/react-query';

import {
  getCycleBadges,
  getPRHistory,
  getStreakData,
  getWilksHistory,
} from '../application/achievement.service';
import { BADGE_CATALOG, type BadgeId } from '../lib/engine-adapter';
import { fetchUserBadges } from './badge.repository';

export interface FunBadgeRow {
  id: BadgeId;
  name: string;
  description: string;
  emoji: string;
  flavor: string;
  earnedAt: string;
  sessionId: string | null;
}

export const achievementQueries = {
  all: () => ['achievements'] as const,

  badges: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...achievementQueries.all(), 'badges', userId] as const,
      queryFn: userId ? () => getCycleBadges(userId) : skipToken,
      staleTime: 5 * 60 * 1000,
    }),

  streak: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...achievementQueries.all(), 'streak', userId] as const,
      queryFn: userId ? () => getStreakData(userId) : skipToken,
      staleTime: 5 * 60 * 1000,
    }),

  prs: (userId: string | undefined, lift: string) =>
    queryOptions({
      queryKey: [...achievementQueries.all(), 'prs', userId, lift] as const,
      queryFn: userId
        ? () => getPRHistory(userId, lift as Parameters<typeof getPRHistory>[1])
        : skipToken,
      staleTime: 5 * 60 * 1000,
    }),

  funBadges: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...achievementQueries.all(), 'funBadges', userId] as const,
      queryFn: userId
        ? async () => {
            const rows = await fetchUserBadges(userId);
            return rows
              .map((row) => {
                const def = BADGE_CATALOG[row.badge_id as BadgeId];
                if (!def) return null;
                return {
                  id: row.badge_id as BadgeId,
                  name: def.name,
                  description: def.description,
                  emoji: def.emoji,
                  flavor: def.flavor,
                  earnedAt: row.earned_at,
                  sessionId: (row.session_id as string | null) ?? null,
                } satisfies FunBadgeRow;
              })
              .filter((b): b is FunBadgeRow => b !== null);
          }
        : skipToken,
      staleTime: 5 * 60 * 1000,
    }),

  wilksCurrent: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...achievementQueries.all(), 'wilks-current', userId] as const,
      queryFn: userId ? () => getCurrentWilksSnapshot(userId) : skipToken,
      staleTime: 5 * 60 * 1000,
    }),

  wilksHistory: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...achievementQueries.all(), 'wilks-history', userId] as const,
      queryFn: userId ? () => getWilksHistory(userId) : skipToken,
      staleTime: 10 * 60 * 1000,
    }),
};
