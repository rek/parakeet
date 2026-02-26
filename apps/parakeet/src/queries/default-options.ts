import type { DefaultOptions } from '@tanstack/react-query';

export const queryDefaultOptions: DefaultOptions = {
  queries: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
  },
};
