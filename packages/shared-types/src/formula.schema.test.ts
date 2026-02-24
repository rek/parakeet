import { CreateFormulaConfigSchema, FormulaOverridesSchema } from './formula.schema'

describe('FormulaOverridesSchema', () => {
  it('valid partial override (only block1.heavy.pct) passes', () => {
    const result = FormulaOverridesSchema.safeParse({
      block1: { heavy: { pct: 0.82 } },
    })
    expect(result.success).toBe(true)
  })

  it('empty overrides {} is valid', () => {
    expect(FormulaOverridesSchema.safeParse({}).success).toBe(true)
  })

  it('pct = 1.10 fails (above max 1.05)', () => {
    const result = FormulaOverridesSchema.safeParse({
      block1: { heavy: { pct: 1.10 } },
    })
    expect(result.success).toBe(false)
  })

  it('pct = 0.39 fails (below min 0.40)', () => {
    const result = FormulaOverridesSchema.safeParse({
      block2: { explosive: { pct: 0.39 } },
    })
    expect(result.success).toBe(false)
  })

  it('sets_min > sets_max fails', () => {
    const result = FormulaOverridesSchema.safeParse({
      block1: { rep: { sets_min: 4, sets_max: 2 } },
    })
    expect(result.success).toBe(false)
  })

  it('sets_min = sets_max is valid', () => {
    const result = FormulaOverridesSchema.safeParse({
      block1: { rep: { sets_min: 3, sets_max: 3 } },
    })
    expect(result.success).toBe(true)
  })

  it('rpe_target not multiple of 0.5 fails', () => {
    const result = FormulaOverridesSchema.safeParse({
      block1: { heavy: { rpe_target: 8.3 } },
    })
    expect(result.success).toBe(false)
  })

  it('rpe_target = 8.5 (multiple of 0.5) passes', () => {
    const result = FormulaOverridesSchema.safeParse({
      block1: { heavy: { rpe_target: 8.5 } },
    })
    expect(result.success).toBe(true)
  })

  it('sets > 10 fails', () => {
    const result = FormulaOverridesSchema.safeParse({
      block3: { heavy: { sets: 11 } },
    })
    expect(result.success).toBe(false)
  })

  it('deload pct 0.40 is valid', () => {
    const result = FormulaOverridesSchema.safeParse({ deload: { pct: 0.40 } })
    expect(result.success).toBe(true)
  })

  it('progressive_overload increment 0.03 is valid', () => {
    const result = FormulaOverridesSchema.safeParse({
      progressive_overload: { heavy_pct_increment_per_block: 0.03 },
    })
    expect(result.success).toBe(true)
  })

  it('progressive_overload increment 0.15 fails (above max 0.10)', () => {
    const result = FormulaOverridesSchema.safeParse({
      progressive_overload: { heavy_pct_increment_per_block: 0.15 },
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateFormulaConfigSchema', () => {
  it('valid user config passes', () => {
    const result = CreateFormulaConfigSchema.safeParse({
      overrides: { block1: { heavy: { pct: 0.80 } } },
      source: 'user',
    })
    expect(result.success).toBe(true)
  })

  it('ai_suggestion source with rationale passes', () => {
    const result = CreateFormulaConfigSchema.safeParse({
      overrides: {},
      source: 'ai_suggestion',
      ai_rationale: 'RPE consistently above target',
    })
    expect(result.success).toBe(true)
  })

  it('invalid source fails', () => {
    const result = CreateFormulaConfigSchema.safeParse({
      overrides: {},
      source: 'manual',
    })
    expect(result.success).toBe(false)
  })
})
