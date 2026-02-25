import type { Lift } from '@parakeet/shared-types'

// ---------------------------------------------------------------------------
// Raw data shapes (Supabase rows passed in from the app layer)
// ---------------------------------------------------------------------------

export interface RawSession {
  id: string
  week_number: number
  block_number: number
  primary_lift: string
  intensity_type: string
  status: string
  planned_sets: unknown[] | null
}

export interface RawSessionLog {
  session_id: string
  session_rpe: number | null
  actual_sets: unknown[] | null
  completed_at: string
}

export interface RawSorenessCheckin {
  muscle_group: string
  soreness_level: number
  checked_in_at: string
}

export interface RawLifterMax {
  lift: string
  one_rm_grams: number
  recorded_at: string
}

export interface RawDisruption {
  id: string
  disruption_type: string
  severity: 'minor' | 'moderate' | 'major'
  status: string
  affected_lifts: string[] | null
  reported_at: string
}

export interface RawAuxiliaryAssignment {
  lift: string
  block_number: number
  exercises: string[]
}

export interface RawFormulaHistory {
  id: string
  created_at: string
  source: string
  overrides: Record<string, unknown>
}

export interface RawCycleData {
  program: {
    id: string
    total_weeks: number
    start_date: string
    status: string
  }
  sessions: RawSession[]
  sessionLogs: RawSessionLog[]
  sorenessCheckins: RawSorenessCheckin[]
  lifterMaxes: RawLifterMax[]
  disruptions: RawDisruption[]
  auxiliaryAssignments: RawAuxiliaryAssignment[]
  formulaHistory: RawFormulaHistory[]
}

// ---------------------------------------------------------------------------
// CycleReport — the structured summary sent to the LLM
// ---------------------------------------------------------------------------

export interface LiftSummary {
  startOneRmKg: number
  endOneRmKg: number
  sessionCount: number
  completedCount: number
  avgRpeVsTarget: number | null
  blockRpeTrends: Array<{ block: number; avgRpe: number | null; targetRpe: number }>
}

export interface WeeklyVolumeRow {
  week: number
  setsByMuscle: Record<string, number>
  mrvPctByMuscle: Record<string, number>
}

export interface AuxLiftCorrelation {
  exercise: string
  lift: string
  precedingWeeks: number
  liftChangePct: number | null
}

export interface CycleReport {
  programId: string
  totalWeeks: number
  completionPct: number
  lifts: Partial<Record<Lift, LiftSummary>>
  weeklyVolume: WeeklyVolumeRow[]
  auxiliaryCorrelations: AuxLiftCorrelation[]
  disruptions: Array<{
    type: string
    severity: string
    affectedLifts: string[] | null
    reportedAt: string
  }>
  formulaChanges: Array<{
    source: string
    overrides: Record<string, unknown>
    createdAt: string
  }>
}

// ---------------------------------------------------------------------------
// Assembly function
// ---------------------------------------------------------------------------

export function assembleCycleReport(raw: RawCycleData): CycleReport {
  const totalSessions = raw.sessions.length
  const completedSessions = raw.sessions.filter((s) => s.status === 'completed').length
  const completionPct = totalSessions > 0 ? completedSessions / totalSessions : 0

  // Per-lift summaries
  const lifts: Partial<Record<Lift, LiftSummary>> = {}
  for (const liftName of ['squat', 'bench', 'deadlift'] as Lift[]) {
    const liftSessions = raw.sessions.filter((s) => s.primary_lift === liftName)
    if (liftSessions.length === 0) continue

    const maxes = raw.lifterMaxes
      .filter((m) => m.lift === liftName)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))

    const startOneRmKg = maxes[0] ? maxes[0].one_rm_grams / 1000 : 0
    const endOneRmKg = maxes[maxes.length - 1] ? maxes[maxes.length - 1].one_rm_grams / 1000 : 0

    const liftLogs = raw.sessionLogs.filter((l) =>
      liftSessions.some((s) => s.id === l.session_id),
    )
    const rpeDiffs = liftLogs
      .filter((l) => l.session_rpe !== null)
      .map((l) => (l.session_rpe ?? 0) - 8.5) // 8.5 as default target RPE
    const avgRpeVsTarget =
      rpeDiffs.length > 0 ? rpeDiffs.reduce((s, d) => s + d, 0) / rpeDiffs.length : null

    const blockRpeTrends = [1, 2, 3].map((block) => {
      const blockSessions = liftSessions.filter((s) => s.block_number === block)
      const blockLogs = raw.sessionLogs.filter((l) =>
        blockSessions.some((s) => s.id === l.session_id && l.session_rpe !== null),
      )
      const blockRpes = blockLogs.map((l) => l.session_rpe ?? 0)
      return {
        block,
        avgRpe: blockRpes.length > 0 ? blockRpes.reduce((s, r) => s + r, 0) / blockRpes.length : null,
        targetRpe: 8.5,
      }
    })

    lifts[liftName] = {
      startOneRmKg,
      endOneRmKg,
      sessionCount: liftSessions.length,
      completedCount: liftSessions.filter((s) => s.status === 'completed').length,
      avgRpeVsTarget,
      blockRpeTrends,
    }
  }

  // Auxiliary correlations (simplified: map exercise → subsequent lift improvement)
  const auxiliaryCorrelations: AuxLiftCorrelation[] = []
  for (const assignment of raw.auxiliaryAssignments) {
    for (const exercise of assignment.exercises) {
      const liftName = assignment.lift as Lift
      const liftSummary = lifts[liftName]
      if (!liftSummary) continue
      const changePct =
        liftSummary.startOneRmKg > 0
          ? ((liftSummary.endOneRmKg - liftSummary.startOneRmKg) / liftSummary.startOneRmKg) * 100
          : null
      auxiliaryCorrelations.push({
        exercise,
        lift: liftName,
        precedingWeeks: raw.program.total_weeks,
        liftChangePct: changePct,
      })
    }
  }

  // Weekly volume (simplified — set counts per week)
  const weeklyVolume: WeeklyVolumeRow[] = []
  const weekNumbers = [...new Set(raw.sessions.map((s) => s.week_number))].sort((a, b) => a - b)
  for (const week of weekNumbers) {
    const weekSessions = raw.sessions.filter((s) => s.week_number === week)
    const setsByMuscle: Record<string, number> = {}
    for (const session of weekSessions) {
      const sets = Array.isArray(session.planned_sets) ? session.planned_sets.length : 0
      const lift = session.primary_lift
      setsByMuscle[lift] = (setsByMuscle[lift] ?? 0) + sets
    }
    weeklyVolume.push({ week, setsByMuscle, mrvPctByMuscle: {} })
  }

  return {
    programId: raw.program.id,
    totalWeeks: raw.program.total_weeks,
    completionPct,
    lifts,
    weeklyVolume,
    auxiliaryCorrelations,
    disruptions: raw.disruptions.map((d) => ({
      type: d.disruption_type,
      severity: d.severity,
      affectedLifts: d.affected_lifts,
      reportedAt: d.reported_at,
    })),
    formulaChanges: raw.formulaHistory.map((f) => ({
      source: f.source,
      overrides: f.overrides,
      createdAt: f.created_at,
    })),
  }
}
