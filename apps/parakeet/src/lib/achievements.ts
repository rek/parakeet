import {
  computeStreak,
  computeWilks2020,
} from '@parakeet/training-engine'
import type { WeekStatus, StreakResult } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HistoricalPRs {
  best1rmKg: number
  bestVolumeKgCubed: number
  repPRs: Record<number, number>   // weight (kg, rounded to 2.5) → best reps
}

export interface CycleBadge {
  programId: string
  cycleNumber: number
  startDate: string
  weekCount: number
  completionPct: number
}

export interface WilksPoint {
  cycleNumber: number
  wilksScore: number
  date: string
}

// ── getPRHistory ──────────────────────────────────────────────────────────────

/**
 * Build HistoricalPRs from the personal_records table.
 * Falls back to zero values when the table has no rows yet
 * (table is added by the engine-022 migration).
 */
export async function getPRHistory(
  userId: string,
  lift: Lift,
): Promise<HistoricalPRs> {
  const { data } = await supabase
    .from('personal_records')
    .select('pr_type, value, weight_kg')
    .eq('user_id', userId)
    .eq('lift', lift)

  const rows = data ?? []

  let best1rmKg = 0
  let bestVolumeKgCubed = 0
  const repPRs: Record<number, number> = {}

  for (const row of rows) {
    if (row.pr_type === 'estimated_1rm') {
      if ((row.value as number) > best1rmKg) best1rmKg = row.value as number
    } else if (row.pr_type === 'volume') {
      if ((row.value as number) > bestVolumeKgCubed)
        bestVolumeKgCubed = row.value as number
    } else if (row.pr_type === 'rep_at_weight' && row.weight_kg != null) {
      const wt = row.weight_kg as number
      const reps = row.value as number
      if ((repPRs[wt] ?? 0) < reps) repPRs[wt] = reps
    }
  }

  return { best1rmKg, bestVolumeKgCubed, repPRs }
}

// ── getStreakData ─────────────────────────────────────────────────────────────

/**
 * Build WeekStatus[] from sessions + disruptions, then call computeStreak().
 *
 * Groups sessions by ISO Monday (Mon–Sun week).
 * A session counts toward completedSessions when status = 'completed'.
 * A session counts toward skippedWithDisruption when status = 'skipped'
 *   AND a disruption covers its planned_date.
 * Everything else (missed/planned/in_progress) is an unaccounted miss
 *   only when the week is in the past.
 */
export async function getStreakData(userId: string): Promise<StreakResult> {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const [sessionsResult, disruptionsResult] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, planned_date, status')
      .eq('user_id', userId)
      .not('planned_date', 'is', null)
      .order('planned_date', { ascending: true }),
    supabase
      .from('disruptions')
      .select('affected_date_start, affected_date_end, session_ids_affected')
      .eq('user_id', userId),
  ])

  const sessions = sessionsResult.data ?? []
  const disruptions = disruptionsResult.data ?? []

  // Build a Set of session IDs covered by a disruption (via session_ids_affected)
  // and a helper to check if a date falls within any disruption window
  const disruptionSessionIds = new Set<string>()
  for (const d of disruptions) {
    const ids = d.session_ids_affected as string[] | null
    if (ids) {
      for (const id of ids) disruptionSessionIds.add(id)
    }
  }

  function isDateCoveredByDisruption(dateStr: string): boolean {
    for (const d of disruptions) {
      const start = d.affected_date_start as string
      const end = (d.affected_date_end as string | null) ?? start
      if (dateStr >= start && dateStr <= end) return true
    }
    return false
  }

  // Group sessions by the Monday of their week
  const byWeek = new Map<string, typeof sessions>()
  for (const s of sessions) {
    const d = new Date(s.planned_date as string)
    // getDay() 0=Sun; shift to Monday-based
    const day = d.getDay()
    const offset = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setDate(d.getDate() + offset)
    const weekKey = monday.toISOString().split('T')[0]
    const existing = byWeek.get(weekKey) ?? []
    existing.push(s)
    byWeek.set(weekKey, existing)
  }

  const weekStatuses: WeekStatus[] = []

  for (const [weekStartDate, weekSessions] of [...byWeek.entries()].sort()) {
    // Determine if this week is fully in the past (Monday of NEXT week <= today)
    const weekEnd = new Date(weekStartDate)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = weekEnd.toISOString().split('T')[0]
    const weekIsComplete = weekEndStr < todayStr

    let scheduled = 0
    let completed = 0
    let skippedWithDisruption = 0
    let unaccountedMisses = 0

    for (const s of weekSessions) {
      const status = s.status as string
      const dateStr = s.planned_date as string

      // Only count sessions that were meant to happen (not future planned ones)
      if (dateStr > todayStr && status === 'planned') continue

      scheduled++

      if (status === 'completed') {
        completed++
      } else if (
        status === 'skipped' &&
        (disruptionSessionIds.has(s.id as string) || isDateCoveredByDisruption(dateStr))
      ) {
        skippedWithDisruption++
      } else if (weekIsComplete) {
        unaccountedMisses++
      }
    }

    if (scheduled > 0) {
      weekStatuses.push({
        weekStartDate,
        scheduled,
        completed,
        skippedWithDisruption,
        unaccountedMisses,
      })
    }
  }

  return computeStreak(weekStatuses)
}

// ── getCycleBadges ────────────────────────────────────────────────────────────

/**
 * Returns completed programs where completion rate qualifies for a badge (≥80%).
 * Completion pct is computed from sessions counts (same logic as onCycleComplete).
 */
export async function getCycleBadges(userId: string): Promise<CycleBadge[]> {
  const { data: programs } = await supabase
    .from('programs')
    .select('id, version, start_date, total_weeks, status')
    .eq('user_id', userId)
    .in('status', ['completed', 'archived'])
    .order('version', { ascending: true })

  if (!programs || programs.length === 0) return []

  const badges: CycleBadge[] = []

  for (const program of programs) {
    const { data: allSessions } = await supabase
      .from('sessions')
      .select('status')
      .eq('program_id', program.id as string)
      .eq('user_id', userId)

    const total = allSessions?.length ?? 0
    if (total === 0) continue

    const completedCount = allSessions?.filter(
      (s: { status: string }) => s.status === 'completed',
    ).length ?? 0
    const skippedDisruption = allSessions?.filter(
      (s: { status: string }) => s.status === 'skipped',
    ).length ?? 0

    const completionPct = (completedCount + skippedDisruption) / total

    if (completionPct >= 0.8) {
      badges.push({
        programId: program.id as string,
        cycleNumber: program.version as number,
        startDate: program.start_date as string,
        weekCount: program.total_weeks as number,
        completionPct,
      })
    }
  }

  return badges
}

// ── getWilksHistory ───────────────────────────────────────────────────────────

/**
 * Returns one WILKS score per completed cycle, computed from the lifter_maxes
 * recorded closest to that cycle's start_date.
 *
 * Body weight is stored as bodyweight_kg on profiles (future field) — falls
 * back to 85 kg if not present.
 */
export async function getWilksHistory(userId: string): Promise<WilksPoint[]> {
  const [profileResult, maxesResult, programsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('biological_sex, bodyweight_kg')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('lifter_maxes')
      .select('recorded_at, squat_1rm_grams, bench_1rm_grams, deadlift_1rm_grams')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: true }),
    supabase
      .from('programs')
      .select('id, version, start_date')
      .eq('user_id', userId)
      .in('status', ['completed', 'archived'])
      .order('version', { ascending: true }),
  ])

  const profile = profileResult.data
  const maxes = maxesResult.data ?? []
  const programs = programsResult.data ?? []

  if (maxes.length === 0 || programs.length === 0) return []

  const sex: 'male' | 'female' =
    profile?.biological_sex === 'female' ? 'female' : 'male'
  const bodyweightKg = (profile as { bodyweight_kg?: number } | null)?.bodyweight_kg ?? 85

  const points: WilksPoint[] = []

  for (const program of programs) {
    const startDate = program.start_date as string

    // Find the lifter_maxes row recorded closest to (at or before) startDate
    const relevant = maxes.filter(
      (m) => (m.recorded_at as string).split('T')[0] <= startDate,
    )
    const maxRow = relevant.length > 0 ? relevant[relevant.length - 1] : maxes[0]

    const squatKg = (maxRow.squat_1rm_grams as number) / 1000
    const benchKg = (maxRow.bench_1rm_grams as number) / 1000
    const deadliftKg = (maxRow.deadlift_1rm_grams as number) / 1000
    const totalKg = squatKg + benchKg + deadliftKg

    const wilksScore = computeWilks2020(totalKg, bodyweightKg, sex)

    points.push({
      cycleNumber: program.version as number,
      wilksScore: Math.round(wilksScore),
      date: startDate,
    })
  }

  return points
}
