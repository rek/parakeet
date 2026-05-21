// @spec docs/features/rehab-mode/spec-app.md
import type {
  CreateRehabCapInput,
  Lift,
  UpdateRehabCapInput,
} from '@parakeet/shared-types';

import {
  endRehabCap as repoEndRehabCap,
  getActiveCapForLift as repoGetActiveCapForLift,
  getRehabCap as repoGetRehabCap,
  getRehabCapHistory as repoGetRehabCapHistory,
  insertRehabCap as repoInsertRehabCap,
  listActiveRehabCaps as repoListActiveRehabCaps,
  type RehabCapRow,
  updateRehabCap as repoUpdateRehabCap,
} from '../data/rehab-mode.repository';

export async function enableRehabCap(
  userId: string,
  input: CreateRehabCapInput
): Promise<RehabCapRow> {
  return repoInsertRehabCap(userId, input);
}

export async function updateRehabCap(
  id: string,
  userId: string,
  patch: UpdateRehabCapInput
): Promise<RehabCapRow> {
  return repoUpdateRehabCap(id, userId, patch);
}

export async function endRehabCap(
  id: string,
  userId: string
): Promise<RehabCapRow> {
  return repoEndRehabCap(id, userId);
}

export async function getActiveRehabCaps(userId: string): Promise<RehabCapRow[]> {
  return repoListActiveRehabCaps(userId);
}

export async function getActiveRehabCapForLift(
  userId: string,
  lift: Lift
): Promise<RehabCapRow | null> {
  return repoGetActiveCapForLift(userId, lift);
}

export async function getRehabCap(
  id: string,
  userId: string
): Promise<RehabCapRow | null> {
  return repoGetRehabCap(id, userId);
}

export async function getRehabCapHistory(
  userId: string,
  paging?: { page?: number; pageSize?: number }
): Promise<{ items: RehabCapRow[]; total: number }> {
  return repoGetRehabCapHistory(userId, paging);
}
