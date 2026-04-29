import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { captureException } from '@platform/utils/captureException';
import { useAuth } from '@modules/auth';

import { syncWearableData } from '../application/sync.service';

const LAST_SYNC_KEY = 'wearable_last_sync_ms';
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function useWearableSync(): void {
  const { user } = useAuth();
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
      lastSyncRef.current = stored ? Number(stored) : 0;
    })();

    const handleChange = async (state: AppStateStatus) => {
      if (state !== 'active' || !user) return;
      const now = Date.now();
      if (now - lastSyncRef.current < MIN_SYNC_INTERVAL_MS) return;
      lastSyncRef.current = now;
      try {
        await syncWearableData(user.id);
        await AsyncStorage.setItem(LAST_SYNC_KEY, String(now));
      } catch (err) {
        captureException(err);
      }
    };

    const sub = AppState.addEventListener('change', handleChange);
    void handleChange(AppState.currentState);

    return () => sub.remove();
  }, [user]);
}
