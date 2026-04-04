import { queryOptions } from '@tanstack/react-query';

import {
  getVideoForSessionLift,
  getVideosForLift,
  getVideosForSessionLift,
} from './video.repository';

export const videoQueries = {
  all: () => ['video-analysis'] as const,

  forSessionLiftSet: ({
    sessionId,
    lift,
    setNumber,
  }: {
    sessionId: string;
    lift: string;
    setNumber: number;
  }) =>
    queryOptions({
      queryKey: [
        ...videoQueries.all(),
        'session',
        sessionId,
        'lift',
        lift,
        'set',
        setNumber,
      ] as const,
      queryFn: () => getVideoForSessionLift({ sessionId, lift, setNumber }),
    }),

  forSessionLift: ({ sessionId, lift }: { sessionId: string; lift: string }) =>
    queryOptions({
      queryKey: [
        ...videoQueries.all(),
        'session',
        sessionId,
        'lift',
        lift,
        'all',
      ] as const,
      queryFn: () => getVideosForSessionLift({ sessionId, lift }),
    }),

  forLift: ({ lift }: { lift: string }) =>
    queryOptions({
      queryKey: [...videoQueries.all(), 'lift', lift] as const,
      queryFn: () => getVideosForLift({ lift }),
    }),
};
