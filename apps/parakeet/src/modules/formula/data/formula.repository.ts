// @spec docs/features/programs/spec-formula-config.md
import { typedSupabase } from '@platform/supabase';
import type { DbInsert, DbRow, Json } from '@platform/supabase';

export type FormulaConfigRow = DbRow<'formula_configs'>;
export type FormulaConfigInsert = Omit<
  DbInsert<'formula_configs'>,
  'overrides'
> & {
  overrides: Json;
};

export async function getActiveFormulaConfigRow(
  userId: string
): Promise<FormulaConfigRow | null> {
  const { data, error } = await typedSupabase
    .from('formula_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function deactivateActiveFormulaConfigs(
  userId: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('formula_configs')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) throw error;
}

export async function insertFormulaConfig(
  input: FormulaConfigInsert
): Promise<void> {
  const { error } = await typedSupabase.from('formula_configs').insert(input);

  if (error) throw error;
}

export async function listFormulaConfigs(
  userId: string
): Promise<FormulaConfigRow[]> {
  const { data, error } = await typedSupabase
    .from('formula_configs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listPendingAiFormulaSuggestions(
  userId: string
): Promise<FormulaConfigRow[]> {
  const { data, error } = await typedSupabase
    .from('formula_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('source', 'ai_suggestion')
    .eq('is_active', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function deactivateFormulaConfigById(
  configId: string,
  userId: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('formula_configs')
    .update({ is_active: false })
    .eq('id', configId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getMostRecentInactiveFormulaConfig(
  userId: string
): Promise<Pick<FormulaConfigRow, 'id'> | null> {
  const { data, error } = await typedSupabase
    .from('formula_configs')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function activateFormulaConfigById(
  configId: string
): Promise<void> {
  const { error } = await typedSupabase
    .from('formula_configs')
    .update({ is_active: true })
    .eq('id', configId);

  if (error) throw error;
}
