import { useEffect } from 'react';

import { useEvent } from 'expo';
import type { VideoPlayer } from 'expo-video';

const TIME_UPDATE_INTERVAL_SEC = 0.1;

/**
 * Subscribe to expo-video's `timeUpdate` event and return the current
 * playback time in seconds.
 *
 * Sets `timeUpdateEventInterval` to 100ms — the default is too coarse for a
 * moving overlay. 10Hz is well within RN's render budget for the small SVG
 * trees we draw and stays under perceptual lag.
 */
export function usePlaybackTime(player: VideoPlayer): number {
  useEffect(() => {
    player.timeUpdateEventInterval = TIME_UPDATE_INTERVAL_SEC;
  }, [player]);

  const event = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  return event?.currentTime ?? 0;
}
