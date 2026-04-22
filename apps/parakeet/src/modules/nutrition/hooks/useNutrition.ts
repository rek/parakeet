// @spec docs/features/nutrition/spec-data-layer.md
import { useQuery } from '@tanstack/react-query';

import { nutritionQueries } from '../data/nutrition.queries';

export function useProtocols() {
  return useQuery(nutritionQueries.protocols());
}

export function useProtocolBundle(slug: string) {
  return useQuery(nutritionQueries.protocol(slug));
}

export function useFoodNutrition() {
  return useQuery(nutritionQueries.foodNutrition());
}
