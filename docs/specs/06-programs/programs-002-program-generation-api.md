# Spec: Program Generation (Supabase Direct)

**Status**: Implemented
**Domain**: Program Management

## What This Covers

Creating a new training program: calling the training engine locally, writing the structural scaffolding (session placeholders) to Supabase, and generating auxiliary assignments for the program. No REST API server — all computation runs in the app.

## Tasks

**`apps/parakeet/lib/programs.ts`:**
- [x] `createProgram(input: CreateProgramInput): Promise<Program>`
  1. Get current 1RMs and formula config
  2. Generate structural scaffolding locally via `generateProgram()`
  3. Get auxiliary pool and compute assignments via `generateAuxiliaryAssignments()`
  4. Archive any currently active program (`status = 'archived'`)
  5. Insert program row
  6. Bulk insert session scaffolds (`planned_sets = null` for all)
  7. Insert auxiliary assignments

**`CreateProgramInput` type:**
```typescript
interface CreateProgramInput {
  totalWeeks: 10 | 12 | 14   // standard Cube Method lengths
  trainingDaysPerWeek: 3 | 4
  startDate: Date
}
```

**Onboarding screen `apps/parakeet/app/(auth)/onboarding/program-settings.tsx`:**
- [x] Inputs: total weeks (picker), days per week (picker), start date (date picker)
- [x] "Preview Program" button → navigate to review screen showing Week 1 session structure

**Program review screen `apps/parakeet/app/(auth)/onboarding/review.tsx`:**
- [x] Shows Week 1: day-by-day view with lift, intensity type, auxiliary names
- [x] "Activate Program" button → calls `createProgram()` → navigates to Today tab

## Dependencies

- [engine-004-program-generator.md](../04-engine/engine-004-program-generator.md)
- [engine-008-auxiliary-exercise-rotation.md](../04-engine/engine-008-auxiliary-exercise-rotation.md)
- [programs-001-lifter-maxes-api.md](./programs-001-lifter-maxes-api.md)
- [infra-005-database-migrations.md](../01-infra/infra-005-database-migrations.md)
