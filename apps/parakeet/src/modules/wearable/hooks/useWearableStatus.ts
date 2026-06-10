import { useCallback, useEffect, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  checkPermissions,
  getHealthConnectAvailability,
  type HealthConnectAvailability,
} from '../lib/health-connect';

export interface WearableStatus {
  isAvailable: boolean;
  availability: HealthConnectAvailability;
  isPermitted: boolean;
  lastSyncAt: number | null;
  isSyncing: boolean;
}

export interface UseWearableStatusResult extends WearableStatus {
  refresh: () => Promise<void>;
}

export function useWearableStatus(): UseWearableStatusResult {
  const [state, setState] = useState<WearableStatus>({
    isAvailable: false,
    availability: 'unsupported',
    isPermitted: false,
    lastSyncAt: null,
    isSyncing: false,
  });

  const refresh = useCallback(async () => {
    try {
      const availability = await getHealthConnectAvailability();
      const isAvailable = availability === 'available';
      let perms: { granted: boolean; permissions: Record<string, boolean> } = {
        granted: false,
        permissions: {},
      };
      if (isAvailable) {
        try {
          perms = await checkPermissions();
        } catch {
          // checkPermissions can throw if Health Connect is uninitialized;
          // treat as not-permitted rather than crashing the screen.
        }
      }
      const last = await AsyncStorage.getItem('wearable_last_sync_ms');
      setState({
        isAvailable,
        availability,
        isPermitted: perms.granted,
        lastSyncAt: last ? Number(last) : null,
        isSyncing: false,
      });
    } catch {
      // Swallow — leaves state at last known value.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
