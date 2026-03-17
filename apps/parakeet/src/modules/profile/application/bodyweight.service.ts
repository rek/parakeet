import { getAuthenticatedUserId } from '../data/profile.repository';
import {
  deleteBodyweightEntry as deleteEntry,
  fetchBodyweightHistory,
  upsertBodyweightEntry,
} from '../data/bodyweight.repository';

export type { BodyweightEntry } from '../data/bodyweight.repository';

export async function getBodyweightHistory() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];
  return fetchBodyweightHistory(userId);
}

export async function addBodyweightEntry({
  recordedDate,
  weightKg,
}: {
  recordedDate: string;
  weightKg: number;
}) {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error('Not authenticated');
  await upsertBodyweightEntry({ userId, recordedDate, weightKg });
}

export async function deleteBodyweightEntry(entryId: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error('Not authenticated');
  await deleteEntry({ userId, entryId });
}
