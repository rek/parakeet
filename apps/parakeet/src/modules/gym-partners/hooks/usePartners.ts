import { captureException } from '@platform/utils/captureException';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptPartner,
  claimInvite,
  createInvite,
  declinePartner,
  removePartner,
} from '../application/pairing.service';
import { partnerQueries } from '../data/partner.queries';

export function usePartners() {
  const { data: partners, isLoading: isLoadingPartners } = useQuery(
    partnerQueries.list()
  );
  const { data: pendingRequests, isLoading: isLoadingPending } = useQuery(
    partnerQueries.pendingRequests()
  );

  return {
    partners: partners ?? [],
    pendingRequests: pendingRequests ?? [],
    isLoading: isLoadingPartners || isLoadingPending,
  };
}

export function useCreateInvite() {
  const mutation = useMutation({
    mutationFn: createInvite,
  });

  return {
    createInvite: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export function useClaimInvite() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ token }: { token: string }) => claimInvite({ token }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: partnerQueries.all(),
      });
    },
    // No onError captureException here — QrScanSheet uses mutateAsync and catches
    // the error itself (captureException + user-facing message). Adding it here
    // would double-report every claim failure to Sentry.
  });

  return {
    claimInvite: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export function useAcceptPartner() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ partnershipId }: { partnershipId: string }) =>
      acceptPartner({ partnershipId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: partnerQueries.all(),
      });
    },
    onError: (err: Error) => captureException(err),
  });

  return { acceptPartner: mutation.mutate, isPending: mutation.isPending };
}

export function useDeclinePartner() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ partnershipId }: { partnershipId: string }) =>
      declinePartner({ partnershipId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: partnerQueries.all(),
      });
    },
    onError: (err: Error) => captureException(err),
  });

  return { declinePartner: mutation.mutate, isPending: mutation.isPending };
}

export function useRemovePartner() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ partnershipId }: { partnershipId: string }) =>
      removePartner({ partnershipId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: partnerQueries.all(),
      });
    },
    onError: (err: Error) => captureException(err),
  });

  return { removePartner: mutation.mutate, isPending: mutation.isPending };
}
