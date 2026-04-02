import { useCallback, useEffect, useRef, useState } from 'react';

import { captureException } from '@platform/utils/captureException';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { subscribeToPartnerVideoInserts } from '../data/partner-video.repository';
import { partnerQueries } from '../data/partner.queries';
import {
  getLastSeenPartnerVideoTimestamp,
  setLastSeenPartnerVideoTimestamp,
} from '../lib/partner-video-tracking';

export function usePartnerVideoBadge() {
  const queryClient = useQueryClient();
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load last-seen timestamp from AsyncStorage on mount
  useEffect(() => {
    getLastSeenPartnerVideoTimestamp()
      .then((ts) => {
        setLastSeen(ts);
        setLoaded(true);
      })
      .catch((err) => {
        captureException(err);
        setLoaded(true);
      });
  }, []);

  const { data: count } = useQuery({
    ...partnerQueries.unseenVideoCount(lastSeen),
    enabled: loaded,
  });

  // Realtime subscription — invalidate count on new partner video inserts
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current = subscribeToPartnerVideoInserts({
      onInsert: () => {
        queryClient.invalidateQueries({
          queryKey: partnerQueries.unseenVideoCount(lastSeen).queryKey,
        });
      },
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [queryClient, lastSeen]);

  const markAsSeen = useCallback(async () => {
    const now = new Date().toISOString();
    await setLastSeenPartnerVideoTimestamp({ timestamp: now });
    setLastSeen(now);
    await queryClient.invalidateQueries({
      queryKey: partnerQueries.unseenVideoCount(now).queryKey,
    });
  }, [queryClient]);

  return {
    count: count ?? 0,
    markAsSeen,
  };
}
