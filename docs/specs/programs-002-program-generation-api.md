# Spec: Program Generation API

**Status**: Planned
**Domain**: Program Management

## What This Covers

The `POST /v1/programs` endpoint — the most complex endpoint in the API. Calls the training engine and writes the program + sessions in a single database transaction.

## Tasks

**Service (`apps/api/src/modules/programs/programs.service.ts`):**
- `generateProgram(userId: string, input: CreateProgramInput): Promise<Program>`
  1. Resolve `lifter_maxes` record (by `lifter_maxes_id`, or fetch current if not provided)
  2. Resolve `formula_config` record (by `formula_config_id`, or fetch active; fall back to system defaults)
  3. Merge formula config: `mergeFormulaConfig(DEFAULT_FORMULA_CONFIG, userOverrides)` from training-engine
  4. Convert DB tenths to lbs for engine input: `squat_1rm_lbs = squat_1rm_tenths / 10`
  5. Call `generateProgram(...)` from `@parakeet/training-engine` — deterministic, synchronous
  6. Begin database transaction:
     a. Archive any currently active program (set `status = 'archived'`)
     b. Compute next `version` number for this user
     c. Insert `programs` row with `program_snapshot = JSON.stringify(generatedProgram)`, status='active'
     d. Insert one `sessions` row per session in the generated program (denormalized planned_sets JSONB)
     e. Publish `program.generated` event to Pub/Sub
  7. Commit transaction; return the full `Program` response

**Repository (`apps/api/src/modules/programs/programs.repository.ts`):**
- `create(data): Promise<Program>` — insert program + bulk insert sessions in transaction
- `findActive(userId: string): Promise<Program | null>`
- `archiveCurrent(userId: string, db: PoolClient): Promise<void>` — takes DB client for transaction participation

**Routes:**
- `POST /v1/programs` — Validate request, call service, return program with sessions

**Error handling:**
- If `lifter_maxes_id` not found for user → 404
- If `formula_config_id` not found for user → 404
- If training engine throws `ProgramGenerationError` → 422 with details
- If transaction fails → 500, log full error (do not expose internals to client)

## Dependencies

- [engine-004-program-generator.md](./engine-004-program-generator.md)
- [programs-001-lifter-maxes-api.md](./programs-001-lifter-maxes-api.md)
- [infra-005-database-migrations.md](./infra-005-database-migrations.md)
