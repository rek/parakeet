# Spec: Auxiliary Exercise Config

**Status**: Implemented
**Domain**: Data / User Config

## What This Covers

Management of the user's auxiliary exercise pool per lift and the active block assignments. Users can reorder the pool (which affects future rotation), add custom exercises, or manually lock/swap individual block assignments. Defaults come from `DEFAULT_AUXILIARY_POOLS` in the training engine.

## Tasks

**Tables (already defined in infra-005):**
- `auxiliary_exercises` — user's ordered pool per lift
- `auxiliary_assignments` — which 2 exercises are active per lift per block

**`apps/parakeet/lib/auxiliary-config.ts`:**
- [x] `getAuxiliaryPool(userId: string, lift: Lift): Promise<string[]>` — fetch ordered pool, falling back to `DEFAULT_AUXILIARY_POOLS[lift]` if no rows
- [x] `reorderAuxiliaryPool(userId: string, lift: Lift, orderedExercises: string[]): Promise<void>` — delete existing and reinsert in new order
- [x] `getActiveAssignments(userId: string, programId: string, blockNumber: 1 | 2 | 3): Promise<Record<Lift, [string, string]>>` — fetch active assignments for a given program block
- [x] `lockAssignment(userId: string, programId: string, lift: Lift, blockNumber: 1 | 2 | 3, exercise1: string, exercise2: string): Promise<void>` — manually override a block assignment with `is_locked: true`

**Settings screen — Auxiliary Exercises (`apps/parakeet/app/(tabs)/settings.tsx`):**
- [x] Shows 3 sections: Squat, Bench, Deadlift
- [x] Each section: ordered list with drag handles for reordering
- [x] "Add exercise" text input at bottom of each section
- [x] Current block assignment shown with lock icon toggle
- [x] Tap lock to override this block's pair; tap again to revert to calculated rotation

## Dependencies

- [infra-002-supabase-setup.md](../01-infra/infra-002-supabase-setup.md)
- [engine-008-auxiliary-exercise-rotation.md](../04-engine/engine-008-auxiliary-exercise-rotation.md)
