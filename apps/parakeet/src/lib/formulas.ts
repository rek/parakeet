import { mergeFormulaConfig, getDefaultFormulaConfig } from '@parakeet/training-engine'
import type { FormulaConfig } from '@parakeet/training-engine'
import { supabase } from './supabase'

export async function getFormulaConfig(
  userId: string,
  biologicalSex?: 'female' | 'male',
): Promise<FormulaConfig> {
  const { data } = await supabase
    .from('formula_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  const base = getDefaultFormulaConfig(biologicalSex)
  return data ? mergeFormulaConfig(base, data.overrides) : base
}

export async function createFormulaOverride(
  userId: string,
  input: {
    overrides: Partial<FormulaConfig>
    source: 'user' | 'ai_suggestion'
    ai_rationale?: string
  },
): Promise<void> {
  await supabase
    .from('formula_configs')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)

  await supabase.from('formula_configs').insert({
    user_id: userId,
    overrides: input.overrides,
    source: input.source,
    ai_rationale: input.ai_rationale ?? null,
    is_active: true,
  })
}

export async function getFormulaHistory(userId: string) {
  const { data } = await supabase
    .from('formula_configs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function deactivateFormulaConfig(configId: string, userId: string): Promise<void> {
  await supabase
    .from('formula_configs')
    .update({ is_active: false })
    .eq('id', configId)
    .eq('user_id', userId)

  const { data: previous } = await supabase
    .from('formula_configs')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (previous) {
    await supabase.from('formula_configs').update({ is_active: true }).eq('id', previous.id)
  }
}
