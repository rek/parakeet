import { createOpenAI } from '@ai-sdk/openai';

type AIProxyConfig = {
  proxyBaseURL: string;
  authTokenProvider: () => Promise<string>;
  /**
   * Optional refresh hook. Called once when the proxy returns 401 so the
   * caller can refresh the session JWT (e.g. supabase.auth.refreshSession()).
   * After refresh the request is retried once.
   */
  refreshAuthToken?: () => Promise<void>;
};

let proxyConfig: AIProxyConfig | null = null;
let cachedProvider: ReturnType<typeof createOpenAI> | null = null;

/**
 * Configure the AI proxy so all OpenAI calls go through a server-side
 * Edge Function instead of directly to api.openai.com.
 *
 * Call this once at app startup before any AI calls are made.
 * When configured, the client never sees the real OpenAI API key.
 */
export function configureAIProxy({
  proxyBaseURL,
  authTokenProvider,
  refreshAuthToken,
}: AIProxyConfig) {
  proxyConfig = { proxyBaseURL, authTokenProvider, refreshAuthToken };
  cachedProvider = null; // Force re-creation on next use
}

function getProvider() {
  if (cachedProvider) return cachedProvider;

  if (proxyConfig) {
    const { proxyBaseURL, authTokenProvider, refreshAuthToken } = proxyConfig;
    cachedProvider = createOpenAI({
      apiKey: 'proxy-mode',
      baseURL: proxyBaseURL,
      fetch: async (url, init) => {
        const sendWithToken = async () => {
          const token = await authTokenProvider();
          const headers = new Headers(init?.headers as HeadersInit);
          // Replace the AI SDK's "Bearer proxy-mode" with the real JWT
          headers.set('Authorization', `Bearer ${token}`);
          return globalThis.fetch(url, { ...init, headers });
        };

        const first = await sendWithToken();
        // JWT expired? Refresh once and retry. If still 401 we fall through
        // to the caller with the second response.
        if (first.status === 401 && refreshAuthToken) {
          try {
            await refreshAuthToken();
          } catch {
            // Refresh itself failed — return the original 401 so the caller
            // sees the auth error rather than a confusing refresh error.
            return first;
          }
          return sendWithToken();
        }
        return first;
      },
    });
  } else {
    // Direct mode — for local dev/test when no proxy is configured
    cachedProvider = createOpenAI({
      apiKey: process.env['EXPO_PUBLIC_OPENAI_API_KEY'] ?? '',
    });
  }

  return cachedProvider;
}

/** Fast, cheap — used for JIT session generation (12s timeout, 2 attempts) */
export function getJITModel() {
  return getProvider()('gpt-4o-mini');
}

/** Deep reasoning — used for cycle review (async, no timeout) */
export function getCycleReviewModel() {
  return getProvider()('gpt-5');
}

/**
 * Direct-mode OpenAI model for admin tooling (e.g. dashboard).
 *
 * Bypasses the singleton provider so the caller's API key never touches
 * the shared client state used by the app runtime. Keeps all `@ai-sdk/openai`
 * imports inside the engine so downstream apps don't pin conflicting versions.
 */
export function createDirectOpenAIModel({
  apiKey,
  modelId,
}: {
  apiKey: string;
  modelId: string;
}) {
  const provider = createOpenAI({ apiKey });
  return provider(modelId);
}
