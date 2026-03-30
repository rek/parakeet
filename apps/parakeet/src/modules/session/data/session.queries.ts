import { queryOptions, skipToken } from '@tanstack/react-query';

import {
  findTodaySession,
  findTodaySessions,
  getCompletedSessions,
  getInProgressSession,
  getSession,
  getSessionLog,
} from '../application/session.service';

export const sessionQueries = {
  all: () => ['session'] as const,

  today: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...sessionQueries.all(), 'today', userId] as const,
      queryFn: userId ? () => findTodaySession(userId) : skipToken,
    }),

  todayAll: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...sessionQueries.all(), 'today', userId, 'all'] as const,
      queryFn: userId ? () => findTodaySessions(userId) : skipToken,
    }),

  detail: (sessionId: string) =>
    queryOptions({
      queryKey: [...sessionQueries.all(), 'detail', sessionId] as const,
      queryFn: () => getSession(sessionId),
    }),

  log: (sessionId: string) =>
    queryOptions({
      queryKey: [...sessionQueries.all(), 'log', sessionId] as const,
      queryFn: () => getSessionLog(sessionId),
    }),

  inProgress: (userId: string | undefined) =>
    queryOptions({
      queryKey: [...sessionQueries.all(), 'in-progress', userId] as const,
      queryFn: userId ? () => getInProgressSession(userId) : skipToken,
    }),

  completed: (userId: string | undefined, offset: number, limit: number) =>
    queryOptions({
      queryKey: [
        ...sessionQueries.all(),
        'completed',
        userId,
        offset,
        limit,
      ] as const,
      queryFn: userId
        ? () => getCompletedSessions(userId, offset, limit)
        : skipToken,
    }),

  motivationalMessage: (sessionIds: string[]) =>
    [...sessionQueries.all(), 'motivational-message', ...sessionIds] as const,
};
