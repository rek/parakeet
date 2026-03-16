import {
  DEFAULT_FORMULA_CONFIG_FEMALE,
  DEFAULT_FORMULA_CONFIG_MALE,
  getDefaultFormulaConfig,
} from './blocks';
import { calculateSets } from '../generator/set-calculator';

describe('formula config behavioral properties', () => {
  it('female config produces more sets than male in block 1 heavy', () => {
    const femaleSets = calculateSets('squat', 'heavy', 1, 100, DEFAULT_FORMULA_CONFIG_FEMALE);
    const maleSets = calculateSets('squat', 'heavy', 1, 100, DEFAULT_FORMULA_CONFIG_MALE);
    expect(femaleSets.length).toBeGreaterThan(maleSets.length);
  });

  it('block progression increases weight across blocks for the same 1RM', () => {
    const b1 = calculateSets('squat', 'heavy', 1, 140, DEFAULT_FORMULA_CONFIG_MALE);
    const b3 = calculateSets('squat', 'heavy', 3, 140, DEFAULT_FORMULA_CONFIG_MALE);
    expect(b3[0].weight_kg).toBeGreaterThan(b1[0].weight_kg);
  });

  it('female training max increase is more conservative than male for squat', () => {
    expect(DEFAULT_FORMULA_CONFIG_FEMALE.training_max_increase.squat_max).toBeLessThan(
      DEFAULT_FORMULA_CONFIG_MALE.training_max_increase.squat_max
    );
  });

  it('deload produces lighter sets than any working block', () => {
    const deload = calculateSets('squat', 'deload', 1, 140, DEFAULT_FORMULA_CONFIG_MALE);
    const b1 = calculateSets('squat', 'heavy', 1, 140, DEFAULT_FORMULA_CONFIG_MALE);
    const b2 = calculateSets('squat', 'heavy', 2, 140, DEFAULT_FORMULA_CONFIG_MALE);
    const b3 = calculateSets('squat', 'heavy', 3, 140, DEFAULT_FORMULA_CONFIG_MALE);
    const minWorkingWeight = Math.min(b1[0].weight_kg, b2[0].weight_kg, b3[0].weight_kg);
    expect(deload[0].weight_kg).toBeLessThan(minWorkingWeight);
  });

  it('rep intensity uses a range — sets_min < sets_max', () => {
    const rep = DEFAULT_FORMULA_CONFIG_MALE.block1.rep;
    expect(rep.sets_min).toBeLessThan(rep.sets_max);
  });
});

describe('getDefaultFormulaConfig', () => {
  it('"female" → female config', () => {
    expect(getDefaultFormulaConfig('female')).toBe(DEFAULT_FORMULA_CONFIG_FEMALE);
  });

  it('"male" → male config', () => {
    expect(getDefaultFormulaConfig('male')).toBe(DEFAULT_FORMULA_CONFIG_MALE);
  });

  it('undefined → male config', () => {
    expect(getDefaultFormulaConfig(undefined)).toBe(DEFAULT_FORMULA_CONFIG_MALE);
  });
});
