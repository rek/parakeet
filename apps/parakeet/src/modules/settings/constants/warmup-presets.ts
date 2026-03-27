import type { WarmupPresetName } from '@modules/settings/lib/warmup-config';

export const WARMUP_PRESETS: {
  name: WarmupPresetName;
  label: string;
  description: string;
}[] = [
  { name: 'standard', label: 'Standard', description: '4 sets — 40/60/75/90%' },
  { name: 'minimal', label: 'Minimal', description: '2 sets — 50/75%' },
  {
    name: 'extended',
    label: 'Extended',
    description: '6 sets — 30/50/65/80/90/95%',
  },
  {
    name: 'empty_bar',
    label: 'Empty Bar First',
    description: '4 sets — bar/50/70/85%',
  },
];
