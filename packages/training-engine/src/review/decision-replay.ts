import { DecisionReplaySchema } from '@parakeet/shared-types';
import type { DecisionReplay } from '@parakeet/shared-types';
import { generateText, Output } from 'ai';

import { JIT_MODEL } from '../ai/models';
import { DECISION_REPLAY_SYSTEM_PROMPT } from '../ai/prompts';
import type { JITInput } from '../generator/jit-session-generator';

export type { DecisionReplay };

export interface DecisionReplayContext {
  /** Full JITInput snapshot stored on the session row */
  jitInputSnapshot: JITInput;
  plannedSets: Array<Record<string, unknown>>;
  actualSets: Array<Record<string, unknown>>;
  auxiliarySets: Array<Record<string, unknown>>;
  sessionRpe: number | null;
  lift: string;
  intensityType: string;
  blockNumber: number | null;
}

export async function scoreDecisionReplay(
  context: DecisionReplayContext
): Promise<DecisionReplay> {
  const { output: replay } = await generateText({
    model: JIT_MODEL,
    output: Output.object({ schema: DecisionReplaySchema }),
    system: DECISION_REPLAY_SYSTEM_PROMPT,
    prompt: JSON.stringify({
      prescription: {
        jitInputSnapshot: context.jitInputSnapshot,
        plannedSets: context.plannedSets,
      },
      actual: {
        actualSets: context.actualSets,
        auxiliarySets: context.auxiliarySets,
        sessionRpe: context.sessionRpe,
      },
      context: {
        lift: context.lift,
        intensityType: context.intensityType,
        blockNumber: context.blockNumber,
      },
    }),
    abortSignal: AbortSignal.timeout(10000),
  });
  if (!replay) throw new Error('Decision replay returned no structured output');
  return replay;
}
