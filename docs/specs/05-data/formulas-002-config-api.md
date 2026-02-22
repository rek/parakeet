# Spec: Formula Config API (User Overrides)

**Status**: Planned
**Domain**: Formula Management

## What This Covers

CRUD endpoints for user formula config overrides. Supports the Formula Editor screen in the mobile app and the AI suggestion flow.

## Tasks

**Repository (`apps/api/src/modules/formulas/formulas.repository.ts`):**
- `findActive(userId: string): Promise<FormulaConfig | null>` — the row where `is_active = true`
- `findAll(userId: string): Promise<FormulaConfig[]>` — all versions, newest first
- `create(userId: string, data: CreateFormulaConfigData): Promise<FormulaConfig>`
  - Increments version number
  - Sets `is_active = true` on new row
  - Sets `is_active = false` on previous active row
  - All in a transaction
- `deactivate(configId: string, userId: string): Promise<FormulaConfig>` — sets `is_active = false` and activates the one before it

**Service:**
- `getActiveConfig(userId: string): Promise<MergedFormulaConfig>`
  - Fetches active override row (or returns empty overrides if none)
  - Calls `mergeFormulaConfig(DEFAULT_FORMULA_CONFIG, userOverrides)` from training-engine
  - Returns merged config (what the engine will actually use)

- `createOverride(userId: string, input: CreateFormulaConfigInput): Promise<FormulaConfig>`
  - Validates overrides shape (see formulas-003)
  - Creates new version
  - Optionally triggers program regeneration (if `regenerate_program: true` in request body)

**Routes:**
- `GET /v1/formulas/config` — returns merged (defaults + active overrides)
- `POST /v1/formulas/config` — create new override version
  - Request body: `{ overrides: Partial<FormulaConfig>, source: 'user' | 'ai_suggestion', ai_rationale?: string, regenerate_program?: boolean }`
- `GET /v1/formulas/history` — list all versions (paginated, newest first)
- `DELETE /v1/formulas/config/:configId` — deactivate this version, revert to previous

## Dependencies

- [formulas-001-defaults-api.md](./formulas-001-defaults-api.md)
- [programs-004-program-versioning.md](../06-programs/programs-004-program-versioning.md)
