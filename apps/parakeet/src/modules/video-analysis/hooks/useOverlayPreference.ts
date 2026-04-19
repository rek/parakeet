import { useCallback, useEffect, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureException } from '@platform/utils/captureException';

export type OverlayPreferenceKey = 'barPath' | 'skeleton';

const STORAGE_PREFIX = 'video.overlay.';

/**
 * Persisted toggle for a single overlay type (bar path or skeleton).
 *
 * Stored per-key in AsyncStorage so the lifter doesn't re-toggle every replay.
 * Default is `false` — overlays are opinionated and can occlude the bar, so
 * off-by-default avoids surprising users who just want playback.
 */
export function useOverlayPreference(
  key: OverlayPreferenceKey
): [enabled: boolean, setEnabled: (value: boolean) => void] {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`)
      .then((raw) => {
        if (!cancelled && raw === 'true') {
          setEnabledState(true);
        }
      })
      .catch(captureException);
    return () => {
      cancelled = true;
    };
  }, [key]);

  const setEnabled = useCallback(
    (value: boolean) => {
      setEnabledState(value);
      AsyncStorage.setItem(
        `${STORAGE_PREFIX}${key}`,
        value ? 'true' : 'false'
      ).catch(captureException);
    },
    [key]
  );

  return [enabled, setEnabled];
}
