import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { captureException } from '@platform/utils/captureException';
import * as Updates from 'expo-updates';

export type OtaStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'restarting'
  | 'up-to-date'
  | 'error';

export interface OtaUpdateMeta {
  channel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  /** Creation date of the currently running update (OTA or embedded). */
  createdAt: Date | null;
}

export interface OtaUpdateState {
  status: OtaStatus;
  error: string | null;
  meta: OtaUpdateMeta;
  /** Timestamp of the last successful check (epoch ms), or null if never checked. */
  lastCheckedAt: number | null;
  checkForUpdate: () => void;
  /** Call when status is 'ready' to reload and apply the downloaded update. */
  applyUpdate: () => void;
}

const DEBOUNCE_MS = 30_000;

function getUpdateMeta(): OtaUpdateMeta {
  return {
    channel: Updates.channel ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    updateId: Updates.updateId ?? null,
    createdAt: Updates.createdAt ?? null,
  };
}

const NOOP_STATE: OtaUpdateState = {
  status: 'idle',
  error: null,
  meta: getUpdateMeta(),
  lastCheckedAt: null,
  checkForUpdate: () => {},
  applyUpdate: () => {},
};

export function useOtaUpdates(): OtaUpdateState {
  const [status, setStatus] = useState<OtaStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const lastCheckedRef = useRef<number>(0);

  const checkAndApply = useCallback(async (force = false) => {
    if (__DEV__) return;

    const now = Date.now();
    if (!force && now - lastCheckedRef.current < DEBOUNCE_MS) return;
    lastCheckedRef.current = now;

    try {
      setError(null);
      setStatus('checking');
      const result = await Updates.checkForUpdateAsync();

      if (result.isAvailable) {
        setStatus('downloading');
        await Updates.fetchUpdateAsync();
        setStatus('ready');
      } else {
        setCheckedAt(Date.now());
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

  const applyUpdate = useCallback(() => {
    setStatus('restarting');
    Updates.reloadAsync().catch((err) => {
      captureException(err);
      setStatus('ready');
    });
  }, []);

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

  return {
    status,
    error,
    meta: getUpdateMeta(),
    lastCheckedAt: checkedAt,
    checkForUpdate,
    applyUpdate,
  };
}

export { NOOP_STATE };
