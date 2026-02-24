import { generateWarmupSets, getPresetSteps, resolveProtocol } from './warmup-calculator'

describe('getPresetSteps', () => {
  it('standard has 4 steps', () => {
    expect(getPresetSteps('standard')).toHaveLength(4)
  })

  it('minimal has 2 steps', () => {
    expect(getPresetSteps('minimal')).toHaveLength(2)
  })

  it('extended has 6 steps', () => {
    expect(getPresetSteps('extended')).toHaveLength(6)
  })

  it('empty_bar has 4 steps, first at pct=0', () => {
    const steps = getPresetSteps('empty_bar')
    expect(steps).toHaveLength(4)
    expect(steps[0].pct).toBe(0)
  })
})

describe('resolveProtocol', () => {
  it('resolves preset', () => {
    expect(resolveProtocol({ type: 'preset', name: 'minimal' })).toHaveLength(2)
  })

  it('resolves custom steps as-is', () => {
    const steps = [{ pct: 0.5, reps: 5 }, { pct: 0.8, reps: 2 }]
    expect(resolveProtocol({ type: 'custom', steps })).toEqual(steps)
  })
})

describe('generateWarmupSets — standard protocol', () => {
  it('112.5kg → [45×5, 67.5×3, 85×2, 102.5×1]', () => {
    const sets = generateWarmupSets(112.5, { type: 'preset', name: 'standard' })
    expect(sets).toHaveLength(4)
    expect(sets.map((s) => s.weightKg)).toEqual([45, 67.5, 85, 102.5])
    expect(sets.map((s) => s.reps)).toEqual([5, 3, 2, 1])
  })

  it('setNumbers are sequential starting at 1', () => {
    const sets = generateWarmupSets(112.5, { type: 'preset', name: 'standard' })
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2, 3, 4])
  })

  it('all sets have isWarmup: true', () => {
    const sets = generateWarmupSets(112.5, { type: 'preset', name: 'standard' })
    sets.forEach((s) => expect(s.isWarmup).toBe(true))
  })

  it('60kg → [25×5, 35×3, 45×2, 55×1]', () => {
    const sets = generateWarmupSets(60, { type: 'preset', name: 'standard' })
    expect(sets.map((s) => s.weightKg)).toEqual([25, 35, 45, 55])
  })

  it('30kg: deduplicates repeated 20kg steps', () => {
    // 40%×30=12→20, 60%×30=18→20 (dup, skip), 75%×30=22.5, 90%×30=27→27.5
    const sets = generateWarmupSets(30, { type: 'preset', name: 'standard' })
    expect(sets.map((s) => s.weightKg)).toEqual([20, 22.5, 27.5])
  })
})

describe('generateWarmupSets — minimal protocol', () => {
  it('80kg → [40×5, 60×2]', () => {
    const sets = generateWarmupSets(80, { type: 'preset', name: 'minimal' })
    expect(sets.map((s) => s.weightKg)).toEqual([40, 60])
    expect(sets.map((s) => s.reps)).toEqual([5, 2])
  })
})

describe('generateWarmupSets — empty_bar protocol', () => {
  it('100kg → [20×10 (bar), 50×5, 70×3, 85×1]', () => {
    const sets = generateWarmupSets(100, { type: 'preset', name: 'empty_bar' })
    expect(sets.map((s) => s.weightKg)).toEqual([20, 50, 70, 85])
    expect(sets.map((s) => s.reps)).toEqual([10, 5, 3, 1])
  })

  it('first set always shows bar display weight', () => {
    const sets = generateWarmupSets(100, { type: 'preset', name: 'empty_bar' })
    expect(sets[0].displayWeight).toBe('20 kg (bar)')
  })
})

describe('generateWarmupSets — custom protocol', () => {
  it('custom [{pct:0.5,reps:8},{pct:0.75,reps:3}], 100kg → [50×8, 75×3]', () => {
    const sets = generateWarmupSets(100, {
      type: 'custom',
      steps: [{ pct: 0.5, reps: 8 }, { pct: 0.75, reps: 3 }],
    })
    expect(sets.map((s) => s.weightKg)).toEqual([50, 75])
    expect(sets.map((s) => s.reps)).toEqual([8, 3])
  })
})

describe('displayWeight formatting', () => {
  it('20kg shows "(bar)"', () => {
    const sets = generateWarmupSets(30, { type: 'preset', name: 'standard' })
    expect(sets[0].displayWeight).toBe('20 kg (bar)')
  })

  it('weights above 20kg show plain kg', () => {
    const sets = generateWarmupSets(100, { type: 'preset', name: 'standard' })
    sets.forEach((s) => {
      expect(s.displayWeight).toBe(`${s.weightKg} kg`)
    })
  })
})
