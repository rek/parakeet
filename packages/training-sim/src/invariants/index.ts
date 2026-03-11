import { InvariantViolation, SimulationLog } from '../types';
import { checkAuxiliaryBalance } from './auxiliary-balance';
import { checkCyclePhaseCompliance } from './cycle-phase';
import { checkDisruptionResponse } from './disruption-response';
import { checkIntensityCoherence } from './intensity-coherence';
import { checkIntraSessionAdaptation } from './intra-session-adaptation';
import { checkMuscleCoverage } from './muscle-coverage';
import { checkRpeDrift } from './rpe-drift';
import { checkSessionSanity } from './session-sanity';
import { checkVolumeSafety } from './volume-safety';

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
    ...checkIntraSessionAdaptation(log),
  ];
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
  checkIntraSessionAdaptation,
};
