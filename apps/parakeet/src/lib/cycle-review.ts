import {
  assembleCycleReport,
  generateCycleReview,
  extractSummary,
} from '@parakeet/training-engine'
import type { CycleReport, RawCycleData, PreviousCycleSummary } from '@parakeet/training-engine'
import type { CycleReview } from '@parakeet/shared-types'
import { supabase } from './supabase'

export async function getCycleReview(programId: string, userId: string) {
  const existing = await supabase
    .from('cycle_reviews')
    .select('*')
    .eq('program_id', programId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing.data) return existing.data.llm_response as CycleReview

  const report = await compileCycleReport(programId, userId)
  const previousSummaries = await getPreviousCycleSummaries(userId, programId, 3)
  const review = await generateCycleReview(report, previousSummaries)
  await storeCycleReview(programId, userId, report, review)
  return review
}

export async function compileCycleReport(
  programId: string,
  userId: string,
): Promise<CycleReport> {
  const [
    programResult,
    sessionsResult,
    sessionLogsResult,
    sorenessResult,
    maxesResult,
    disruptionsResult,
    auxResult,
    formulaHistoryResult,
  ] = await Promise.all([
    supabase.from('programs').select('*').eq('id', programId).single(),
    supabase.from('sessions').select('*').eq('program_id', programId).eq('user_id', userId),
    supabase
      .from('session_logs')
      .select('session_id, session_rpe, actual_sets, completed_at')
      .eq('user_id', userId)
      .in(
        'session_id',
        await supabase
          .from('sessions')
          .select('id')
          .eq('program_id', programId)
          .then((r) => (r.data ?? []).map((s: { id: string }) => s.id)),
      ),
    supabase
      .from('soreness_checkins')
      .select('muscle_group, soreness_level, checked_in_at')
      .eq('user_id', userId),
    supabase
      .from('lifter_maxes')
      .select('lift, one_rm_grams, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: true }),
    supabase
      .from('disruptions')
      .select('id, disruption_type, severity, status, affected_lifts, reported_at')
      .eq('user_id', userId),
    supabase
      .from('auxiliary_assignments')
      .select('lift, block_number, exercises')
      .eq('user_id', userId)
      .eq('program_id', programId),
    supabase
      .from('formula_configs')
      .select('id, created_at, source, overrides')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ])

  const raw: RawCycleData = {
    program: programResult.data as RawCycleData['program'],
    sessions: (sessionsResult.data ?? []) as RawCycleData['sessions'],
    sessionLogs: (sessionLogsResult.data ?? []) as RawCycleData['sessionLogs'],
    sorenessCheckins: (sorenessResult.data ?? []) as RawCycleData['sorenessCheckins'],
    lifterMaxes: (maxesResult.data ?? []) as RawCycleData['lifterMaxes'],
    disruptions: (disruptionsResult.data ?? []) as RawCycleData['disruptions'],
    auxiliaryAssignments: (auxResult.data ?? []) as RawCycleData['auxiliaryAssignments'],
    formulaHistory: (formulaHistoryResult.data ?? []) as RawCycleData['formulaHistory'],
  }

  return assembleCycleReport(raw)
}

export async function getPreviousCycleSummaries(
  userId: string,
  beforeProgramId: string,
  limit = 3,
): Promise<PreviousCycleSummary[]> {
  const { data, error } = await supabase
    .from('cycle_reviews')
    .select('program_id, llm_response, compiled_report, created_at')
    .eq('user_id', userId)
    .neq('program_id', beforeProgramId)
    .not('llm_response', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  if (!data || data.length === 0) return []

  return data.map((row, index) => {
    const report = row.compiled_report as unknown as CycleReport
    const review = row.llm_response as unknown as CycleReview
    const cycleNumber = data.length - index // most recent = highest number
    return extractSummary(report, review, cycleNumber, 0, 0, 0)
  })
}

export async function storeCycleReview(
  programId: string,
  userId: string,
  compiledReport: CycleReport,
  llmResponse: CycleReview,
): Promise<void> {
  // Insert cycle_reviews row
  await supabase.from('cycle_reviews').insert({
    program_id: programId,
    user_id: userId,
    compiled_report: compiledReport as unknown as Record<string, unknown>,
    llm_response: llmResponse as unknown as Record<string, unknown>,
  })

  // Route formula suggestions → pending formula_configs
  for (const suggestion of llmResponse.formulaSuggestions ?? []) {
    await supabase.from('formula_configs').insert({
      user_id: userId,
      is_active: false,
      source: 'ai_suggestion',
      overrides: suggestion.overrides ?? {},
      ai_rationale: `${suggestion.description} — ${suggestion.rationale}`,
    })
  }

  // Route structural suggestions → developer_suggestions (engine-024)
  for (const suggestion of llmResponse.structuralSuggestions ?? []) {
    await supabase.from('developer_suggestions').insert({
      user_id: userId,
      program_id: programId,
      description: suggestion.description,
      rationale: suggestion.rationale,
      developer_note: suggestion.developerNote,
    })
  }
}
