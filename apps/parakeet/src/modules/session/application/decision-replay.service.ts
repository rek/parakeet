// @spec docs/features/session/spec-logging.md
import { scoreDecisionReplay } from '@parakeet/training-engine';
import type { JITInput } from '@parakeet/training-engine';

import {
  fetchSessionById,
  fetchSessionLogBySessionId,
  insertDecisionReplayLog,
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

  await insertDecisionReplayLog({
    userId,
    sessionId,
    prescriptionScore: replay.prescriptionScore,
    rpeAccuracy: replay.rpeAccuracy,
    volumeAppropriateness: replay.volumeAppropriateness,
    insights: replay.insights,
  });
}
