import {
  createDirectOpenAIModel,
  FORM_COACHING_SYSTEM_PROMPT,
  generateFormCoaching,
  type FormCoachingInput,
  type FormCoachingResult,
} from '@parakeet/training-engine';

export type CoachingModelId =
  | 'gpt-5'
  | 'gpt-5-mini'
  | 'gpt-4o'
  | 'gpt-4o-mini';

export const COACHING_MODEL_IDS: CoachingModelId[] = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-4o',
  'gpt-4o-mini',
];

export class CoachingError extends Error {
  constructor(
    public readonly kind:
      | 'missing-key'
      | 'auth'
      | 'rate-limit'
      | 'invalid-json'
      | 'schedule'
      | 'unknown',
    message: string,
    public readonly raw?: string
  ) {
    super(message);
    this.name = 'CoachingError';
  }
}

export interface CoachingRequest {
  context: FormCoachingInput;
  model: CoachingModelId;
  systemPrompt: string;
}

export interface CoachingRunResult {
  result: FormCoachingResult;
  request: CoachingRequest;
  latencyMs: number;
  /** Not all providers expose token usage via `generateText` — may be null. */
  tokensIn: number | null;
  tokensOut: number | null;
}

/**
 * Runs the engine's form-coaching pipeline against a directly-configured
 * OpenAI provider. Used by the dashboard Coach panel for prompt iteration.
 *
 * The engine owns `@ai-sdk/openai`; the dashboard never imports it so a
 * v1/v3 version split does not surface here.
 */
export async function runCoaching({
  context,
  model: modelId,
  systemPromptOverride,
}: {
  context: FormCoachingInput;
  model: CoachingModelId;
  systemPromptOverride?: string;
}): Promise<CoachingRunResult> {
  const apiKey = import.meta.env.VITE_OPENAI_KEY as string | undefined;
  if (!apiKey) {
    throw new CoachingError(
      'missing-key',
      'VITE_OPENAI_KEY is not set. Add it to apps/dashboard/.env.local and restart the dev server.'
    );
  }

  const systemPrompt = systemPromptOverride ?? FORM_COACHING_SYSTEM_PROMPT;
  const request: CoachingRequest = { context, model: modelId, systemPrompt };

  const languageModel = createDirectOpenAIModel({ apiKey, modelId });
  const startedAt = performance.now();

  try {
    const result = await generateFormCoaching({
      context,
      model: languageModel,
      systemPrompt,
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    return { result, request, latencyMs, tokensIn: null, tokensOut: null };
  } catch (err) {
    throw classifyCoachingError(err);
  }
}

function classifyCoachingError(err: unknown): CoachingError {
  if (err instanceof CoachingError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const raw =
    typeof err === 'object' && err && 'text' in err
      ? String((err as { text: unknown }).text ?? '')
      : undefined;

  if (/401|unauthori[sz]ed|invalid api key/i.test(message)) {
    return new CoachingError('auth', message, raw);
  }
  if (/429|rate.?limit|quota/i.test(message)) {
    return new CoachingError('rate-limit', message, raw);
  }
  if (/invalid.*json|zod|parse|schema/i.test(message)) {
    return new CoachingError('invalid-json', message, raw);
  }
  if (/abort|timeout/i.test(message)) {
    return new CoachingError('schedule', message, raw);
  }
  return new CoachingError('unknown', message, raw);
}
