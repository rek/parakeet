import { useCallback, useEffect, useState } from 'react';

import { captureException } from '@platform/utils/captureException';

import { getVideosForLift } from '../data/video.repository';
import type { SessionVideo } from '../model/types';

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
  const [previousVideos, setPreviousVideos] = useState<SessionVideo[]>([]);

  const load = useCallback(async () => {
    if (!lift) return;
    try {
      const videos = await getVideosForLift({ lift });
      setPreviousVideos(
        currentVideoId ? videos.filter((v) => v.id !== currentVideoId) : videos
      );
    } catch (err) {
      captureException(err);
    }
  }, [lift, currentVideoId]);

  useEffect(() => {
    load();
  }, [load]);

  return { previousVideos };
}
