# Spec: Formula Config (User Overrides)

**Status**: Implemented
**Domain**: Formula Management

## What This Covers

CRUD helpers for user formula config overrides. Supabase SDK called directly from the app — no backend. Supports the Formula Editor screen and the AI suggestion flow.

## Tasks

**`apps/mobile/lib/formulas.ts`:**

```typescript
import { supabase } from './supabase'
import { DEFAULT_FORMULA_CONFIG } from '@parakeet/training-engine'
import type { FormulaConfig } from '@parakeet/shared-types'

// Returns merged config: defaults + active user override
export async function getFormulaConfig(userId: string): Promise<FormulaConfig> {
  const { data } = await supabase
    .from('formula_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data
    ? mergeFormulaConfig(DEFAULT_FORMULA_CONFIG, data.overrides)
    : DEFAULT_FORMULA_CONFIG
}

// Creates a new override version; deactivates the previous active row
export async function createFormulaOverride(
  userId: string,
  input: {
    overrides: Partial<FormulaConfig>
    source: 'user' | 'ai_suggestion'
    ai_rationale?: string
  }
): Promise<void> {
  // Deactivate current active row
  await supabase
    .from('formula_configs')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)

  // Insert new active row (version auto-incremented via DB trigger or computed in app)
  await supabase.from('formula_configs').insert({
    user_id: userId,
    overrides: input.overrides,
    source: input.source,
    ai_rationale: input.ai_rationale ?? null,
    is_active: true,
  })
}

// Returns all versions for the history view, newest first
export async function getFormulaHistory(userId: string) {
  const { data } = await supabase
    .from('formula_configs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// Deactivates a specific version and re-activates the one before it
export async function deactivateFormulaConfig(
  configId: string,
  userId: string
): Promise<void> {
  await supabase
    .from('formula_configs')
    .update({ is_active: false })
    .eq('id', configId)
    .eq('user_id', userId)

  // Activate the most recent remaining row
  const { data: previous } = await supabase
    .from('formula_configs')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (previous) {
    await supabase
      .from('formula_configs')
      .update({ is_active: true })
      .eq('id', previous.id)
  }
}
```

**`mergeFormulaConfig` helper (in `packages/training-engine/src/config/merge-formula-config.ts`):**
- Deep-merges `overrides` on top of `DEFAULT_FORMULA_CONFIG`
- Returns a complete `FormulaConfig` (no missing keys)

**React Query hooks (`apps/mobile/hooks/useFormulas.ts`):**
- `useFormulaConfig()` — wraps `getFormulaConfig(user.id)`
- `useFormulaHistory()` — wraps `getFormulaHistory(user.id)`

## Dependencies

- [formulas-001-defaults-api.md](./formulas-001-defaults-api.md)
- [programs-004-program-versioning.md](../06-programs/programs-004-program-versioning.md)
