import { useQuery } from '@tanstack/react-query';

import { videoQueries } from '../data/video.queries';

/**
 * Fetches all videos for a session+lift combination (all sets).
 * Used by the video analysis screen to list all set videos and
 * build the intra-session comparison overlay.
 */
export function useSessionVideos({
  sessionId,
  lift,
}: {
  sessionId: string;
  lift: string;
}) {
  const { data, isLoading } = useQuery({
    ...videoQueries.forSessionLift({ sessionId, lift }),
    enabled: !!sessionId && !!lift,
  });

  return {
    videos: data ?? [],
    isLoading,
  };
}
