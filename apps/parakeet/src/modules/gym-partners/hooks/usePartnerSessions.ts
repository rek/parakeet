// @spec docs/features/social/spec-session-visibility.md
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useQueries, useQueryClient } from '@tanstack/react-query';

import { subscribeToPartnerSessions } from '../data/partner-session.repository';
import { partnerQueries } from '../data/partner.queries';
import type { GymPartner } from '../model/types';
import { usePartners } from './usePartners';

export interface PartnerWithSession extends GymPartner {
  activeSession: {
    id: string;
    primaryLift: string | null;
    plannedSets: readonly unknown[];
  } | null;
}

export function usePartnerSessions() {
  const {
    partners,
    pendingRequests,
    isLoading: isLoadingPartners,
  } = usePartners();
  const queryClient = useQueryClient();

  const partnerIds = useMemo(
    () => partners.map((p) => p.partnerId),
    [partners]
  );

  // Realtime subscription — one channel for all partner IDs
  const unsubRef = useRef<(() => void) | null>(null);

  const handleUpdate = useCallback(
    (partnerId: string) => {
      queryClient.invalidateQueries({
        queryKey: partnerQueries.partnerSession(partnerId).queryKey,
      });
    },
    [queryClient]
  );

  useEffect(() => {
    unsubRef.current?.();

    if (partnerIds.length === 0) {
      unsubRef.current = null;
      return;
    }

    unsubRef.current = subscribeToPartnerSessions({
      partnerIds,
      onUpdate: handleUpdate,
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [partnerIds, handleUpdate]);

  // Query each partner's active session using useQueries (dynamic array safe)
  const sessionResults = useQueries({
    queries: partners.map((p) => partnerQueries.partnerSession(p.partnerId)),
  });

  const partnersWithSessions: PartnerWithSession[] = useMemo(
    () =>
      partners.map((partner, i) => {
        const session = sessionResults[i]?.data;
        return {
          ...partner,
          activeSession: session
            ? {
                id: session.id,
                primaryLift: session.primaryLift,
                plannedSets: session.plannedSets,
              }
            : null,
        };
      }),
    [partners, sessionResults]
  );

  return {
    partners: partnersWithSessions,
    pendingRequests,
    isLoading: isLoadingPartners,
  };
}
