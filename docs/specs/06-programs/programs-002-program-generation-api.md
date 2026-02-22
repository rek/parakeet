# Spec: Program Generation (Supabase Direct)

**Status**: Planned
**Domain**: Program Management

## What This Covers

Creating a new training program: calling the training engine locally, writing the structural scaffolding (session placeholders) to Supabase, and generating auxiliary assignments for the program. No REST API server — all computation runs in the app.

## Tasks

**`apps/mobile/lib/programs.ts`:**

```typescript
async function createProgram(input: CreateProgramInput): Promise<Program> {
  const userId = (await supabase.auth.getUser()).data.user!.id

  // 1. Get current 1RMs and formula config
  const maxes = await getCurrentMaxes(userId)
  const formulaConfig = await getFormulaConfig(userId)  // merged system defaults + user overrides

  // 2. Generate structural scaffolding locally (deterministic, synchronous)
  const scaffold = generateProgram({
    totalWeeks: input.totalWeeks,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    startDate: input.startDate,
  })

  // 3. Get auxiliary pool and compute assignments
  const auxiliaryPool = await getAuxiliaryPools(userId)
  const blockOffset = await computeBlockOffset(userId)
  const auxiliaryAssignments = generateAuxiliaryAssignments(
    scaffold.programId,
    input.totalWeeks,
    auxiliaryPool,
    blockOffset
  )

  // 4. Archive any currently active program
  await supabase
    .from('programs')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .eq('status', 'active')

  // 5. Insert program row
  const { data: program } = await supabase.from('programs').insert({
    user_id: userId,
    status: 'active',
    total_weeks: input.totalWeeks,
    training_days_per_week: input.trainingDaysPerWeek,
    start_date: input.startDate.toISOString().split('T')[0],
    lifter_maxes_id: maxes!.id,
    formula_config_id: formulaConfig.id,
  }).select().single()

  // 6. Bulk insert session scaffolds (planned_sets = null for all)
  const sessionRows = scaffold.sessions.map(s => ({
    user_id: userId,
    program_id: program.id,
    week_number: s.weekNumber,
    day_number: s.dayNumber,
    primary_lift: s.primaryLift,
    intensity_type: s.intensityType,
    block_number: s.blockNumber,
    is_deload: s.isDeload,
    planned_date: s.plannedDate.toISOString().split('T')[0],
    status: 'planned',
    planned_sets: null,         // populated by JIT when session opens
    jit_generated_at: null,
  }))
  await supabase.from('sessions').insert(sessionRows)

  // 7. Insert auxiliary assignments
  await supabase.from('auxiliary_assignments').insert(
    auxiliaryAssignments.map(a => ({ ...a, user_id: userId }))
  )

  return program
}
```

**`CreateProgramInput` type:**
```typescript
interface CreateProgramInput {
  totalWeeks: 10 | 12 | 14   // standard Cube Method lengths
  trainingDaysPerWeek: 3 | 4
  startDate: Date
}
```

**Onboarding screen `apps/mobile/app/(auth)/onboarding/program-settings.tsx`:**
- Inputs: total weeks (picker), days per week (picker), start date (date picker)
- "Preview Program" button → navigate to review screen showing Week 1 session structure

**Program review screen `apps/mobile/app/(auth)/onboarding/review.tsx`:**
- Shows Week 1: day-by-day view with lift, intensity type, auxiliary names
- "Activate Program" button → calls `createProgram()` → navigates to Today tab

## Dependencies

- [engine-004-program-generator.md](../04-engine/engine-004-program-generator.md)
- [engine-008-auxiliary-exercise-rotation.md](../04-engine/engine-008-auxiliary-exercise-rotation.md)
- [programs-001-lifter-maxes-api.md](./programs-001-lifter-maxes-api.md)
- [infra-005-database-migrations.md](../01-infra/infra-005-database-migrations.md)
