import type { DisruptionType, Lift, Severity } from '@parakeet/shared-types';
import { TRAINING_LIFTS } from '@shared/constants/training';

export type SorenessLevel = 'none' | 'mild' | 'sore' | 'very_sore';

export const SORENESS_NUMERIC: Record<SorenessLevel, number> = {
  none: 1,
  mild: 3,
  sore: 6,
  very_sore: 8,
};

export function inferEffectiveSeverity(
  type: DisruptionType,
  selectedSeverity: Severity | null
): Severity | null {
  return type === 'unprogrammed_event' ? 'major' : selectedSeverity;
}

export interface MenstrualSymptomsPreset {
  type: DisruptionType;
  severity: Severity;
  allLifts: boolean;
  lifts: Set<Lift>;
  description: string;
}

export function getMenstrualSymptomsPreset(): MenstrualSymptomsPreset {
  return {
    type: 'fatigue',
    severity: 'minor',
    allLifts: true,
    lifts: new Set(TRAINING_LIFTS),
    description: 'Menstrual symptoms',
  };
}
