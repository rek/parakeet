// @spec docs/features/cycle-review/spec-generator.md
import { getSessionSetsBySessionIds } from '@modules/session';
import type { CycleReview } from '@parakeet/shared-types';
import type {
  CycleReport,
  RawCycleData,
  RawWeeklyBodyReview,
  RawWeeklyBodyReviewMismatch,
} from '@parakeet/training-engine';
import type { Json } from '@platform/supabase';
import { fromJson, toJson, typedSupabase } from '@platform/supabase';

export function subscribeToCycleReviewInserts(
  programId: string,
  onInsert: () => void
): () => void {
  const channel = typedSupabase
    .channel(`cycle-review-${programId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'cycle_reviews',
        filter: `program_id=eq.${programId}`,
      },
      onInsert
    )
    .subscribe();

  return () => {
    typedSupabase.removeChannel(channel);
  };
}

export async function fetchCycleReviewByProgram(
  programId: string,
  userId: string
): Promise<CycleReview | null> {
  const { data, error } = await typedSupabase
    .from('cycle_reviews')
    .select('llm_response')
    .eq('program_id', programId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? fromJson<CycleReview>(data.llm_response) : null;
}

export async function fetchCycleReportSourceData(
  programId: string,
  userId: string
): Promise<RawCycleData> {
  const [
    programResult,
    sessionsResult,
    sorenessResult,
    maxesResult,
    disruptionsResult,
    auxResult,
    formulaHistoryResult,
    bodyReviewsResult,
  ] = await Promise.all([
    typedSupabase
      .from('programs')
      .select('id, total_weeks, start_date, status')
      .eq('id', programId)
      .eq('user_id', userId)
      .single(),
    typedSupabase
      .from('sessions')
      .select(
        'id, week_number, block_number, primary_lift, intensity_type, status, planned_sets'
      )
      .eq('program_id', programId)
      .eq('user_id', userId),
    typedSupabase
      .from('soreness_checkins')
      .select('ratings, recorded_at')
      .eq('user_id', userId),
    typedSupabase
      .from('lifter_maxes')
      .select(
        'squat_1rm_grams, bench_1rm_grams, deadlift_1rm_grams, recorded_at'
      )
      .eq('user_id', userId)
      .order('recorded_at', { ascending: true }),
    typedSupabase
      .from('disruptions')
      .select(
        'id, disruption_type, severity, status, affected_lifts, reported_at'
      )
      .eq('user_id', userId),
    typedSupabase
      .from('auxiliary_assignments')
      .select('lift, block_number, exercise_1, exercise_2')
      .eq('user_id', userId)
      .eq('program_id', programId),
    typedSupabase
      .from('formula_configs')
      .select('id, created_at, source, overrides')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    typedSupabase
      .from('weekly_body_reviews')
      .select(
        'week_number, mismatches, felt_soreness, predicted_fatigue, created_at'
      )
      .eq('user_id', userId)
      .eq('program_id', programId)
      .order('created_at', { ascending: true }),
  ]);

  if (programResult.error) throw programResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (sorenessResult.error) throw sorenessResult.error;
  if (maxesResult.error) throw maxesResult.error;
  if (disruptionsResult.error) throw disruptionsResult.error;
  if (auxResult.error) throw auxResult.error;
  if (formulaHistoryResult.error) throw formulaHistoryResult.error;
  if (bodyReviewsResult.error) throw bodyReviewsResult.error;

  const sessions = (sessionsResult.data ?? []).map((row) => ({
    id: row.id,
    week_number: row.week_number,
    block_number: row.block_number ?? 0,
    primary_lift: row.primary_lift,
    intensity_type: row.intensity_type,
    status: row.status,
    planned_sets: Array.isArray(row.planned_sets) ? row.planned_sets : null,
  }));

  const sessionIds = sessions.map((s) => s.id);
  let sessionLogs: RawCycleData['sessionLogs'] = [];
  if (sessionIds.length > 0) {
    const [logsResult, setsMap] = await Promise.all([
      typedSupabase
        .from('session_logs')
        .select('session_id, session_rpe, completed_at, logged_at')
        .eq('user_id', userId)
        .in('session_id', sessionIds),
      getSessionSetsBySessionIds(sessionIds),
    ]);
    if (logsResult.error) throw logsResult.error;
    sessionLogs = (logsResult.data ?? []).map((row) => ({
      session_id: row.session_id,
      session_rpe: row.session_rpe,
      actual_sets: row.session_id
        ? (setsMap.get(row.session_id)?.primary ?? null)
        : null,
      completed_at: row.completed_at ?? row.logged_at,
    }));
  }

  const sorenessCheckins = (sorenessResult.data ?? []).flatMap((row) => {
    const ratings = row.ratings as Json;
    if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings))
      return [];
    return Object.entries(ratings).flatMap(([muscle, level]) => {
      if (typeof level !== 'number') return [];
      return [
        {
          muscle_group: muscle,
          soreness_level: level,
          checked_in_at: row.recorded_at,
        },
      ];
    });
  });

  const lifterMaxes = (maxesResult.data ?? []).flatMap((row) => [
    {
      lift: 'squat',
      one_rm_grams: row.squat_1rm_grams,
      recorded_at: row.recorded_at,
    },
    {
      lift: 'bench',
      one_rm_grams: row.bench_1rm_grams,
      recorded_at: row.recorded_at,
    },
    {
      lift: 'deadlift',
      one_rm_grams: row.deadlift_1rm_grams,
      recorded_at: row.recorded_at,
    },
  ]);

  const auxiliaryAssignments = (auxResult.data ?? []).map((row) => ({
    lift: row.lift,
    block_number: row.block_number,
    exercises: [row.exercise_1, row.exercise_2].filter(
      (e) => typeof e === 'string' && e.length > 0
    ),
  }));

  return {
    program: {
      id: programResult.data.id,
      total_weeks: programResult.data.total_weeks ?? 0,
      start_date: programResult.data.start_date,
      status: programResult.data.status,
    },
    sessions,
    sessionLogs: sessionLogs,
    sorenessCheckins,
    lifterMaxes,
    disruptions: (disruptionsResult.data ?? []).map((row) => ({
      id: row.id,
      disruption_type: row.disruption_type,
      severity: row.severity as 'minor' | 'moderate' | 'major',
      status: row.status,
      affected_lifts: row.affected_lifts,
      reported_at: row.reported_at,
    })),
    auxiliaryAssignments,
    formulaHistory: (formulaHistoryResult.data ?? []).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      source: row.source,
      overrides:
        row.overrides &&
        typeof row.overrides === 'object' &&
        !Array.isArray(row.overrides)
          ? (row.overrides as Record<string, unknown>)
          : {},
    })),
    weeklyBodyReviews: (bodyReviewsResult.data ?? []).map(
      (row): RawWeeklyBodyReview => ({
        week_number: row.week_number,
        mismatches: fromJson<RawWeeklyBodyReviewMismatch[]>(
          row.mismatches ?? []
        ),
        felt_soreness: fromJson<Record<string, number>>(row.felt_soreness),
        predicted_fatigue: fromJson<
          Record<string, { predicted: number; volumePct: number }>
        >(row.predicted_fatigue),
        created_at: row.created_at,
      })
    ),
  };
}

export async function fetchPreviousCycleReviewRows(
  userId: string,
  beforeProgramId: string,
  limit: number
): Promise<
  Array<{ program_id: string; llm_response: Json; compiled_report: Json }>
> {
  const { data, error } = await typedSupabase
    .from('cycle_reviews')
    .select('program_id, llm_response, compiled_report, generated_at')
    .eq('user_id', userId)
    .neq('program_id', beforeProgramId)
    .not('llm_response', 'is', null)
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    program_id: row.program_id,
    llm_response: row.llm_response,
    compiled_report: row.compiled_report,
  }));
}

export async function insertCycleReviewRow(input: {
  programId: string;
  userId: string;
  compiledReport: CycleReport;
  llmResponse: CycleReview;
}): Promise<void> {
  // Upsert with ignoreDuplicates so concurrent generation attempts (onCycleComplete +
  // user-triggered) don't race to violate the (user_id, program_id) unique constraint.
  // The first writer wins; subsequent writes for the same program are silently dropped.
  const { error } = await typedSupabase.from('cycle_reviews').upsert(
    {
      program_id: input.programId,
      user_id: input.userId,
      compiled_report: toJson(input.compiledReport),
      llm_response: toJson(input.llmResponse),
    },
    { onConflict: 'user_id,program_id', ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function insertFormulaSuggestionConfig(input: {
  userId: string;
  source: string;
  overrides: Record<string, unknown>;
  aiRationale: string;
}): Promise<void> {
  const { error } = await typedSupabase.from('formula_configs').insert({
    user_id: input.userId,
    is_active: false,
    source: input.source,
    overrides: toJson(input.overrides),
    ai_rationale: input.aiRationale,
  });
  if (error) throw error;
}

export async function insertDeveloperSuggestion(input: {
  userId: string;
  programId: string;
  description: string;
  rationale: string;
  developerNote?: string;
}): Promise<void> {
  const { error } = await typedSupabase.from('developer_suggestions').insert({
    user_id: input.userId,
    program_id: input.programId,
    description: input.description,
    rationale: input.rationale,
    developer_note: input.developerNote ?? '',
  });
  if (error) throw error;
}
