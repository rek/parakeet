import { configureAIProxy } from '@parakeet/training-engine';

import { typedSupabase } from './supabase-client';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

// Route all OpenAI calls through the Supabase Edge Function proxy.
// The real OpenAI key lives server-side, never in the client bundle.
if (supabaseUrl && !supabaseUrl.includes('localhost')) {
  configureAIProxy({
    proxyBaseURL: `${supabaseUrl}/functions/v1/ai-proxy`,
    authTokenProvider: async () => {
      const { data } = await typedSupabase.auth.getSession();
      return data.session?.access_token ?? '';
    },
  });
}

export {};
