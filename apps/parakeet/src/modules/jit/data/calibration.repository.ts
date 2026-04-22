import type { ModifierSource } from '@parakeet/training-engine';
import { typedSupabase } from '@platform/supabase';

export interface CalibrationRow {
  modifier_source: string;
  adjustment: number;
  confidence: string;
  sample_count: number;
  mean_bias: number | null;
}

/** Fetch raw modifier calibration rows for running-mean computation. */
export async function fetchRawModifierCalibrations(userId: string): Promise<
  Array<{
    modifier_source: string;
    sample_count: number;
    mean_bias: number | null;
    adjustment: number;
  }>
> {
  const { data, error } = await typedSupabase
    .from('modifier_calibrations')
    .select('modifier_source, sample_count, mean_bias, adjustment')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

/** Fetch all modifier calibrations for a user. Returns a map of source → adjustment. */
export async function fetchModifierCalibrations(userId: string) {
  const { data, error } = await typedSupabase
    .from('modifier_calibrations')
    .select('modifier_source, adjustment, confidence, sample_count, mean_bias')
    .eq('user_id', userId);

  if (error) throw error;

  const result: Partial<Record<ModifierSource, number>> = {};
  for (const row of data ?? []) {
    const source = row.modifier_source as ModifierSource;
    // Only apply adjustments with medium+ confidence
    if (row.confidence === 'medium' || row.confidence === 'high') {
      result[source] = row.adjustment;
    }
  }
  return result;
}

/** Upsert a calibration result for a specific modifier source. */
export async function upsertModifierCalibration({
  userId,
  modifierSource,
  adjustment,
  confidence,
  sampleCount,
  meanBias,
}: {
  userId: string;
  modifierSource: ModifierSource;
  adjustment: number;
  confidence: string;
  sampleCount: number;
  meanBias: number;
}) {
  const { error } = await typedSupabase.from('modifier_calibrations').upsert(
    {
      user_id: userId,
      modifier_source: modifierSource,
      adjustment,
      confidence,
      sample_count: sampleCount,
      mean_bias: meanBias,
      calibrated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,modifier_source' }
  );

  if (error) throw error;
}
