# Spec: Program Versioning and Regeneration

**Status**: Planned
**Domain**: Program Management

## What This Covers

The `POST /v1/programs/:programId/regenerate` endpoint and the versioning logic that preserves program history while allowing users to create a new program with updated maxes or formula.

## Tasks

**Service (`programs.service.ts` addition):**
- `regenerateProgram(userId: string, programId: string, input: RegenerateProgramInput): Promise<Program>`
  - Input: optionally specify new `lifter_maxes_id` and/or `formula_config_id`; defaults to current if not provided
  - Fetch the existing program to confirm it belongs to the user
  - Call `generateProgram()` with updated inputs
  - In transaction:
    - Set existing program `status = 'archived'`
    - Create new program with `version = previous_version + 1`
    - Create new sessions for the new program
    - Previous sessions are NOT deleted — they remain linked to the old program for history
  - Return the new program

**Version counter:**
- `version` is scoped per user: user's first program is version 1, next is 2, etc.
- Query: `SELECT MAX(version) FROM programs WHERE user_id = $1` + 1

**Route:**
- `POST /v1/programs/:programId/regenerate`
  - Request body: `{ lifter_maxes_id?: string, formula_config_id?: string, total_weeks?: number, training_days_per_week?: number, start_date?: string }`
  - Returns the new program (not the archived one)

**History integrity:**
- Old program's `program_snapshot` JSONB is immutable — never updated after creation
- Old sessions remain in DB with their original `planned_sets` and whatever `status` they reached (completed, skipped, etc.)
- The new program starts fresh with `planned` sessions

## Dependencies

- [programs-002-program-generation-api.md](./programs-002-program-generation-api.md)
- [programs-003-program-read-api.md](./programs-003-program-read-api.md)
