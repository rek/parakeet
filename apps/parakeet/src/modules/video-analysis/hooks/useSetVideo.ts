import { useQuery } from '@tanstack/react-query';

import { videoQueries } from '../data/video.queries';

/**
 * Returns whether a video exists for the given session/lift/set combination.
 * Used by SetVideoIcon to show a filled vs. empty state.
 */
export function useSetVideo({
  sessionId,
  lift,
  setNumber,
}: {
  sessionId: string;
  lift: string;
  setNumber: number;
}) {
  const { data: videos = [], isLoading } = useQuery(
    videoQueries.forSessionLiftSet({ sessionId, lift, setNumber })
  );

  return { hasVideo: videos.length > 0, isLoading };
}
