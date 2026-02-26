import {
  getPendingFormulaSuggestionsCount,
  getUnreviewedDeveloperSuggestionsCount,
} from '../data/settings.repository';

export async function getPendingFormulaSuggestionCount(userId: string): Promise<number> {
  return getPendingFormulaSuggestionsCount(userId);
}

export async function getUnreviewedDeveloperSuggestionCount(): Promise<number> {
  return getUnreviewedDeveloperSuggestionsCount();
}
