import type { Lift } from '@parakeet/shared-types';
import { LiftSchema } from '@parakeet/shared-types';
import type {
  FatigueLevel,
  FatigueMismatch,
  MuscleGroup,
  PredictedFatigue,
} from '@parakeet/training-engine';
import { MUSCLE_GROUPS } from '@parakeet/shared-types';
import {
  getMusclesForExercise,
  getMusclesForLift,
  rpeSetMultiplier,
} from '@parakeet/training-engine';
import type { DbRow } from '@platform/supabase';
import { fromJson, toJson, typedSupabase } from '@platform/supabase';

type WeeklyBodyReviewRow = DbRow<'weekly_body_reviews'>;

export interface WeeklyBodyReview {
  id: string;
  userId: string;
  programId: string | null;
  weekNumber: number;
  feltSoreness: Partial<Record<MuscleGroup, FatigueLevel>>;
  predictedFatigue: Record<MuscleGroup, PredictedFatigue>;
  mismatches: FatigueMismatch[];
  notes: string | null;
  createdAt: string;
}

export interface SaveWeeklyBodyReviewInput {
  userId: string;
  programId?: string | null;
  weekNumber: number;
  feltSoreness: Partial<Record<MuscleGroup, FatigueLevel>>;
  predictedFatigue: Record<MuscleGroup, PredictedFatigue>;
  mismatches: FatigueMismatch[];
  notes?: string | null;
}

function toWeeklyBodyReview(row: WeeklyBodyReviewRow): WeeklyBodyReview {
  return {
    id: row.id,
    userId: row.user_id,
    programId: row.program_id,
    weekNumber: row.week_number,
    feltSoreness: fromJson<Partial<Record<MuscleGroup, FatigueLevel>>>(
      row.felt_soreness
    ),
    predictedFatigue: fromJson<Record<MuscleGroup, PredictedFatigue>>(
      row.predicted_fatigue
    ),
    mismatches: fromJson<FatigueMismatch[]>(row.mismatches ?? []),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function insertWeeklyBodyReview(
  input: SaveWeeklyBodyReviewInput
): Promise<WeeklyBodyReview> {
  const { data, error } = await typedSupabase
    .from('weekly_body_reviews')
    .insert({
      user_id: input.userId,
      program_id: input.programId ?? null,
      week_number: input.weekNumber,
      felt_soreness: toJson(input.feltSoreness),
      predicted_fatigue: toJson(input.predictedFatigue),
      mismatches: toJson(input.mismatches),
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return toWeeklyBodyReview(data);
}

export async function fetchWeeklyBodyReviews(
  userId: string,
  programId?: string
): Promise<WeeklyBodyReview[]> {
  let query = typedSupabase
    .from('weekly_body_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (programId) {
    query = query.eq('program_id', programId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toWeeklyBodyReview);
}

export async function fetchLatestWeeklyReview(
  userId: string,
  programId: string,
  weekNumber: number
): Promise<WeeklyBodyReview | null> {
  const { data, error } = await typedSupabase
    .from('weekly_body_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .eq('week_number', weekNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toWeeklyBodyReview(data) : null;
}

/** Compute weekly muscle volume from session logs for a given program week.
 *  Returns a full MuscleGroup record (all muscles, defaulting to 0). */
export async function fetchWeeklyVolumeForReview(
  userId: string,
  programId: string,
  weekNumber: number
): Promise<Record<MuscleGroup, number>> {
  const volume = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0])) as Record<
    MuscleGroup,
    number
  >;

  const { data, error } = await typedSupabase
    .from('session_logs')
    .select(
      'actual_sets, auxiliary_sets, sessions!inner(primary_lift, week_number, program_id)'
    )
    .eq('user_id', userId)
    .eq('sessions.program_id', programId)
    .eq('sessions.week_number', weekNumber);

  if (error) throw error;

  for (const row of data ?? []) {
    const sessions = Array.isArray(row.sessions)
      ? row.sessions[0]
      : row.sessions;
    const rawLift = (sessions as { primary_lift: string } | null)?.primary_lift;
    const lift = LiftSchema.safeParse(rawLift).data as Lift | undefined;
    if (!lift) continue;

    type SetWithRpe = { rpe_actual?: number };
    const mainSets = Array.isArray(row.actual_sets)
      ? (row.actual_sets as SetWithRpe[])
      : [];
    const mainEffective = mainSets.reduce(
      (sum, s) => sum + rpeSetMultiplier(s.rpe_actual),
      0
    );
    for (const { muscle, contribution } of getMusclesForLift(lift)) {
      volume[muscle] += Math.floor(mainEffective * contribution);
    }

    const auxSets = Array.isArray(row.auxiliary_sets)
      ? (row.auxiliary_sets as { exercise?: string; rpe_actual?: number }[])
      : [];
    const auxByExercise = new Map<string, number>();
    for (const s of auxSets) {
      if (s.exercise) {
        auxByExercise.set(
          s.exercise,
          (auxByExercise.get(s.exercise) ?? 0) + rpeSetMultiplier(s.rpe_actual)
        );
      }
    }
    for (const [exercise, effective] of auxByExercise) {
      const auxMuscles = getMusclesForExercise(exercise);
      const muscles =
        auxMuscles.length > 0 ? auxMuscles : getMusclesForLift(lift);
      for (const { muscle, contribution } of muscles) {
        volume[muscle] += Math.floor(effective * contribution);
      }
    }
  }

  return volume;
}
