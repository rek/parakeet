import { queryOptions, skipToken } from '@tanstack/react-query';

import { fetchProtocolBundle, fetchProtocols } from './nutrition.repository';

export const nutritionQueries = {
  all: () => ['nutrition'] as const,

  protocols: () =>
    queryOptions({
      queryKey: [...nutritionQueries.all(), 'protocols'] as const,
      queryFn: fetchProtocols,
      staleTime: 10 * 60 * 1000,
    }),

  protocol: (slug: string) =>
    queryOptions({
      queryKey: [...nutritionQueries.all(), 'protocol', slug] as const,
      queryFn: slug ? () => fetchProtocolBundle(slug) : skipToken,
      staleTime: 10 * 60 * 1000,
    }),
};
