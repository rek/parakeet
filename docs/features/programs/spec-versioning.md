# Spec: Program Versioning and Regeneration

**Status**: Implemented
**Domain**: Program Management

## What This Covers

Creating a new program when the user updates their maxes or wants a fresh start. The old program is archived, its sessions remain intact for history, and a new program is created with fresh session scaffolds. All done via Supabase SDK directly.

## Tasks

**`apps/parakeet/lib/programs.ts` (regeneration helper):**
- [x] `regenerateProgram(input: RegenerateProgramInput): Promise<Program>`
  1. Fetch updated maxes and formula config
  2. Generate new scaffold with `generateProgram()`
  3. Generate new auxiliary assignments with updated block offset
  4. Archive current active program
  5. Compute next version number (scoped per user)
  6. Insert new program row
  7. Bulk insert new session scaffolds (`planned_sets = null`)
  8. Insert auxiliary assignments for new program

**Version counter:** Scoped per user — first program is version 1, each subsequent program increments.

**History integrity:**
- [x] Old program sessions remain in DB with their original statuses (completed, skipped, planned)
- [x] Old `planned_sets` data on completed sessions is preserved — never deleted
- [x] Old program `status = 'archived'` — visible in program history list

**`RegenerateProgramInput` type:**
```typescript
interface RegenerateProgramInput {
  totalWeeks: 10 | 12 | 14
  trainingDaysPerWeek: 3 | 4
  startDate: Date
}
```

## Dependencies

- [programs-002-program-generation-api.md](./programs-002-program-generation-api.md)
- [programs-003-program-read-api.md](./programs-003-program-read-api.md)
