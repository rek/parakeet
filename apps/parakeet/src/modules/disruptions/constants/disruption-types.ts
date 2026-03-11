import type { DisruptionType } from '@parakeet/shared-types';

import type { SorenessLevel } from '../lib/disruption-presets';

export const DISRUPTION_TYPES: {
  value: DisruptionType;
  label: string;
  icon: string;
}[] = [
  { value: 'injury', label: 'Injury', icon: '🩹' },
  { value: 'illness', label: 'Illness', icon: '🤒' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'fatigue', label: 'Fatigue', icon: '🔋' },
  { value: 'equipment_unavailable', label: 'No Equipment', icon: '🏋️' },
  { value: 'unprogrammed_event', label: 'Unplanned Event', icon: '📅' },
  { value: 'other', label: 'Other', icon: '•' },
];

export const SORENESS_CHIPS: { value: SorenessLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'mild', label: 'Mild' },
  { value: 'sore', label: 'Sore' },
  { value: 'very_sore', label: 'Very Sore' },
];
