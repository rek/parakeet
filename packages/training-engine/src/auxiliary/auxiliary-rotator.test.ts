import {
  DEFAULT_AUXILIARY_POOLS,
  computeBlockOffset,
  generateAuxiliaryAssignments,
  getAuxiliariesForBlock,
} from './auxiliary-rotator'

describe('getAuxiliariesForBlock — default squat pool', () => {
  const pool = DEFAULT_AUXILIARY_POOLS.squat

  it('block 1 → positions 0+1', () => {
    expect(getAuxiliariesForBlock('squat', 1, pool)).toEqual([pool[0], pool[1]])
  })

  it('block 2 → positions 2+3', () => {
    expect(getAuxiliariesForBlock('squat', 2, pool)).toEqual([pool[2], pool[3]])
  })

  it('block 3 → positions 4+5', () => {
    expect(getAuxiliariesForBlock('squat', 3, pool)).toEqual([pool[4], pool[5]])
  })

  it('wraps on a 6-exercise pool with startOffset=6 (second program, block 1 → 0+1 again)', () => {
    const small = pool.slice(0, 6) // 6 exercises
    expect(getAuxiliariesForBlock('squat', 1, small, 6)).toEqual([small[0], small[1]])
  })
})

describe('computeBlockOffset', () => {
  it('0 prior programs → offset 0', () => {
    expect(computeBlockOffset([])).toBe(0)
  })

  it('1 completed program (3 blocks) → offset 6', () => {
    expect(computeBlockOffset([{ completedBlocks: 3 }])).toBe(6)
  })

  it('2 completed programs (3 blocks each) → offset 12', () => {
    expect(computeBlockOffset([{ completedBlocks: 3 }, { completedBlocks: 3 }])).toBe(12)
  })

  it('offset 12 with N-exercise squat pool → block 1 picks correct positions', () => {
    const pool = DEFAULT_AUXILIARY_POOLS.squat
    const n = pool.length
    const [ex1, ex2] = getAuxiliariesForBlock('squat', 1, pool, 12)
    expect(ex1).toBe(pool[12 % n])
    expect(ex2).toBe(pool[13 % n])
  })
})

describe('generateAuxiliaryAssignments', () => {
  const pool = {
    squat:    DEFAULT_AUXILIARY_POOLS.squat,
    bench:    DEFAULT_AUXILIARY_POOLS.bench,
    deadlift: DEFAULT_AUXILIARY_POOLS.deadlift,
  }

  it('produces 9 records (3 lifts × 3 blocks)', () => {
    const result = generateAuxiliaryAssignments('prog-1', 10, pool)
    expect(result).toHaveLength(9)
  })

  it('all records carry the programId', () => {
    const result = generateAuxiliaryAssignments('prog-abc', 10, pool)
    result.forEach((r) => expect(r.programId).toBe('prog-abc'))
  })

  it('applies startOffset across programs', () => {
    const sqPool = pool.squat
    const n = sqPool.length
    const result = generateAuxiliaryAssignments('prog-2', 10, pool, 6)
    const sqB1 = result.find((r) => r.lift === 'squat' && r.blockNumber === 1)
    expect(sqB1?.exercise1).toBe(sqPool[6 % n])
    expect(sqB1?.exercise2).toBe(sqPool[7 % n])
  })

  it('skips lifts missing from pool', () => {
    const result = generateAuxiliaryAssignments('prog-x', 10, { squat: pool.squat })
    expect(result.every((r) => r.lift === 'squat')).toBe(true)
    expect(result).toHaveLength(3) // 3 blocks × 1 lift
  })
})
