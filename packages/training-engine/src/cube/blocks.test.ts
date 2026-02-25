import {
  DEFAULT_FORMULA_CONFIG_MALE,
  DEFAULT_FORMULA_CONFIG_FEMALE,
  getDefaultFormulaConfig,
} from './blocks'

describe('DEFAULT_FORMULA_CONFIG_FEMALE', () => {
  it('block1 heavy: 3 sets, rpe 8.0', () => {
    expect(DEFAULT_FORMULA_CONFIG_FEMALE.block1.heavy.sets).toBe(3)
    expect(DEFAULT_FORMULA_CONFIG_FEMALE.block1.heavy.rpe_target).toBe(8.0)
  })

  it('block2 heavy: 3 sets, rpe 8.5', () => {
    expect(DEFAULT_FORMULA_CONFIG_FEMALE.block2.heavy.sets).toBe(3)
    expect(DEFAULT_FORMULA_CONFIG_FEMALE.block2.heavy.rpe_target).toBe(8.5)
  })

  it('block3 heavy: sets unchanged (4), rpe 9.0', () => {
    expect(DEFAULT_FORMULA_CONFIG_FEMALE.block3.heavy.sets).toBe(4)
    expect(DEFAULT_FORMULA_CONFIG_FEMALE.block3.heavy.rpe_target).toBe(9.0)
  })

  it('bench_max is 2.5kg', () => {
    expect(DEFAULT_FORMULA_CONFIG_FEMALE.training_max_increase.bench_max).toBe(2.5)
  })

  it('squat_max and deadlift_max are 7.5kg', () => {
    expect(DEFAULT_FORMULA_CONFIG_FEMALE.training_max_increase.squat_max).toBe(7.5)
    expect(DEFAULT_FORMULA_CONFIG_FEMALE.training_max_increase.deadlift_max).toBe(7.5)
  })

  it('block1 rep: sets_min 3, sets_max 4', () => {
    const rep = DEFAULT_FORMULA_CONFIG_FEMALE.block1.rep
    expect(rep.sets_min).toBe(3)
    expect(rep.sets_max).toBe(4)
  })
})

describe('getDefaultFormulaConfig', () => {
  it('"female" → female config', () => {
    expect(getDefaultFormulaConfig('female')).toBe(DEFAULT_FORMULA_CONFIG_FEMALE)
  })

  it('"male" → male config', () => {
    expect(getDefaultFormulaConfig('male')).toBe(DEFAULT_FORMULA_CONFIG_MALE)
  })

  it('undefined → male config', () => {
    expect(getDefaultFormulaConfig(undefined)).toBe(DEFAULT_FORMULA_CONFIG_MALE)
  })

  it('male block1 heavy still has 2 sets', () => {
    expect(DEFAULT_FORMULA_CONFIG_MALE.block1.heavy.sets).toBe(2)
  })
})
