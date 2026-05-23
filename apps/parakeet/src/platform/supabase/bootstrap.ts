import {
  configureAIProxy,
  configureEngineErrorReporter,
} from '@parakeet/training-engine';

import { captureException } from '@platform/utils/captureException';

import { typedSupabase } from './supabase-client';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

// Forward every engine-side error to Sentry. Engine packages can't import the
// app's Sentry helper directly, so they call a configurable hook.
configureEngineErrorReporter((err, ctx) => {
  captureException(err, { extra: ctx });
});

// Route all OpenAI calls through the Supabase Edge Function proxy.
// The real OpenAI key lives server-side, never in the client bundle.
if (supabaseUrl && !supabaseUrl.includes('localhost')) {
  configureAIProxy({
    proxyBaseURL: `${supabaseUrl}/functions/v1/ai-proxy`,
    authTokenProvider: async () => {
      const { data } = await typedSupabase.auth.getSession();
      return data.session?.access_token ?? '';
    },
    // Called by the engine when the proxy returns 401 — refresh the JWT so
    // long-running app sessions don't hard-fail every LLM call after the
    // access token expires.
    refreshAuthToken: async () => {
      await typedSupabase.auth.refreshSession();
    },
  });
} else if (!process.env['EXPO_PUBLIC_OPENAI_API_KEY']) {
  // Local-dev fallback: the engine talks directly to api.openai.com using
  // EXPO_PUBLIC_OPENAI_API_KEY. Without it every LLM call will 401 silently.
  // Warn once so the failure mode is visible at startup, not after the user
  // triggers an action that depends on the AI.
  // eslint-disable-next-line no-console
  console.warn(
    '[ai-proxy] direct mode active without OpenAI key; LLM calls will fail'
  );
}

export {};
