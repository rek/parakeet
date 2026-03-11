import { InvariantViolation, SimulationLog } from '../types'

export function checkAuxiliaryBalance(log: SimulationLog): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  const trainedSessions = log.sessions.filter((s) => !s.skipped)

  // Rule: No single aux exercise appears more than 2x in a row
  const auxSequence: string[] = []
  for (const session of trainedSessions) {
    for (const aux of session.auxiliaryWork) {
      if (!aux.skipped && !aux.isTopUp) {
        auxSequence.push(aux.exercise)
      }
    }
  }

  for (let i = 2; i < auxSequence.length; i++) {
    if (auxSequence[i] === auxSequence[i - 1] && auxSequence[i] === auxSequence[i - 2]) {
      violations.push({
        category: 'auxiliary_balance',
        rule: 'aux_repeated_3x',
        severity: 'warning',
        message: `"${auxSequence[i]}" appeared 3+ times consecutively in aux rotation`,
      })
      break // report once per exercise
    }
  }

  // Rule: Top-up exercises should only appear when below MEV
  for (const session of trainedSessions) {
    for (const aux of session.auxiliaryWork) {
      if (aux.isTopUp && !aux.topUpReason) {
        violations.push({
          category: 'auxiliary_balance',
          rule: 'topup_no_reason',
          severity: 'warning',
          message: `Top-up exercise "${aux.exercise}" added without a reason on day ${session.day}`,
          day: session.day,
          weekNumber: session.weekNumber,
        })
      }
    }
  }

  return violations
}
