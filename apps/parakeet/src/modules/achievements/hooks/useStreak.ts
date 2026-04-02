import { useAuth } from '@modules/auth';
import { useQuery } from '@tanstack/react-query';

import { achievementQueries } from '../data/achievements.queries';

/**
 * Fetches the current user's streak data for the Today screen header.
 */
export function useStreak() {
  const { user } = useAuth();
  return useQuery({
    ...achievementQueries.streak(user?.id),
    staleTime: 5 * 60 * 1000,
  });
}
