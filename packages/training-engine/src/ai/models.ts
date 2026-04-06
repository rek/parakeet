import { createOpenAI } from '@ai-sdk/openai';

type AIProxyConfig = {
  proxyBaseURL: string;
  authTokenProvider: () => Promise<string>;
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
}: AIProxyConfig) {
  proxyConfig = { proxyBaseURL, authTokenProvider };
  cachedProvider = null; // Force re-creation on next use
}

function getProvider() {
  if (cachedProvider) return cachedProvider;

  if (proxyConfig) {
    const { proxyBaseURL, authTokenProvider } = proxyConfig;
    cachedProvider = createOpenAI({
      apiKey: 'proxy-mode',
      baseURL: proxyBaseURL,
      fetch: async (url, init) => {
        const token = await authTokenProvider();
        const headers = new Headers(init?.headers as HeadersInit);
        // Replace the AI SDK's "Bearer proxy-mode" with the real JWT
        headers.set('Authorization', `Bearer ${token}`);
        return globalThis.fetch(url, { ...init, headers });
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

/** Fast, cheap — used for JIT session generation (5s timeout) */
export function getJITModel() {
  return getProvider()('gpt-4o-mini');
}

/** Deep reasoning — used for cycle review (async, no timeout) */
export function getCycleReviewModel() {
  return getProvider()('gpt-5');
}
