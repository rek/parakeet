import { scoreDecisionReplay } from '@parakeet/training-engine';
import type { JITInput } from '@parakeet/training-engine';
import { toJson, typedSupabase } from '@platform/supabase';

import {
  fetchSessionById,
  fetchSessionLogBySessionId,
} from '../data/session.repository';

export async function scoreDecisionReplayAsync(
  sessionId: string,
  userId: string
): Promise<void> {
  const session = await fetchSessionById(sessionId);
  if (!session?.jit_input_snapshot || !session?.planned_sets) return;

  const sessionLog = await fetchSessionLogBySessionId(sessionId);
  if (!sessionLog) return;

  const replay = await scoreDecisionReplay({
    jitInputSnapshot: session.jit_input_snapshot as unknown as JITInput,
    plannedSets: session.planned_sets as Array<Record<string, unknown>>,
    actualSets: sessionLog.actual_sets as Array<Record<string, unknown>>,
    auxiliarySets: sessionLog.auxiliary_sets as Array<Record<string, unknown>>,
    sessionRpe: sessionLog.session_rpe as number | null,
    lift: session.primary_lift ?? '',
    intensityType: session.intensity_type ?? '',
    blockNumber: session.block_number ?? null,
  });

  const { error } = await typedSupabase.from('decision_replay_logs').insert([
    {
      user_id: userId,
      session_id: sessionId,
      prescription_score: replay.prescriptionScore,
      rpe_accuracy: replay.rpeAccuracy,
      volume_appropriateness: replay.volumeAppropriateness,
      insights: toJson(replay.insights),
    },
  ]);

  if (error) throw error;
}
