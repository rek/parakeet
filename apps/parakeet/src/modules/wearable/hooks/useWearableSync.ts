import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { captureException } from '@platform/utils/captureException';
import { useAuth } from '@modules/auth';

import { syncWearableData } from '../application/sync.service';

const LAST_SYNC_KEY = 'wearable_last_sync_ms';
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Foreground sync hook — mounted once at the root layout. Throttles via the
 * shared `LAST_SYNC_KEY` AsyncStorage timestamp so a concurrent
 * `useEnsureFreshSnapshot` (mounted on the soreness screen) cannot race it
 * into a double sync. The throttle is re-read from storage on every change
 * event; an in-memory cache would miss writes from the other hook.
 *
 * Cold-start coverage on the soreness route is handled by
 * `useEnsureFreshSnapshot`, so this hook intentionally does NOT fire on its
 * initial mount — only on subsequent AppState transitions to `active`.
 */
export function useWearableSync(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const handleChange = async (state: AppStateStatus) => {
      if (state !== 'active' || !user) return;
      const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
      const lastSync = stored ? Number(stored) : 0;
      const now = Date.now();
      if (now - lastSync < MIN_SYNC_INTERVAL_MS) return;
      try {
        // Stamp before syncing so a concurrent throttle-check sees us in
        // flight and skips. Stamp again on success to extend the throttle
        // window past the sync duration.
        await AsyncStorage.setItem(LAST_SYNC_KEY, String(now));
        await syncWearableData(user.id);
        await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      } catch (err) {
        captureException(err);
      }
    };

    const sub = AppState.addEventListener('change', handleChange);
    // No initial-mount call — `useEnsureFreshSnapshot` handles cold-start on
    // the check-in path. Background→foreground transitions still fire here.

    return () => sub.remove();
  }, [user]);
}
