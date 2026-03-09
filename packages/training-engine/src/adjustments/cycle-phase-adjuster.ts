import { CyclePhase } from '../formulas/cycle-phase'

export interface CyclePhaseModifier {
  intensityMultiplier: number
  /** Negative = reduce sets */
  volumeModifier: number
  rationale: string | null
}

const NEUTRAL: CyclePhaseModifier = { intensityMultiplier: 1.0, volumeModifier: 0, rationale: null }

/** Returns JIT adjustments based on menstrual cycle phase (McNulty et al., 2020).
 *  Returns neutral modifier when phase is undefined or undefined cycle tracking. */
export function getCyclePhaseModifier(phase?: CyclePhase): CyclePhaseModifier {
  if (!phase) return NEUTRAL

  switch (phase) {
    case 'menstrual':
      return { intensityMultiplier: 0.95, volumeModifier: -1, rationale: 'Menstrual phase — reduced intensity 5%, −1 set' }
    case 'follicular':
      return NEUTRAL
    case 'ovulatory':
      return NEUTRAL
    case 'luteal':
      return { intensityMultiplier: 0.975, volumeModifier: 0, rationale: 'Luteal phase — reduced intensity 2.5%' }
    case 'late_luteal':
      return { intensityMultiplier: 0.95, volumeModifier: -1, rationale: 'Late luteal phase — reduced intensity 5%, −1 set' }
    default:
      return NEUTRAL
  }
}
