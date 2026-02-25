# Spec: Auxiliary Exercise Rotation

**Status**: Implemented
**Domain**: Training Engine

## What This Covers

Manages the pool of auxiliary exercises per lift and the block-based sequential rotation that selects which 2 exercises are active each block. Results are stored in `auxiliary_assignments` in Supabase and read by the JIT generator.

## Tasks

**File: `packages/training-engine/src/auxiliary/auxiliary-rotator.ts`**

**Default exercise pools:**
```typescript
export const DEFAULT_AUXILIARY_POOLS: Record<Lift, string[]> = {
  squat: [
    'Pause Squat',
    'Box Squat',
    'Bulgarian Split Squat',
    'Leg Press',
    'High-Bar Squat',
    'Belt Squat',
    'Hack Squat',
    'Front Squat',
  ],
  bench: [
    'Close-Grip Bench',
    'Incline DB Press',
    'Dips',
    'Floor Press',
    'Overhead Press',
    'JM Press',
    'Board Press',
    'Spoto Press',
  ],
  deadlift: [
    'Romanian DL',
    'Block Pulls',
    'Deficit DL',
    'Good Mornings',
    'Stiff-Leg DL',
    'Sumo DL',
    'Rack Pulls',
    'Hyperextensions',
  ],
}
```

- [x] `getAuxiliariesForBlock(lift: Lift, blockNumber: 1 | 2 | 3, pool: string[]): [string, string]`
  - Sequential pool rotation: picks 2 exercises at positions `[(blockIndex × 2) % poolSize, (blockIndex × 2 + 1) % poolSize]`
  - `blockIndex = blockNumber - 1` (0-indexed)
  - Block 1: positions 0+1, Block 2: positions 2+3, Block 3: positions 4+5
  - Cycles back to 0 when pool is exhausted across multiple programs

```typescript
// Example with default squat pool (8 exercises):
// Block 1 → ['Pause Squat', 'Box Squat']         (positions 0, 1)
// Block 2 → ['Bulgarian Split Squat', 'Leg Press'] (positions 2, 3)
// Block 3 → ['High-Bar Squat', 'Belt Squat']       (positions 4, 5)
// Next program Block 1 → ['Hack Squat', 'Front Squat'] (positions 6, 7)
// Next program Block 2 → ['Pause Squat', 'Box Squat']  (wraps to 0, 1)
```

- [x] `computeBlockOffset(programHistory: ProgramRecord[]): number`
  - Counts total blocks completed in all prior programs for this user
  - Used to continue pool rotation across programs rather than restarting from 0
  - `offset = totalCompletedBlocks × 2`
- [x] `generateAuxiliaryAssignments(programId: string, totalWeeks: number, pool: AuxiliaryPool): AuxiliaryAssignment[]`
  - Called from program generator at program creation time
  - Returns one `AuxiliaryAssignment` per lift per block (3 lifts × 3 blocks = 9 records)
  - Each record: `{ program_id, lift, block_number, exercise_1, exercise_2 }`

**Type: `AuxiliaryPool`**
```typescript
interface AuxiliaryPool {
  squat: string[]     // user's ordered pool for squat
  bench: string[]     // user's ordered pool for bench
  deadlift: string[]  // user's ordered pool for deadlift
}
```

**User customization:**
- User can reorder, add, or remove exercises from their pool in Settings → Auxiliary Exercises
- User can manually lock/swap an individual assignment without affecting the rotation order
- Locked assignments are flagged `is_locked: true` in `auxiliary_assignments` and skipped during rotation recalculation

**Unit tests (`packages/training-engine/__tests__/auxiliary-rotator.test.ts`):**
- [x] `getAuxiliariesForBlock('squat', 1, DEFAULT_AUXILIARY_POOLS.squat)` → `['Pause Squat', 'Box Squat']`
- [x] `getAuxiliariesForBlock('squat', 2, DEFAULT_AUXILIARY_POOLS.squat)` → `['Bulgarian Split Squat', 'Leg Press']`
- [x] `getAuxiliariesForBlock('squat', 3, DEFAULT_AUXILIARY_POOLS.squat)` → `['High-Bar Squat', 'Belt Squat']`
- [x] Pool wrap: 6-exercise pool, block 4 (second program block 1) → positions 0+1 again
- [x] `computeBlockOffset`: user completed 2 programs (3 blocks each) → offset = 12 → Block 1 of new program picks positions 12+13 mod poolSize

## Dependencies

- [engine-004-program-generator.md](./engine-004-program-generator.md)
- [data-002-auxiliary-exercise-config.md](../05-data/data-002-auxiliary-exercise-config.md)
