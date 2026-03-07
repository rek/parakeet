import type { CyclePhase } from '@parakeet/training-engine'
import { palette } from '../../../theme'

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
