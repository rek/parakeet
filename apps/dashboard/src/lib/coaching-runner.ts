import { APICallError, NoObjectGeneratedError } from 'ai';

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

export type CoachingErrorKind =
  | 'missing-key'
  | 'auth'
  | 'rate-limit'
  | 'invalid-json'
  | 'timeout'
  | 'unknown';

export class CoachingError extends Error {
  constructor(
    public readonly kind: CoachingErrorKind,
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
    const { result, usage } = await generateFormCoaching({
      context,
      model: languageModel,
      systemPrompt,
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    return {
      result,
      request,
      latencyMs,
      tokensIn: usage.inputTokens ?? null,
      tokensOut: usage.outputTokens ?? null,
    };
  } catch (err) {
    throw classifyCoachingError(err);
  }
}

function classifyCoachingError(err: unknown): CoachingError {
  if (err instanceof CoachingError) return err;

  // Structured model-output failure — schema validation or empty output.
  // The raw model reply is on `.text`; surface it so prompt iteration can see
  // what the model actually said.
  if (NoObjectGeneratedError.isInstance(err)) {
    return new CoachingError('invalid-json', err.message, err.text);
  }

  // HTTP-layer failure from the OpenAI call.
  if (APICallError.isInstance(err)) {
    const body = err.responseBody;
    if (err.statusCode === 401 || err.statusCode === 403) {
      return new CoachingError('auth', err.message, body);
    }
    if (err.statusCode === 429) {
      return new CoachingError('rate-limit', err.message, body);
    }
    return new CoachingError('unknown', err.message, body);
  }

  // Fallback: string-match on the error message. Catches the engine's
  // `abortAfter(30000)` timeout (AbortError) and anything else that slips
  // past the typed checks above.
  const message = err instanceof Error ? err.message : String(err);
  if (/abort|timeout/i.test(message)) {
    return new CoachingError('timeout', message);
  }
  return new CoachingError('unknown', message);
}
