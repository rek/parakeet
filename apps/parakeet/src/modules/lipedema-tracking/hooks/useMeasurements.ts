// @spec docs/features/lipedema-tracking/spec-data-layer.md
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { lipedemaTrackingQueries } from '../data/lipedema-tracking.queries';
import {
  deleteMeasurement,
  upsertMeasurement,
  type UpsertInput,
} from '../data/lipedema-tracking.repository';

export function useMeasurements(limit = 52) {
  return useQuery(lipedemaTrackingQueries.measurements(limit));
}

export function useSaveMeasurement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertInput) => upsertMeasurement(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: lipedemaTrackingQueries.all(),
      });
    },
  });
}

export function useDeleteMeasurement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMeasurement(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: lipedemaTrackingQueries.all(),
      });
    },
  });
}
