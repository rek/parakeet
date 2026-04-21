import type { Lift } from '@parakeet/shared-types';
import { estimateOneRepMax_Epley } from '@parakeet/training-engine';
import { weightGramsToKg } from '@shared/utils/weight';

import {
  fetchPerformanceByLift,
  fetchRecentLiftHistory,
  fetchRecentSessionLogsForTrends,
  fetchWeeklySessionLogs,
} from '../data/performance.repository';
import { processRecentHistory } from './performance-helpers';

export type { LiftHistory, LiftHistoryEntry } from './performance-helpers';

export interface PerformanceTrend {
  lift: Lift;
  estimatedOneRmKg: number;
  trend: 'improving' | 'stable' | 'declining';
  sessionsLogged: number;
  avgCompletionPct: number;
}

export async function getPerformanceByLift(
  userId: string,
  lift: Lift,
  fromDate?: Date
) {
  return fetchPerformanceByLift(userId, lift, fromDate);
}

export async function getPerformanceTrends(
  userId: string
): Promise<PerformanceTrend[]> {
  const data = await fetchRecentSessionLogsForTrends(userId);
  return computeTrends(data);
}

interface RawLogRow {
  completion_pct: number | null;
  actual_sets: unknown;
  sessions:
    | { primary_lift: string | null }[]
    | { primary_lift: string | null }
    | null;
}

function getSessions(row: RawLogRow): { primary_lift: string | null } | null {
  if (!row.sessions) return null;
  return Array.isArray(row.sessions) ? (row.sessions[0] ?? null) : row.sessions;
}

function computeTrends(rows: RawLogRow[]): PerformanceTrend[] {
  const byLift = new Map<string, RawLogRow[]>();
  for (const row of rows) {
    const lift = getSessions(row)?.primary_lift;
    if (!lift) continue;
    if (!byLift.has(lift)) byLift.set(lift, []);
    byLift.get(lift)!.push(row);
  }

  const trends: PerformanceTrend[] = [];

  for (const [lift, liftRows] of byLift) {
    const oneRmSeries = liftRows.map((r) =>
      estimateHeaviestOneRm(r.actual_sets)
    );
    const latestOneRm = Math.max(0, ...oneRmSeries.slice(0, 10));

    const recent = average(oneRmSeries.slice(0, 5));
    const older = average(oneRmSeries.slice(-5));
    const delta = recent - older;

    const trend: PerformanceTrend['trend'] =
      delta > 2.5 ? 'improving' : delta < -2.5 ? 'declining' : 'stable';

    const validCompletions = liftRows
      .map((r) => r.completion_pct)
      .filter((v): v is number => v != null);
    const avgCompletionPct =
      validCompletions.length > 0 ? average(validCompletions) : 0;

    trends.push({
      lift: lift as Lift,
      estimatedOneRmKg: latestOneRm,
      trend,
      sessionsLogged: liftRows.length,
      avgCompletionPct,
    });
  }

  return trends;
}

function estimateHeaviestOneRm(actualSets: unknown): number {
  if (!Array.isArray(actualSets) || actualSets.length === 0) return 0;

  let bestOneRm = 0;
  for (const set of actualSets as {
    weight_grams?: number;
    reps_completed?: number;
  }[]) {
    if (!set.weight_grams || !set.reps_completed || set.reps_completed <= 0)
      continue;
    const weightKg = weightGramsToKg(set.weight_grams);
    const oneRm = estimateOneRepMax_Epley(weightKg, set.reps_completed);
    if (oneRm > bestOneRm) bestOneRm = oneRm;
  }
  return bestOneRm;
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function getWeeklySetsPerLift(
  userId: string,
  weeks = 8
): Promise<{ weekStart: string; lift: Lift; setsCompleted: number }[]> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - weeks * 7);

  const data = await fetchWeeklySessionLogs(userId, fromDate);

  const grouped = new Map<string, number>();

  for (const row of data) {
    const session = Array.isArray(row.sessions)
      ? row.sessions[0]
      : row.sessions;
    const lift = session?.primary_lift as Lift | undefined;
    if (!lift || !row.completed_at) continue;

    const weekStart = getIsoWeekStart(row.completed_at);
    const key = `${weekStart}__${lift}`;
    const setCount = Array.isArray(row.actual_sets)
      ? row.actual_sets.length
      : 0;
    grouped.set(key, (grouped.get(key) ?? 0) + setCount);
  }

  return Array.from(grouped.entries()).map(([key, setsCompleted]) => {
    const [weekStart, lift] = key.split('__') as [string, Lift];
    return { weekStart, lift, setsCompleted };
  });
}

export async function getWeeklyHeaviestPerLift(
  userId: string,
  weeks = 8
): Promise<{ weekStart: string; lift: Lift; heaviestKg: number }[]> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - weeks * 7);

  const data = await fetchWeeklySessionLogs(userId, fromDate);

  const grouped = new Map<string, number>();

  for (const row of data) {
    const session = Array.isArray(row.sessions)
      ? row.sessions[0]
      : row.sessions;
    const lift = session?.primary_lift as Lift | undefined;
    if (!lift || !row.completed_at) continue;

    const weekStart = getIsoWeekStart(row.completed_at);
    const key = `${weekStart}__${lift}`;

    if (!Array.isArray(row.actual_sets)) continue;
    for (const set of row.actual_sets as {
      weight_grams?: number;
      reps_completed?: number;
    }[]) {
      if (!set.weight_grams || !set.reps_completed || set.reps_completed <= 0)
        continue;
      const kg = weightGramsToKg(set.weight_grams);
      const current = grouped.get(key) ?? 0;
      if (kg > current) grouped.set(key, kg);
    }
  }

  return Array.from(grouped.entries()).map(([key, heaviestKg]) => {
    const [weekStart, lift] = key.split('__') as [string, Lift];
    return { weekStart, lift, heaviestKg };
  });
}

export async function getWeeklyVolumeKg(
  userId: string,
  weeks = 8
): Promise<{ weekStart: string; lift: Lift; volumeKg: number }[]> {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - weeks * 7);

  const data = await fetchWeeklySessionLogs(userId, fromDate);

  const grouped = new Map<string, number>();

  for (const row of data) {
    const session = Array.isArray(row.sessions)
      ? row.sessions[0]
      : row.sessions;
    const lift = session?.primary_lift as Lift | undefined;
    if (!lift || !row.completed_at) continue;

    const weekStart = getIsoWeekStart(row.completed_at);
    const key = `${weekStart}__${lift}`;

    let sessionVolume = 0;
    if (Array.isArray(row.actual_sets)) {
      for (const set of row.actual_sets as {
        weight_grams?: number;
        reps_completed?: number;
      }[]) {
        if (!set.weight_grams || !set.reps_completed || set.reps_completed <= 0)
          continue;
        sessionVolume += weightGramsToKg(set.weight_grams) * set.reps_completed;
      }
    }

    grouped.set(key, (grouped.get(key) ?? 0) + sessionVolume);
  }

  return Array.from(grouped.entries()).map(([key, volumeKg]) => {
    const [weekStart, lift] = key.split('__') as [string, Lift];
    return { weekStart, lift, volumeKg };
  });
}

function getIsoWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function getRecentLiftHistory(
  userId: string,
  lift: Lift,
  limit = 5
) {
  const data = await fetchRecentLiftHistory(userId, lift, limit);
  return processRecentHistory(
    data.map((r) => ({
      completed_at: r.completed_at ?? '',
      actual_sets: r.actual_sets,
      session_rpe: r.session_rpe ?? null,
      completion_pct: r.completion_pct ?? null,
      sessions: r.sessions,
    }))
  );
}
