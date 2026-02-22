# Spec: Program Versioning and Regeneration

**Status**: Planned
**Domain**: Program Management

## What This Covers

Creating a new program when the user updates their maxes or wants a fresh start. The old program is archived, its sessions remain intact for history, and a new program is created with fresh session scaffolds. All done via Supabase SDK directly.

## Tasks

**`apps/mobile/lib/programs.ts` (regeneration helper):**

```typescript
async function regenerateProgram(input: RegenerateProgramInput): Promise<Program> {
  const userId = (await supabase.auth.getUser()).data.user!.id

  // 1. Fetch updated maxes (user may have re-entered their maxes before regenerating)
  const maxes = await getCurrentMaxes(userId)
  const formulaConfig = await getFormulaConfig(userId)

  // 2. Generate new scaffold with (possibly updated) inputs
  const scaffold = generateProgram({
    totalWeeks: input.totalWeeks,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    startDate: input.startDate,
  })

  // 3. Generate new auxiliary assignments
  const auxiliaryPool = await getAuxiliaryPools(userId)
  const blockOffset = await computeBlockOffset(userId)  // counts all prior completed blocks
  const auxiliaryAssignments = generateAuxiliaryAssignments(
    scaffold.programId,
    input.totalWeeks,
    auxiliaryPool,
    blockOffset
  )

  // 4. Archive current active program
  await supabase
    .from('programs')
    .update({ status: 'archived' })
    .eq('user_id', userId)
    .eq('status', 'active')

  // 5. Compute version number
  const { data: maxVersionRow } = await supabase
    .from('programs')
    .select('version')
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(1)
    .single()
  const nextVersion = (maxVersionRow?.version ?? 0) + 1

  // 6. Insert new program
  const { data: program } = await supabase.from('programs').insert({
    user_id: userId,
    status: 'active',
    version: nextVersion,
    total_weeks: input.totalWeeks,
    training_days_per_week: input.trainingDaysPerWeek,
    start_date: input.startDate.toISOString().split('T')[0],
    lifter_maxes_id: maxes!.id,
    formula_config_id: formulaConfig.id,
  }).select().single()

  // 7. Bulk insert new session scaffolds (planned_sets = null)
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
    planned_sets: null,
    jit_generated_at: null,
  }))
  await supabase.from('sessions').insert(sessionRows)

  // 8. Insert auxiliary assignments for new program
  await supabase.from('auxiliary_assignments').insert(
    auxiliaryAssignments.map(a => ({ ...a, user_id: userId }))
  )

  return program
}
```

**Version counter:** Scoped per user — first program is version 1, each subsequent program increments.

**History integrity:**
- Old program sessions remain in DB with their original statuses (completed, skipped, planned)
- Old `planned_sets` data on completed sessions is preserved — never deleted
- Old program `status = 'archived'` — visible in program history list

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
