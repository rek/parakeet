// @spec docs/features/auth/spec-athlete-profile.md
import { useAuth } from '@modules/auth';
import { useQuery } from '@tanstack/react-query';

import { profileQueries } from '../data/profile.queries';

/**
 * Fetches the profile and bodyweight history needed by the profile editor screen.
 */
export function useProfileEditor() {
  const { user } = useAuth();

  const profileQuery = useQuery({
    ...profileQueries.current(),
    staleTime: 5 * 60 * 1000,
  });

  const bwHistoryQuery = useQuery({
    ...profileQueries.bodyweightHistory(user?.id),
    staleTime: 60 * 1000,
  });

  return {
    profile: profileQuery.data,
    bwHistory: bwHistoryQuery.data,
    isLoading: profileQuery.isLoading,
  };
}
