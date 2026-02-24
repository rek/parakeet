import { estimateOneRepMax_Epley, gramsToKg } from '@parakeet/training-engine'
import type { Lift } from '@parakeet/shared-types'
import { supabase } from './supabase'

export interface PerformanceTrend {
  lift: Lift
  estimatedOneRmKg: number
  trend: 'improving' | 'stable' | 'declining'
  sessionsLogged: number
  avgCompletionPct: number
}

// Performance logs for a specific lift (for progress chart)
export async function getPerformanceByLift(
  userId: string,
  lift: Lift,
  fromDate?: Date,
) {
  let query = supabase
    .from('session_logs')
    .select(`
      id, completed_at, completion_pct, session_rpe,
      actual_sets,
      sessions!inner(primary_lift, intensity_type, block_number, week_number)
    `)
    .eq('user_id', userId)
    .eq('sessions.primary_lift', lift)
    .order('completed_at', { ascending: false })

  if (fromDate) {
    query = query.gte('completed_at', fromDate.toISOString())
  }

  const { data } = await query
  return data ?? []
}

// Performance trends summary per lift (History tab overview)
export async function getPerformanceTrends(userId: string): Promise<PerformanceTrend[]> {
  const { data } = await supabase
    .from('session_logs')
    .select(`
      completion_pct, session_rpe, actual_sets,
      sessions!inner(primary_lift, intensity_type)
    `)
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(30)

  return computeTrends(data ?? [])
}

// Pending adjustment suggestions (surfaced as in-app notifications)
export async function getPendingAdjustmentSuggestions(userId: string) {
  const { data } = await supabase
    .from('performance_metrics')
    .select('suggestions, computed_at, session_id')
    .eq('user_id', userId)
    .eq('reviewed', false)
    .order('computed_at', { ascending: false })
  return data?.flatMap((r) => r.suggestions) ?? []
}

// --- Local computation ---

interface RawLogRow {
  completion_pct: number | null
  actual_sets: unknown
  sessions: { primary_lift: string }[] | { primary_lift: string } | null
}

function getSessions(row: RawLogRow): { primary_lift: string } | null {
  if (!row.sessions) return null
  return Array.isArray(row.sessions) ? (row.sessions[0] ?? null) : row.sessions
}

function computeTrends(rows: RawLogRow[]): PerformanceTrend[] {
  const byLift = new Map<string, RawLogRow[]>()
  for (const row of rows) {
    const lift = getSessions(row)?.primary_lift
    if (!lift) continue
    if (!byLift.has(lift)) byLift.set(lift, [])
    byLift.get(lift)!.push(row)
  }

  const trends: PerformanceTrend[] = []

  for (const [lift, liftRows] of byLift) {
    const oneRmSeries = liftRows.map((r) => estimateHeaviestOneRm(r.actual_sets))
    const latestOneRm = oneRmSeries[0] ?? 0

    const recent = average(oneRmSeries.slice(0, 5))
    const older = average(oneRmSeries.slice(-5))
    const delta = recent - older

    const trend: PerformanceTrend['trend'] =
      delta > 2.5 ? 'improving' : delta < -2.5 ? 'declining' : 'stable'

    const validCompletions = liftRows
      .map((r) => r.completion_pct)
      .filter((v): v is number => v != null)
    const avgCompletionPct = validCompletions.length > 0
      ? average(validCompletions)
      : 0

    trends.push({
      lift: lift as Lift,
      estimatedOneRmKg: latestOneRm,
      trend,
      sessionsLogged: liftRows.length,
      avgCompletionPct,
    })
  }

  return trends
}

function estimateHeaviestOneRm(actualSets: unknown): number {
  if (!Array.isArray(actualSets) || actualSets.length === 0) return 0

  let bestOneRm = 0
  for (const set of actualSets as { weight_grams?: number; reps_completed?: number }[]) {
    if (!set.weight_grams || !set.reps_completed || set.reps_completed <= 0) continue
    const weightKg = gramsToKg(set.weight_grams)
    const oneRm = estimateOneRepMax_Epley(weightKg, set.reps_completed)
    if (oneRm > bestOneRm) bestOneRm = oneRm
  }
  return bestOneRm
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}
