// @spec docs/features/rehab-mode/spec-app.md
import type { RehabLift } from '@parakeet/shared-types';
import { queryOptions, skipToken } from '@tanstack/react-query';

import {
  getActiveRehabCapForLift,
  getActiveRehabCaps,
  getRehabCapHistory,
} from '../application/rehab-mode.service';

export const rehabModeQueries = {
  all: () => ['rehab-mode'] as const,

  activeCaps: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...rehabModeQueries.all(), 'active', userId] as const,
      queryFn: userId ? () => getActiveRehabCaps(userId) : skipToken,
    }),

  activeForLift: (userId: string | undefined, lift: RehabLift) =>
    queryOptions({
      queryKey: [...rehabModeQueries.all(), 'active', userId, lift] as const,
      queryFn: userId ? () => getActiveRehabCapForLift(userId, lift) : skipToken,
    }),

  history: (
    userId: string | undefined,
    paging?: { page?: number; pageSize?: number }
  ) =>
    queryOptions({
      queryKey: [
        ...rehabModeQueries.all(),
        'history',
        userId,
        paging?.page ?? 0,
        paging?.pageSize ?? 20,
      ] as const,
      queryFn: userId ? () => getRehabCapHistory(userId, paging) : skipToken,
    }),
};
