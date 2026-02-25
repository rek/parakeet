# Spec: Program Read (Supabase Direct)

**Status**: Implemented
**Domain**: Program Management

## What This Covers

Reading program data from Supabase. Used by the Program tab (week grid) and Today screen. No REST API server — Supabase SDK called directly from the app.

## Tasks

**`apps/parakeet/lib/programs.ts` (read helpers):**
- [x] `getActiveProgram(userId: string): Promise<Program | null>` — fetches active program with sessions (excluding `planned_sets` JSONB for performance)
- [x] `getProgram(programId: string): Promise<Program | null>` — fetch specific program with all sessions (RLS ensures ownership)
- [x] `listPrograms(userId: string): Promise<ProgramSummary[]>` — list all programs summary only (no sessions)
- [x] `updateProgramStatus(programId: string, status: 'completed' | 'archived'): Promise<void>` — guarded to only transition active programs

**Note on `planned_sets`:** Sessions are fetched without `planned_sets` in list views — the JSONB blob is large and not needed for the week grid. The full session (including `planned_sets` if JIT has run) is fetched only when the user opens a specific session.

## Dependencies

- [programs-002-program-generation-api.md](./programs-002-program-generation-api.md)
- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
