// @spec docs/features/lipedema-tracking/spec-data-layer.md
import { queryOptions } from '@tanstack/react-query';

import { fetchMeasurements } from './lipedema-tracking.repository';

export const lipedemaTrackingQueries = {
  all: () => ['lipedema-tracking'] as const,

  measurements: (limit = 52) =>
    queryOptions({
      queryKey: [...lipedemaTrackingQueries.all(), 'measurements', limit] as const,
      queryFn: () => fetchMeasurements(limit),
      staleTime: 60 * 1000,
    }),
};
