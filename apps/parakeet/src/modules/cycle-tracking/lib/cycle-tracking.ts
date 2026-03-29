import {
  computeCyclePhase,
  getCyclePhaseModifier,
  getPhaseForDay,
} from '@parakeet/training-engine';
import type { CycleContext, CyclePhase } from '@parakeet/training-engine';

import {
  deletePeriodStartById,
  fetchCycleConfig,
  fetchPeriodStartHistory,
  insertDefaultCycleConfig,
  updateSessionCyclePhase,
  upsertCycleConfig,
  upsertPeriodStart,
} from '../data/cycle-tracking.repository';

export { computeCyclePhase, getCyclePhaseModifier, getPhaseForDay };
export type { CycleContext, CyclePhase };

export interface CycleConfig {
  is_enabled: boolean;
  cycle_length_days: number;
  last_period_start: string | null;
}

export async function getCycleConfig(userId: string): Promise<CycleConfig> {
  const data = await fetchCycleConfig(userId);

  if (!data) {
    const defaults: CycleConfig = {
      is_enabled: false,
      cycle_length_days: 28,
      last_period_start: null,
    };
    await insertDefaultCycleConfig(userId, defaults);
    return defaults;
  }

  return data;
}

export async function updateCycleConfig(
  userId: string,
  update: Partial<
    Pick<CycleConfig, 'is_enabled' | 'cycle_length_days' | 'last_period_start'>
  >
): Promise<void> {
  await upsertCycleConfig(userId, update);
}

export async function getCurrentCycleContext(
  userId: string
): Promise<CycleContext | null> {
  const config = await getCycleConfig(userId);
  if (!config.is_enabled || !config.last_period_start) return null;
  return computeCyclePhase(
    new Date(config.last_period_start),
    config.cycle_length_days
  );
}

// ── Period start history ──────────────────────────────────────────────────────

export interface PeriodStartEntry {
  id: string;
  start_date: string; // 'YYYY-MM-DD'
}

export async function getPeriodStartHistory(
  userId: string
): Promise<PeriodStartEntry[]> {
  return fetchPeriodStartHistory(userId);
}

export async function addPeriodStart(
  userId: string,
  startDate: string
): Promise<PeriodStartEntry[]> {
  await upsertPeriodStart(userId, startDate);

  const history = await getPeriodStartHistory(userId);
  const mostRecent = history[0]?.start_date ?? null;
  await updateCycleConfig(userId, { last_period_start: mostRecent });
  return history;
}

export async function deletePeriodStart(
  userId: string,
  entryId: string
): Promise<PeriodStartEntry[]> {
  await deletePeriodStartById(userId, entryId);

  const history = await getPeriodStartHistory(userId);
  const mostRecent = history[0]?.start_date ?? null;
  await updateCycleConfig(userId, { last_period_start: mostRecent });
  return history;
}

export async function stampCyclePhaseOnSession(
  userId: string,
  sessionId: string
): Promise<void> {
  // No-ops when cycle tracking is disabled or no period start date is recorded.
  const context = await getCurrentCycleContext(userId);
  if (!context) return;
  await updateSessionCyclePhase(userId, sessionId, context.phase);
}
