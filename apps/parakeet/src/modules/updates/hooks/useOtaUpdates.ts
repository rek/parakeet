// @spec docs/features/updates/spec-ota-updates.md
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
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

export type ReloadOutcome =
  | { type: 'applied'; updateId: string }
  | { type: 'rolled-back' };

const PENDING_RELOAD_KEY = '@parakeet/ota-pending-reload';

interface PendingReload {
  previousUpdateId: string | null;
  requestedAt: number;
}

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
  /** Outcome of the last reload attempt (set on app boot after reload). */
  reloadOutcome: ReloadOutcome | null;
  /** Dismiss the reload outcome banner. */
  dismissReloadOutcome: () => void;
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
  reloadOutcome: null,
  dismissReloadOutcome: () => {},
  checkForUpdate: () => {},
  applyUpdate: () => {},
};

export function useOtaUpdates(): OtaUpdateState {
  const [status, setStatus] = useState<OtaStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [reloadOutcome, setReloadOutcome] = useState<ReloadOutcome | null>(
    null
  );
  const lastCheckedRef = useRef<number>(0);
  const statusRef = useRef<OtaStatus>('idle');

  // On boot: detect outcome of any pending reload from a previous session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_RELOAD_KEY);
        if (!raw || cancelled) return;
        // Await the remove BEFORE computing outcome so a crash mid-boot can't
        // double-process the same pending reload on next launch.
        await AsyncStorage.removeItem(PENDING_RELOAD_KEY);
        let pending: PendingReload;
        try {
          pending = JSON.parse(raw);
        } catch (err) {
          captureException(err);
          return;
        }
        const current = Updates.updateId ?? null;
        if (current && current !== pending.previousUpdateId) {
          setReloadOutcome({ type: 'applied', updateId: current });
        } else {
          setReloadOutcome({ type: 'rolled-back' });
          captureException(
            new Error(
              `OTA reload rolled back: previous=${pending.previousUpdateId ?? 'embedded'} current=${current ?? 'embedded'}`
            )
          );
        }
      } catch (err) {
        captureException(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissReloadOutcome = useCallback(() => {
    setReloadOutcome(null);
  }, []);

  const updateStatus = useCallback((next: OtaStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const checkAndApply = useCallback(async (force = false) => {
    if (__DEV__) return;
    if (statusRef.current === 'ready' || statusRef.current === 'restarting') return;

    const now = Date.now();
    if (!force && now - lastCheckedRef.current < DEBOUNCE_MS) return;
    lastCheckedRef.current = now;

    try {
      setError(null);
      updateStatus('checking');
      const result = await Updates.checkForUpdateAsync();

      if (result.isAvailable) {
        updateStatus('downloading');
        await Updates.fetchUpdateAsync();
        setCheckedAt(Date.now());
        updateStatus('ready');
      } else {
        setCheckedAt(Date.now());
        updateStatus('up-to-date');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown update error';
      setError(message);
      updateStatus('error');
      captureException(err);
    }
  }, [updateStatus]);

  const checkForUpdate = useCallback(() => {
    void checkAndApply(true);
  }, [checkAndApply]);

  const applyUpdate = useCallback(async () => {
    updateStatus('restarting');
    const pending: PendingReload = {
      previousUpdateId: Updates.updateId ?? null,
      requestedAt: Date.now(),
    };
    try {
      await AsyncStorage.setItem(PENDING_RELOAD_KEY, JSON.stringify(pending));
    } catch (err) {
      captureException(err);
    }
    Updates.reloadAsync({
      reloadScreenOptions: {
        backgroundColor: '#100a11',
        image: require('../../../../assets/images/splash.png'),
        imageFullScreen: true,
        spinner: { enabled: true, color: '#ffffff', size: 'large' },
        fade: true,
      },
    }).catch((err) => {
      captureException(err);
      AsyncStorage.removeItem(PENDING_RELOAD_KEY).catch((removeErr) => {
        captureException(removeErr);
      });
      updateStatus('ready');
    });
  }, [updateStatus]);

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
    reloadOutcome,
    dismissReloadOutcome,
    checkForUpdate,
    applyUpdate,
  };
}

export { NOOP_STATE };
