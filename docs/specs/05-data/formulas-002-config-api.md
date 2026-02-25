# Spec: Formula Config (User Overrides)

**Status**: Implemented
**Domain**: Formula Management

## What This Covers

CRUD helpers for user formula config overrides. Supabase SDK called directly from the app — no backend. Supports the Formula Editor screen and the AI suggestion flow.

## Tasks

**`apps/parakeet/lib/formulas.ts`:**
- [x] `getFormulaConfig(userId: string): Promise<FormulaConfig>` — returns merged config: defaults + active user override
- [x] `createFormulaOverride(userId: string, input: { overrides, source, ai_rationale? }): Promise<void>`
  - Deactivates current active row, inserts new active row
- [x] `getFormulaHistory(userId: string)` — returns all versions newest first
- [x] `deactivateFormulaConfig(configId: string, userId: string): Promise<void>`
  - Deactivates specified version and re-activates the most recent remaining row

**`mergeFormulaConfig` helper (in `packages/training-engine/src/config/merge-formula-config.ts`):**
- [x] Deep-merges `overrides` on top of `DEFAULT_FORMULA_CONFIG`
  - Returns a complete `FormulaConfig` (no missing keys)

**React Query hooks (`apps/parakeet/hooks/useFormulas.ts`):**
- [x] `useFormulaConfig()` — wraps `getFormulaConfig(user.id)`
- [x] `useFormulaHistory()` — wraps `getFormulaHistory(user.id)`

## Dependencies

- [formulas-001-defaults-api.md](./formulas-001-defaults-api.md)
- [programs-004-program-versioning.md](../06-programs/programs-004-program-versioning.md)
