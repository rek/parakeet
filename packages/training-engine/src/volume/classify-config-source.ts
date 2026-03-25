import type { MrvMevConfig, MuscleGroup } from '../types';
import {
  DEFAULT_MRV_MEV_CONFIG_FEMALE,
  DEFAULT_MRV_MEV_CONFIG_MALE,
} from './mrv-mev-calculator';

/**
 * Compares a muscle's MRV/MEV against sex-based research defaults.
 *
 * Returns whether the value is user-customized and what the defaults would be.
 */
export function classifyConfigSource({
  config,
  muscle,
  biologicalSex,
}: {
  config: MrvMevConfig;
  muscle: MuscleGroup;
  biologicalSex: 'male' | 'female' | null | undefined;
}) {
  const defaults =
    biologicalSex === 'female'
      ? DEFAULT_MRV_MEV_CONFIG_FEMALE
      : DEFAULT_MRV_MEV_CONFIG_MALE;

  const defaultMev = defaults[muscle].mev;
  const defaultMrv = defaults[muscle].mrv;
  const isCustom =
    config[muscle].mev !== defaultMev || config[muscle].mrv !== defaultMrv;

  return { isCustom, defaultMev, defaultMrv };
}
