import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import * as Updates from 'expo-updates';

import { captureException } from '@platform/utils/captureException';

const DEBOUNCE_MS = 30_000;

export function useOtaUpdates(): { isChecking: boolean; isDownloading: boolean } {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const lastCheckedAt = useRef<number>(0);

  async function checkAndApply() {
    if (__DEV__) return;

    const now = Date.now();
    if (now - lastCheckedAt.current < DEBOUNCE_MS) return;
    lastCheckedAt.current = now;

    try {
      setIsChecking(true);
      const result = await Updates.checkForUpdateAsync();
      setIsChecking(false);

      if (result.isAvailable) {
        setIsDownloading(true);
        await Updates.fetchUpdateAsync();
        setIsDownloading(false);
        await Updates.reloadAsync();
      }
    } catch (err) {
      setIsChecking(false);
      setIsDownloading(false);
      captureException(err);
    }
  }

  useEffect(() => {
    void checkAndApply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (__DEV__) return;

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkAndApply();
      }
    });

    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isChecking, isDownloading };
}
