# Spec: Auxiliary Exercise Config

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

Management of the user's auxiliary exercise pool per lift and the active block assignments. Users can reorder the pool (which affects future rotation), add custom exercises, or manually lock/swap individual block assignments. Defaults come from `DEFAULT_AUXILIARY_POOLS` in the training engine.

## Tasks

**Tables (already defined in infra-005):**
- `auxiliary_exercises` — user's ordered pool per lift
- `auxiliary_assignments` — which 2 exercises are active per lift per block

**`apps/mobile/lib/auxiliary-config.ts`:**

```typescript
// Get user's pool for a lift (ordered by position)
async function getAuxiliaryPool(userId: string, lift: Lift): Promise<string[]> {
  const { data } = await supabase
    .from('auxiliary_exercises')
    .select('exercise_name')
    .eq('user_id', userId)
    .eq('lift', lift)
    .order('pool_position')

  if (!data || data.length === 0) {
    return DEFAULT_AUXILIARY_POOLS[lift]
  }
  return data.map(r => r.exercise_name)
}

// Reorder the pool (user drag-to-reorder)
async function reorderAuxiliaryPool(
  userId: string,
  lift: Lift,
  orderedExercises: string[]
): Promise<void> {
  // Delete existing and reinsert in new order
  await supabase.from('auxiliary_exercises')
    .delete().eq('user_id', userId).eq('lift', lift)

  const rows = orderedExercises.map((name, i) => ({
    user_id: userId,
    lift,
    exercise_name: name,
    pool_position: i,
  }))
  await supabase.from('auxiliary_exercises').insert(rows)
}

// Get active assignments for a given program block
async function getActiveAssignments(
  userId: string,
  programId: string,
  blockNumber: 1 | 2 | 3
): Promise<Record<Lift, [string, string]>> {
  const { data } = await supabase
    .from('auxiliary_assignments')
    .select('lift, exercise_1, exercise_2')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .eq('block_number', blockNumber)

  return Object.fromEntries(
    (data ?? []).map(r => [r.lift, [r.exercise_1, r.exercise_2]])
  ) as Record<Lift, [string, string]>
}

// Manually lock/swap a single assignment
async function lockAssignment(
  userId: string,
  programId: string,
  lift: Lift,
  blockNumber: 1 | 2 | 3,
  exercise1: string,
  exercise2: string
): Promise<void> {
  await supabase.from('auxiliary_assignments').upsert({
    user_id: userId,
    program_id: programId,
    lift,
    block_number: blockNumber,
    exercise_1: exercise1,
    exercise_2: exercise2,
    is_locked: true,
  }, { onConflict: 'user_id,program_id,lift,block_number' })
}
```

**Settings screen — Auxiliary Exercises (`apps/mobile/app/(tabs)/settings.tsx`):**
- Shows 3 sections: Squat, Bench, Deadlift
- Each section: ordered list with drag handles for reordering
- "Add exercise" text input at bottom of each section
- Current block assignment shown with lock icon toggle
- Tap lock to override this block's pair; tap again to revert to calculated rotation

## Dependencies

- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [engine-008-auxiliary-exercise-rotation.md](../04-engine/engine-008-auxiliary-exercise-rotation.md)
