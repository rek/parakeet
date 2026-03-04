import {
  DEFAULT_AUXILIARY_POOLS,
  computeBlockOffset,
  generateAuxiliaryAssignments,
  getAuxiliariesForBlock,
} from './auxiliary-rotator'

describe('getAuxiliariesForBlock — default squat pool', () => {
  const pool = DEFAULT_AUXILIARY_POOLS.squat

  it('block 1 → positions 0+1', () => {
    expect(getAuxiliariesForBlock('squat', 1, pool)).toEqual(['Pause Squat', 'Box Squat'])
  })

  it('block 2 → positions 2+3', () => {
    expect(getAuxiliariesForBlock('squat', 2, pool)).toEqual(['Bulgarian Split Squat', 'Leg Press'])
  })

  it('block 3 → positions 4+5', () => {
    expect(getAuxiliariesForBlock('squat', 3, pool)).toEqual(['High-Bar Squat', 'Hack Squat'])
  })

  it('wraps on a 6-exercise pool with startOffset=6 (second program, block 1 → 0+1 again)', () => {
    const small = pool.slice(0, 6) // 6 exercises
    expect(getAuxiliariesForBlock('squat', 1, small, 6)).toEqual(['Pause Squat', 'Box Squat'])
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

  it('offset 12 with 7-exercise squat pool → block 1 picks positions 5+6', () => {
    const pool = DEFAULT_AUXILIARY_POOLS.squat // 7 exercises
    const [ex1, ex2] = getAuxiliariesForBlock('squat', 1, pool, 12)
    // pos1 = (12 + 0) % 7 = 5 → 'Hack Squat', pos2 = 13 % 7 = 6 → 'Front Squat'
    expect(ex1).toBe('Hack Squat')
    expect(ex2).toBe('Front Squat')
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
    const result = generateAuxiliaryAssignments('prog-2', 10, pool, 6)
    const sqB1 = result.find((r) => r.lift === 'squat' && r.blockNumber === 1)
    // offset=6, pool size=7: pos1=(6+0)%7=6→'Front Squat', pos2=(6+1)%7=0→'Pause Squat'
    expect(sqB1?.exercise1).toBe('Front Squat')
    expect(sqB1?.exercise2).toBe('Pause Squat')
  })

  it('skips lifts missing from pool', () => {
    const result = generateAuxiliaryAssignments('prog-x', 10, { squat: pool.squat })
    expect(result.every((r) => r.lift === 'squat')).toBe(true)
    expect(result).toHaveLength(3) // 3 blocks × 1 lift
  })
})
