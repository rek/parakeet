import { Lift, TrainingDisruption } from '@parakeet/shared-types'

export interface PlannedSession {
  id: string
  primary_lift: Lift
  status: string
}

export interface DisruptionAdjustmentSuggestion {
  session_id: string
  action: 'weight_reduced' | 'reps_reduced' | 'session_skipped' | 'exercise_substituted'
  reduction_pct?: number
  reps_reduction?: number
  rationale: string
  substitution_note?: string
}

type DisruptionInput = Pick<
  TrainingDisruption,
  'disruption_type' | 'severity' | 'affected_lifts'
>

export function suggestDisruptionAdjustment(
  disruption: DisruptionInput,
  sessions: PlannedSession[],
): DisruptionAdjustmentSuggestion[] {
  const affectedSessions = sessions.filter(
    (s) =>
      !disruption.affected_lifts ||
      disruption.affected_lifts.length === 0 ||
      disruption.affected_lifts.includes(s.primary_lift),
  )

  return affectedSessions.flatMap((session) =>
    buildSuggestions(disruption, session.id),
  )
}

function buildSuggestions(
  disruption: DisruptionInput,
  sessionId: string,
): DisruptionAdjustmentSuggestion[] {
  const { disruption_type, severity } = disruption

  switch (disruption_type) {
    case 'injury':
      if (severity === 'major') {
        return [{ session_id: sessionId, action: 'session_skipped', rationale: 'Major injury — session skipped' }]
      }
      if (severity === 'moderate') {
        return [{ session_id: sessionId, action: 'weight_reduced', reduction_pct: 40, rationale: 'Moderate injury — reduce intensity 40% to protect injured area' }]
      }
      return [{ session_id: sessionId, action: 'weight_reduced', reduction_pct: 20, rationale: 'Minor injury — reduce intensity 20% to maintain movement pattern safely' }]

    case 'illness':
      if (severity === 'major') {
        return [{ session_id: sessionId, action: 'session_skipped', rationale: 'Major illness — session skipped for recovery' }]
      }
      if (severity === 'moderate') {
        return [
          { session_id: sessionId, action: 'weight_reduced', reduction_pct: 25, rationale: 'Moderate illness — reduce weight 25%' },
          { session_id: sessionId, action: 'reps_reduced', reps_reduction: 2, rationale: 'Moderate illness — reduce reps by 2 per set' },
        ]
      }
      return [{ session_id: sessionId, action: 'reps_reduced', reps_reduction: 2, rationale: 'Minor illness — reduce reps by 2 per set' }]

    case 'travel':
      return [{
        session_id: sessionId,
        action: 'weight_reduced',
        reduction_pct: 30,
        rationale: 'Travel — reduce weight 30% due to equipment limitations',
        substitution_note: 'Consider bodyweight or hotel gym substitutions',
      }]

    case 'fatigue':
      if (severity === 'major') {
        return [{ session_id: sessionId, action: 'session_skipped', rationale: 'Major fatigue — session skipped' }]
      }
      if (severity === 'moderate') {
        return [{ session_id: sessionId, action: 'weight_reduced', reduction_pct: 20, rationale: 'Moderate fatigue — reduce intensity 20%' }]
      }
      return [{ session_id: sessionId, action: 'weight_reduced', reduction_pct: 10, rationale: 'Minor fatigue — reduce intensity 10%' }]

    case 'equipment_unavailable':
      return [{
        session_id: sessionId,
        action: 'exercise_substituted',
        rationale: 'Equipment unavailable — substitute with available alternatives',
        substitution_note: 'Use bodyweight or alternative equipment',
      }]

    case 'unprogrammed_event':
    case 'other':
    default:
      return []
  }
}
