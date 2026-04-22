// @spec docs/features/session/spec-adhoc.md
import type { AuxiliaryActualSet } from '@platform/store/sessionStore';

import type { AuxiliaryWork } from '../model/types';

export function groupAuxiliaryWork(
  auxiliaryWork: AuxiliaryWork[],
  auxiliarySets: AuxiliaryActualSet[]
) {
  const auxByExercise = auxiliaryWork.map((aw, origIndex) => ({
    ...aw,
    origIndex,
    actualSets: auxiliarySets.filter((s) => s.exercise === aw.exercise),
  }));
  return {
    regularAux: auxByExercise.filter((aw) => !aw.isTopUp),
    topUpAux: auxByExercise.filter((aw) => aw.isTopUp),
  };
}
