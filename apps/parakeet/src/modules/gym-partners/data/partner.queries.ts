// @spec docs/features/social/spec-db-foundation.md
import { queryOptions } from '@tanstack/react-query';

import { fetchPartnerActiveSession } from './partner-session.repository';
import { fetchUnseenPartnerVideoCount } from './partner-video.repository';
import {
  fetchAcceptedPartners,
  fetchPendingIncomingRequests,
} from './partner.repository';

export const partnerQueries = {
  all: () => ['gym-partners'] as const,

  list: () =>
    queryOptions({
      queryKey: [...partnerQueries.all(), 'list'] as const,
      queryFn: fetchAcceptedPartners,
    }),

  pendingRequests: () =>
    queryOptions({
      queryKey: [...partnerQueries.all(), 'pending'] as const,
      queryFn: fetchPendingIncomingRequests,
    }),

  partnerSession: (partnerId: string) =>
    queryOptions({
      queryKey: [...partnerQueries.all(), 'session', partnerId] as const,
      queryFn: () => fetchPartnerActiveSession({ partnerId }),
      refetchInterval: false,
    }),

  unseenVideoCount: (sinceTimestamp: string | null) =>
    queryOptions({
      queryKey: [
        ...partnerQueries.all(),
        'unseen-videos',
        sinceTimestamp,
      ] as const,
      queryFn: () => fetchUnseenPartnerVideoCount({ sinceTimestamp }),
    }),
};
