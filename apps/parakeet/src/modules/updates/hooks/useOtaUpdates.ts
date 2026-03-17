import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import * as Updates from 'expo-updates';

import { captureException } from '@platform/utils/captureException';

export type OtaStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'restarting'
  | 'up-to-date'
  | 'error';

export interface OtaUpdateMeta {
  channel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
}

export interface OtaUpdateState {
  status: OtaStatus;
  error: string | null;
  meta: OtaUpdateMeta;
  checkForUpdate: () => void;
}

const DEBOUNCE_MS = 30_000;

function getUpdateMeta(): OtaUpdateMeta {
  return {
    channel: Updates.channel ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    updateId: Updates.updateId ?? null,
  };
}

const NOOP_STATE: OtaUpdateState = {
  status: 'idle',
  error: null,
  meta: getUpdateMeta(),
  checkForUpdate: () => {},
};

export function useOtaUpdates(): OtaUpdateState {
  const [status, setStatus] = useState<OtaStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const lastCheckedAt = useRef<number>(0);

  const checkAndApply = useCallback(async (force = false) => {
    if (__DEV__) return;

    const now = Date.now();
    if (!force && now - lastCheckedAt.current < DEBOUNCE_MS) return;
    lastCheckedAt.current = now;

    try {
      setError(null);
      setStatus('checking');
      const result = await Updates.checkForUpdateAsync();

      if (result.isAvailable) {
        setStatus('downloading');
        await Updates.fetchUpdateAsync();
        setStatus('restarting');
        await Updates.reloadAsync();
      } else {
        setStatus('up-to-date');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown update error';
      setError(message);
      setStatus('error');
      captureException(err);
    }
  }, []);

  const checkForUpdate = useCallback(() => {
    void checkAndApply(true);
  }, [checkAndApply]);

  useEffect(() => {
    void checkAndApply();
  }, [checkAndApply]);

  useEffect(() => {
    if (__DEV__) return;

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkAndApply();
      }
    });

    return () => sub.remove();
  }, [checkAndApply]);

  return { status, error, meta: getUpdateMeta(), checkForUpdate };
}

export { NOOP_STATE };
