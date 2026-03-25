import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MRV_MEV_CONFIG_FEMALE,
  DEFAULT_MRV_MEV_CONFIG_MALE,
} from './mrv-mev-calculator';
import { classifyConfigSource } from './classify-config-source';

describe('classifyConfigSource', () => {
  it('returns isCustom: false for default male config', () => {
    const result = classifyConfigSource({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      muscle: 'quads',
      biologicalSex: 'male',
    });
    expect(result.isCustom).toBe(false);
    expect(result.defaultMev).toBe(8);
    expect(result.defaultMrv).toBe(20);
  });

  it('returns isCustom: false for default female config', () => {
    const result = classifyConfigSource({
      config: DEFAULT_MRV_MEV_CONFIG_FEMALE,
      muscle: 'quads',
      biologicalSex: 'female',
    });
    expect(result.isCustom).toBe(false);
    expect(result.defaultMev).toBe(10);
    expect(result.defaultMrv).toBe(26);
  });

  it('detects custom MEV', () => {
    const config = {
      ...DEFAULT_MRV_MEV_CONFIG_MALE,
      quads: { mev: 12, mrv: 20 },
    };
    const result = classifyConfigSource({ config, muscle: 'quads', biologicalSex: 'male' });
    expect(result.isCustom).toBe(true);
    expect(result.defaultMev).toBe(8);
  });

  it('detects custom MRV', () => {
    const config = {
      ...DEFAULT_MRV_MEV_CONFIG_MALE,
      chest: { mev: 8, mrv: 18 },
    };
    const result = classifyConfigSource({ config, muscle: 'chest', biologicalSex: 'male' });
    expect(result.isCustom).toBe(true);
    expect(result.defaultMrv).toBe(22);
  });

  it('falls back to male defaults when biologicalSex is null', () => {
    const result = classifyConfigSource({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      muscle: 'hamstrings',
      biologicalSex: null,
    });
    expect(result.isCustom).toBe(false);
    expect(result.defaultMev).toBe(6);
    expect(result.defaultMrv).toBe(20);
  });

  it('falls back to male defaults when biologicalSex is undefined', () => {
    const result = classifyConfigSource({
      config: DEFAULT_MRV_MEV_CONFIG_MALE,
      muscle: 'hamstrings',
      biologicalSex: undefined,
    });
    expect(result.isCustom).toBe(false);
  });
});
