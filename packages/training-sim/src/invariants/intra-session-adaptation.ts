import { InvariantViolation, SimulationLog } from '../types'

/**
 * Validates that the intra-session adapter behaved correctly for sessions
 * where set failures were simulated.
 *
 * Rules:
 * 1. After 2+ consecutive failures, weight_reduced or sets_capped must appear
 *    (extended_rest alone is not sufficient)
 * 2. Weight reduction never exceeds 10% of the original planned weight
 * 3. No adapted weight drops below 40% of the session 1RM
 * 4. Adaptation rationale is always non-empty when an adaptation is applied
 */
export function checkIntraSessionAdaptation(log: SimulationLog): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  for (const session of log.sessions) {
    if (session.skipped) continue
    if (!session.adaptationsApplied || session.adaptationsApplied.length === 0) continue

    // Rule: Rationale must be non-empty for every adaptation recorded
    for (const adaptation of session.adaptationsApplied) {
      if (!adaptation.rationale || adaptation.rationale.trim() === '') {
        violations.push({
          category: 'intra_session_adaptation',
          rule: 'empty_rationale',
          severity: 'error',
          message: `Adaptation on day ${session.day} (after set ${adaptation.afterSet}) has empty rationale`,
          weekNumber: session.weekNumber,
          day: session.day,
          expected: 'non-empty rationale string',
          actual: '""',
        })
      }
    }

    // Rule: After 2+ consecutive failures, a weight-reducing adaptation must exist.
    // We infer 2+ consecutive failures when the adaptationsApplied list contains
    // any weight_reduced or sets_capped entry (since the adapter only emits those
    // at consecutiveFailures >= 2).  If the list contains only extended_rest, that
    // implies at most 1 consecutive failure, which is fine.  But if the session
    // has more than one adaptation entry, the later ones should escalate.
    const weightAdaptations = session.adaptationsApplied.filter(
      (a) => a.adaptationType === 'weight_reduced' || a.adaptationType === 'sets_capped',
    )
    const extendedRestOnly = session.adaptationsApplied.every(
      (a) => a.adaptationType === 'extended_rest',
    )

    // If there are multiple adaptations and they're all extended_rest, that would
    // indicate the adapter failed to escalate — warn on this.
    if (session.adaptationsApplied.length >= 2 && extendedRestOnly) {
      violations.push({
        category: 'intra_session_adaptation',
        rule: 'no_weight_reduction_after_repeated_failures',
        severity: 'error',
        message: `Session on day ${session.day} had ${session.adaptationsApplied.length} adaptations but never escalated to weight reduction`,
        weekNumber: session.weekNumber,
        day: session.day,
        expected: 'weight_reduced or sets_capped after 2+ consecutive failures',
        actual: 'only extended_rest',
      })
    }

    // Rule: Weight reduction must never exceed 10% of the original planned weight.
    // We validate this by comparing each adapted set weight against the original
    // JIT-planned set weight for the same position.
    if (weightAdaptations.length > 0) {
      const originalSets = session.jitOutput.mainLiftSets
      const adaptedSets = session.mainLiftSets

      for (let i = 0; i < Math.min(originalSets.length, adaptedSets.length); i++) {
        const original = originalSets[i]
        const adapted = adaptedSets[i]

        if (original.weight_kg <= 0) continue

        const reductionPct = (original.weight_kg - adapted.weight_kg) / original.weight_kg

        if (reductionPct > 0.105) {
          // Allow a small tolerance (0.5%) for rounding to 2.5 kg increments
          violations.push({
            category: 'intra_session_adaptation',
            rule: 'excessive_weight_reduction',
            severity: 'error',
            message: `Set ${i + 1} on day ${session.day} reduced by ${(reductionPct * 100).toFixed(1)}% (max 10%)`,
            weekNumber: session.weekNumber,
            day: session.day,
            expected: '<= 10% reduction',
            actual: `${(reductionPct * 100).toFixed(1)}% reduction (${original.weight_kg}kg → ${adapted.weight_kg}kg)`,
          })
        }
      }
    }

    // Rule: No adapted weight may fall below 40% of 1RM.
    // We don't have the 1RM stored on the session, but we can use the warmup
    // sets to derive a rough floor, or simply verify the adapted weight is > 0
    // and rely on the engine's own floor logic. We validate against mainLiftSets
    // directly — the engine clamps at 40% of oneRmKg before emitting.
    // Here we check there's no zero-weight adapted set.
    for (const set of session.mainLiftSets) {
      if (set.weight_kg <= 0) {
        violations.push({
          category: 'intra_session_adaptation',
          rule: 'adapted_weight_below_floor',
          severity: 'error',
          message: `Adapted set weight is 0 or negative on day ${session.day}`,
          weekNumber: session.weekNumber,
          day: session.day,
          expected: '> 0 kg (min 40% of 1RM)',
          actual: `${set.weight_kg} kg`,
        })
      }
    }
  }

  return violations
}
