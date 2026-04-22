// @spec docs/features/lipedema-tracking/spec-data-layer.md
import { typedSupabase } from '@platform/supabase';
import type { DbInsert, DbRow, DbUpdate } from '@platform/supabase';

import type { LipedemaMeasurement } from '../model/types';

type Row = DbRow<'lipedema_measurements'>;

const SELECT =
  'id, user_id, recorded_date, thigh_mid_l_mm, thigh_mid_r_mm, calf_max_l_mm, calf_max_r_mm, ankle_l_mm, ankle_r_mm, upper_arm_l_mm, upper_arm_r_mm, wrist_l_mm, wrist_r_mm, pain_0_10, swelling_0_10, notes, photo_url, created_at, updated_at';

function rowToModel(r: Row): LipedemaMeasurement {
  return {
    id: r.id,
    userId: r.user_id,
    recordedDate: r.recorded_date,
    thighMidLMm: r.thigh_mid_l_mm,
    thighMidRMm: r.thigh_mid_r_mm,
    calfMaxLMm: r.calf_max_l_mm,
    calfMaxRMm: r.calf_max_r_mm,
    ankleLMm: r.ankle_l_mm,
    ankleRMm: r.ankle_r_mm,
    upperArmLMm: r.upper_arm_l_mm,
    upperArmRMm: r.upper_arm_r_mm,
    wristLMm: r.wrist_l_mm,
    wristRMm: r.wrist_r_mm,
    pain_0_10: r.pain_0_10,
    swelling_0_10: r.swelling_0_10,
    notes: r.notes,
    photoUrl: r.photo_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await typedSupabase.auth.getUser();
  return user?.id ?? null;
}

export async function fetchMeasurements(
  limit = 52,
): Promise<LipedemaMeasurement[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await typedSupabase
    .from('lipedema_measurements')
    .select(SELECT)
    .eq('user_id', userId)
    .order('recorded_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToModel);
}

export type UpsertInput = Omit<
  DbInsert<'lipedema_measurements'>,
  'id' | 'user_id' | 'created_at' | 'updated_at'
> & {
  // Explicit recorded_date is required for conflict target; surfaced
  // here as non-optional to catch the case early at call sites.
  recorded_date: string;
};

export async function upsertMeasurement(
  input: UpsertInput,
): Promise<LipedemaMeasurement> {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');
  const payload: DbInsert<'lipedema_measurements'> = {
    ...input,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await typedSupabase
    .from('lipedema_measurements')
    .upsert(payload, { onConflict: 'user_id,recorded_date' })
    .select(SELECT)
    .single();
  if (error) throw error;
  return rowToModel(data);
}

export async function deleteMeasurement(id: string): Promise<void> {
  const { error } = await typedSupabase
    .from('lipedema_measurements')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export type MeasurementPatch = Partial<
  Omit<DbUpdate<'lipedema_measurements'>, 'id' | 'user_id' | 'created_at'>
>;
