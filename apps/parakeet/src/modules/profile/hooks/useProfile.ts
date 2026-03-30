import { useQuery } from '@tanstack/react-query';

import { profileQueries } from '../data/profile.queries';

/**
 * Fetches the current user's profile.
 *
 * Applies a 5-minute staleTime since profile data changes infrequently and
 * is read by several screens.
 */
export function useProfile() {
  return useQuery({
    ...profileQueries.current(),
    staleTime: 5 * 60 * 1000,
  });
}
