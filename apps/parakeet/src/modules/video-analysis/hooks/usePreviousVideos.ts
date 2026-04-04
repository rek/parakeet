import { useQuery } from '@tanstack/react-query';

import { videoQueries } from '../data/video.queries';

/**
 * Fetches all previous videos for a given lift.
 * Excludes the current video (by ID) to avoid self-comparison.
 */
export function usePreviousVideos({
  lift,
  currentVideoId,
}: {
  lift: string;
  currentVideoId: string | null;
}) {
  const { data: previousVideos = [] } = useQuery({
    ...videoQueries.forLift({ lift }),
    select: (data) =>
      currentVideoId ? data.filter((v) => v.id !== currentVideoId) : data,
    enabled: !!lift,
  });

  return { previousVideos };
}
