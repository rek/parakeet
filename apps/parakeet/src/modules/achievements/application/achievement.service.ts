import type { Lift } from '@parakeet/shared-types';
import { computeStreak, computeWilks2020 } from '@parakeet/training-engine';
import type { PR, StreakResult } from '@parakeet/training-engine';
import { weightGramsToKg } from '@shared/utils/weight';

import { buildWeekStatuses } from '../utils/week-status-builder';

import {
  fetchBodyweightEntriesForWilks,
  fetchDisruptionsForStreak,
  fetchMaxesForWilks,
  fetchPersonalRecords,
  fetchProfileForWilks,
  fetchProgramsForCycleBadges,
  fetchProgramsForWilks,
  fetchSessionsForStreak,
  upsertPersonalRecords,
} from '../data/achievement.repository';
import { fetchProgramSessionStatuses } from '../data/session.repository';

export interface HistoricalPRs {
  best1rmKg: number;
  best1rmSessionId: string | null;
  best1rmDate: string | null;
  bestVolumeKgCubed: number;
  repPRs: Record<number, number>; // weight (kg, rounded to 2.5) → best reps
  repPRSessionIds: Record<number, string | null>; // weight → session that set the PR
  repPRDates: Record<number, string | null>; // weight → date PR was achieved
}

export interface CycleBadge {
  programId: string;
  cycleNumber: number;
  startDate: string;
  weekCount: number;
  completionPct: number;
}

export interface WilksPoint {
  cycleNumber: number;
  wilksScore: number;
  date: string;
}

export async function storePersonalRecords(
  userId: string,
  prs: PR[]
): Promise<void> {
  await upsertPersonalRecords(userId, prs);
}

/**
 * Build HistoricalPRs from the personal_records table.
 * Falls back to zero values when the table has no rows yet
 * (table is added by the engine-022 migration).
 */
export async function getPRHistory(
  userId: string,
  lift: Lift
): Promise<HistoricalPRs> {
  const rows = await fetchPersonalRecords(userId, lift);

  let best1rmKg = 0;
  let best1rmSessionId: string | null = null;
  let best1rmDate: string | null = null;
  let bestVolumeKgCubed = 0;
  const repPRs: Record<number, number> = {};
  const repPRSessionIds: Record<number, string | null> = {};
  const repPRDates: Record<number, string | null> = {};

  for (const row of rows) {
    if (row.pr_type === 'estimated_1rm') {
      if ((row.value as number) > best1rmKg) {
        best1rmKg = row.value as number;
        best1rmSessionId = (row.session_id as string) ?? null;
        best1rmDate = (row.achieved_at as string) ?? null;
      }
    } else if (row.pr_type === 'volume') {
      if ((row.value as number) > bestVolumeKgCubed) {
        bestVolumeKgCubed = row.value as number;
      }
    } else if (row.pr_type === 'rep_at_weight' && row.weight_kg != null) {
      const wt = row.weight_kg as number;
      const reps = row.value as number;
      if ((repPRs[wt] ?? 0) < reps) {
        repPRs[wt] = reps;
        repPRSessionIds[wt] = (row.session_id as string) ?? null;
        repPRDates[wt] = (row.achieved_at as string) ?? null;
      }
    }
  }

  return { best1rmKg, best1rmSessionId, best1rmDate, bestVolumeKgCubed, repPRs, repPRSessionIds, repPRDates };
}

/**
 * Build WeekStatus[] from sessions + disruptions, then call computeStreak().
 */
export async function getStreakData(userId: string): Promise<StreakResult> {
  const todayStr = new Date().toISOString().split('T')[0];

  const [sessions, disruptions] = await Promise.all([
    fetchSessionsForStreak(userId),
    fetchDisruptionsForStreak(userId),
  ]);

  const weekStatuses = buildWeekStatuses(sessions, disruptions, todayStr);
  return computeStreak(weekStatuses);
}

/**
 * Returns completed programs where completion rate qualifies for a badge (≥80%).
 */
export async function getCycleBadges(userId: string): Promise<CycleBadge[]> {
  const programs = await fetchProgramsForCycleBadges(userId);
  if (programs.length === 0) return [];

  const badges: CycleBadge[] = [];

  for (const program of programs) {
    if (!program.total_weeks) continue;

    const allSessions = await fetchProgramSessionStatuses(
      program.id as string,
      userId
    );
    const total = allSessions.length;
    if (total === 0) continue;

    const completedCount = allSessions.filter(
      (s: { status: string }) => s.status === 'completed'
    ).length;
    const skippedDisruption = allSessions.filter(
      (s: { status: string }) => s.status === 'skipped'
    ).length;

    const completionPct = (completedCount + skippedDisruption) / total;

    if (completionPct >= 0.8) {
      badges.push({
        programId: program.id as string,
        cycleNumber: program.version as number,
        startDate: program.start_date as string,
        weekCount: program.total_weeks ?? 0,
        completionPct,
      });
    }
  }

  return badges;
}

/**
 * Returns one WILKS score per completed cycle.
 */
export async function getWilksHistory(userId: string): Promise<WilksPoint[]> {
  const [profile, maxes, programs, bwEntries] = await Promise.all([
    fetchProfileForWilks(userId),
    fetchMaxesForWilks(userId),
    fetchProgramsForWilks(userId),
    fetchBodyweightEntriesForWilks(userId),
  ]);

  if (maxes.length === 0 || programs.length === 0) return [];

  const sex: 'male' | 'female' =
    profile?.biological_sex === 'female' ? 'female' : 'male';
  const fallbackBw =
    (profile as { bodyweight_kg?: number } | null)?.bodyweight_kg ?? 85;

  const points: WilksPoint[] = [];

  for (const program of programs) {
    const startDate = program.start_date as string;
    const relevant = maxes.filter(
      (m) => (m.recorded_at as string).split('T')[0] <= startDate
    );
    const maxRow =
      relevant.length > 0 ? relevant[relevant.length - 1] : maxes[0];

    // Use bodyweight closest to (but not after) the program start date
    const relevantBw = bwEntries.filter(
      (e) => e.recorded_date <= startDate
    );
    const bodyweightKg = relevantBw.length > 0
      ? relevantBw[relevantBw.length - 1].weight_kg
      : (bwEntries[0]?.weight_kg ?? fallbackBw);

    const squatKg = weightGramsToKg(maxRow.squat_1rm_grams as number);
    const benchKg = weightGramsToKg(maxRow.bench_1rm_grams as number);
    const deadliftKg = weightGramsToKg(maxRow.deadlift_1rm_grams as number);
    const totalKg = squatKg + benchKg + deadliftKg;
    const wilksScore = computeWilks2020(totalKg, bodyweightKg, sex);

    points.push({
      cycleNumber: program.version as number,
      wilksScore: Math.round(wilksScore),
      date: startDate,
    });
  }

  return points;
}
