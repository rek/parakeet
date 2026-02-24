# Spec: Program Read (Supabase Direct)

**Status**: Implemented
**Domain**: Program Management

## What This Covers

Reading program data from Supabase. Used by the Program tab (week grid) and Today screen. No REST API server — Supabase SDK called directly from the app.

## Tasks

**`apps/mobile/lib/programs.ts` (read helpers):**

```typescript
// Get the currently active program with its sessions
async function getActiveProgram(userId: string): Promise<Program | null> {
  const { data } = await supabase
    .from('programs')
    .select(`
      *,
      sessions(id, week_number, day_number, primary_lift, intensity_type,
               block_number, is_deload, planned_date, status, jit_generated_at)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()
  return data
}

// Get a specific program by ID (validates ownership via RLS)
async function getProgram(programId: string): Promise<Program | null> {
  const { data } = await supabase
    .from('programs')
    .select(`*, sessions(*)`)
    .eq('id', programId)
    .single()
  return data
}

// List all programs for the user (no sessions in list — summary only)
async function listPrograms(userId: string): Promise<ProgramSummary[]> {
  const { data } = await supabase
    .from('programs')
    .select('id, status, total_weeks, training_days_per_week, start_date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// Complete or archive a program
async function updateProgramStatus(
  programId: string,
  status: 'completed' | 'archived'
): Promise<void> {
  await supabase
    .from('programs')
    .update({ status })
    .eq('id', programId)
    .eq('status', 'active')  // only active programs can be transitioned
}
```

**Note on `planned_sets`:** Sessions are fetched without `planned_sets` in list views — the JSONB blob is large and not needed for the week grid. The full session (including `planned_sets` if JIT has run) is fetched only when the user opens a specific session.

## Dependencies

- [programs-002-program-generation-api.md](./programs-002-program-generation-api.md)
- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
