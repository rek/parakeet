import type { CyclePhase } from '@parakeet/training-engine'
import { palette } from '../../../theme'

export const CYCLE_PHASES: readonly CyclePhase[] = [
  'menstrual', 'follicular', 'ovulatory', 'luteal', 'late_luteal',
] as const

export const PHASE_BAR_FILL: Record<CyclePhase, string> = {
  menstrual:   '#F87171',
  follicular:  '#34D399',
  ovulatory:   '#FBBF24',
  luteal:      '#818CF8',
  late_luteal: '#6366F1',
}

export const CYCLE_PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual:   'Menstrual',
  follicular:  'Follicular',
  ovulatory:   'Ovulatory',
  luteal:      'Luteal',
  late_luteal: 'Late Luteal',
}

export const CYCLE_PHASE_BG: Record<CyclePhase, string> = {
  menstrual:   palette.red100,
  follicular:  palette.emerald100,
  ovulatory:   palette.amber100,
  luteal:      palette.indigo100,
  late_luteal: palette.indigo100,
}

export const CYCLE_PHASE_TEXT: Record<CyclePhase, string> = {
  menstrual:   palette.red800,
  follicular:  palette.emerald800,
  ovulatory:   palette.amber800,
  luteal:      palette.indigo800,
  late_luteal: palette.indigo800,
}
