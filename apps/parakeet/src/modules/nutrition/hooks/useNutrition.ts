import { useQuery } from '@tanstack/react-query';

import { nutritionQueries } from '../data/nutrition.queries';

export function useProtocols() {
  return useQuery(nutritionQueries.protocols());
}

export function useProtocolBundle(slug: string) {
  return useQuery(nutritionQueries.protocol(slug));
}
