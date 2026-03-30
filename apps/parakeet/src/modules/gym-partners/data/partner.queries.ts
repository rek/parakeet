import { queryOptions } from '@tanstack/react-query';

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
};
