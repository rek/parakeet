import {
  computeBlockOffset,
  DEFAULT_AUXILIARY_POOLS,
  generateAuxiliaryAssignments,
  getAuxiliariesForBlock,
} from './auxiliary-rotator';

describe('getAuxiliariesForBlock — default squat pool', () => {
  const pool = DEFAULT_AUXILIARY_POOLS.squat;

  it('block 1 → positions 0+1', () => {
    expect(getAuxiliariesForBlock('squat', 1, pool)).toEqual([
      pool[0],
      pool[1],
    ]);
  });

  it('block 2 → positions 2+3', () => {
    expect(getAuxiliariesForBlock('squat', 2, pool)).toEqual([
      pool[2],
      pool[3],
    ]);
  });

  it('block 3 → positions 4+5', () => {
    expect(getAuxiliariesForBlock('squat', 3, pool)).toEqual([
      pool[4],
      pool[5],
    ]);
  });

  it('wraps correctly: 5-item pool with startOffset=6 (second program, block 1 → 1+2)', () => {
    const smallPool = ['A', 'B', 'C', 'D', 'E'];
    expect(getAuxiliariesForBlock('squat', 1, smallPool, 6)).toEqual([
      'B',
      'C',
    ]);
  });
});

describe('computeBlockOffset', () => {
  it('0 prior programs → offset 0', () => {
    expect(computeBlockOffset([])).toBe(0);
  });

  it('1 completed program (3 blocks) → offset 6', () => {
    expect(computeBlockOffset([{ completedBlocks: 3 }])).toBe(6);
  });

  it('2 completed programs (3 blocks each) → offset 12', () => {
    expect(
      computeBlockOffset([{ completedBlocks: 3 }, { completedBlocks: 3 }])
    ).toBe(12);
  });

  it('offset 12 with N-exercise squat pool → block 1 picks correct positions', () => {
    const pool = DEFAULT_AUXILIARY_POOLS.squat;
    const n = pool.length;
    const [ex1, ex2] = getAuxiliariesForBlock('squat', 1, pool, 12);
    expect(ex1).toBe(pool[12 % n]);
    expect(ex2).toBe(pool[13 % n]);
  });
});

describe('generateAuxiliaryAssignments', () => {
  const pool = {
    squat: DEFAULT_AUXILIARY_POOLS.squat,
    bench: DEFAULT_AUXILIARY_POOLS.bench,
    deadlift: DEFAULT_AUXILIARY_POOLS.deadlift,
  };

  it('produces 9 records for a 9-week program (3 lifts × 3 blocks)', () => {
    const result = generateAuxiliaryAssignments('prog-1', 9, pool);
    expect(result).toHaveLength(9);
  });

  it('produces 12 records for a 12-week program (3 lifts × 4 blocks)', () => {
    const result = generateAuxiliaryAssignments('prog-1', 12, pool);
    expect(result).toHaveLength(12);
    const blockNums = [...new Set(result.map((r) => r.blockNumber))].sort();
    expect(blockNums).toEqual([1, 2, 3, 4]);
  });

  it('all records carry the programId', () => {
    const result = generateAuxiliaryAssignments('prog-abc', 9, pool);
    result.forEach((r) => expect(r.programId).toBe('prog-abc'));
  });

  it('applies startOffset across programs', () => {
    const sqPool = pool.squat;
    const n = sqPool.length;
    const result = generateAuxiliaryAssignments('prog-2', 9, pool, 6);
    const sqB1 = result.find((r) => r.lift === 'squat' && r.blockNumber === 1);
    expect(sqB1?.exercise1).toBe(sqPool[6 % n]);
    expect(sqB1?.exercise2).toBe(sqPool[7 % n]);
  });

  it('skips lifts missing from pool', () => {
    const result = generateAuxiliaryAssignments('prog-x', 9, {
      squat: pool.squat,
    });
    expect(result.every((r) => r.lift === 'squat')).toBe(true);
    expect(result).toHaveLength(3); // 3 blocks × 1 lift
  });

  it('block 4 exercises use correct pool positions', () => {
    const sqPool = pool.squat;
    const n = sqPool.length;
    const result = generateAuxiliaryAssignments('prog-1', 12, pool);
    const sqB4 = result.find((r) => r.lift === 'squat' && r.blockNumber === 4);
    // blockIndex=3, pos1=(6 % n), pos2=(7 % n)
    expect(sqB4?.exercise1).toBe(sqPool[6 % n]);
    expect(sqB4?.exercise2).toBe(sqPool[7 % n]);
  });
});
