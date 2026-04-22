import { useQuery } from '@tanstack/react-query';

import type { CompletedSessionRef } from '../application/motivational-message.service';
import {
  fetchMotivationalContext,
  generateMotivationalMessage,
} from '../application/motivational-message.service';
import { sessionQueries } from '../data/session.queries';

/**
 * Fetches (or generates) the post-workout motivational message for a set of
 * completed sessions.
 *
 * The query is skipped when `enabled` is false, and results are cached
 * permanently for the session set (staleTime: Infinity).
 */
export function useMotivationalMessage({
  sessions,
  currentStreak,
  cyclePhase,
  userId,
  enabled,
}: {
  sessions: CompletedSessionRef[];
  currentStreak: number;
  cyclePhase: string | null;
  userId: string;
  enabled: boolean;
}) {
  const sessionIds = sessions.map((s) => s.id);

  return useQuery({
    queryKey: sessionQueries.motivationalMessage(sessionIds),
    queryFn: async () => {
      const ctx = await fetchMotivationalContext(
        sessions,
        currentStreak,
        cyclePhase,
        userId
      );
      return generateMotivationalMessage(ctx, sessionIds, userId);
    },
    staleTime: Infinity,
    retry: false,
    enabled,
  });
}
