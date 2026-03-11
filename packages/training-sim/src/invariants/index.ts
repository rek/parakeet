import { InvariantViolation, SimulationLog } from '../types'
import { checkVolumeSafety } from './volume-safety'
import { checkIntensityCoherence } from './intensity-coherence'
import { checkDisruptionResponse } from './disruption-response'
import { checkCyclePhaseCompliance } from './cycle-phase'
import { checkAuxiliaryBalance } from './auxiliary-balance'
import { checkSessionSanity } from './session-sanity'
import { checkRpeDrift } from './rpe-drift'
import { checkMuscleCoverage } from './muscle-coverage'

export function checkAllInvariants(log: SimulationLog): InvariantViolation[] {
  return [
    ...checkVolumeSafety(log),
    ...checkIntensityCoherence(log),
    ...checkDisruptionResponse(log),
    ...checkCyclePhaseCompliance(log),
    ...checkAuxiliaryBalance(log),
    ...checkSessionSanity(log),
    ...checkRpeDrift(log),
    ...checkMuscleCoverage(log),
  ]
}

export {
  checkVolumeSafety,
  checkIntensityCoherence,
  checkDisruptionResponse,
  checkCyclePhaseCompliance,
  checkAuxiliaryBalance,
  checkSessionSanity,
  checkRpeDrift,
  checkMuscleCoverage,
}
