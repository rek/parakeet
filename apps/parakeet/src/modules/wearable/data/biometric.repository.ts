// @spec docs/features/wearable/spec-biometric-data.md
import { typedSupabase } from '@platform/supabase';
import {
  BiometricReadingSchema,
  type BiometricReading,
  type BiometricReadingInsert,
  type BiometricType,
} from '@parakeet/shared-types';

export async function upsertBiometricReadings(
  userId: string,
  readings: Omit<BiometricReadingInsert, 'user_id'>[]
): Promise<{ insertedCount: number }> {
  if (readings.length === 0) return { insertedCount: 0 };
  const rows = readings.map((r) => ({ ...r, user_id: userId }));
  const { data, error } = await typedSupabase
    .from('biometric_readings')
    .upsert(rows, {
      onConflict: 'user_id,type,recorded_at',
      ignoreDuplicates: true,
    })
    .select('id');
  if (error) throw error;
  return { insertedCount: data?.length ?? 0 };
}

export async function fetchReadingsForBaseline(
  userId: string,
  type: BiometricType,
  days: number
): Promise<BiometricReading[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await typedSupabase
    .from('biometric_readings')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => BiometricReadingSchema.parse(row));
}

export async function fetchLatestReading(
  userId: string,
  type: BiometricType
): Promise<BiometricReading | null> {
  const { data, error } = await typedSupabase
    .from('biometric_readings')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? BiometricReadingSchema.parse(data) : null;
}
