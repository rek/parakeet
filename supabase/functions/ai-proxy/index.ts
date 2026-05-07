import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_BASE = 'https://api.openai.com';
const MAX_REQUESTS_PER_HOUR = 100;

// Module-level singletons — avoid re-creating clients on every request
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function errorResponse({
  status,
  message,
  code,
}: {
  status: number;
  message: string;
  code?: string;
}) {
  // OpenAI-compatible error shape so the AI SDK can extract the message.
  return new Response(
    JSON.stringify({ error: { message, type: 'proxy_error', code: code ?? null } }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Authenticate the request via Supabase JWT.
 * Returns the user ID or an error response.
 */
async function authenticateRequest({ authHeader }: { authHeader: string | null }) {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: errorResponse({ status: 401, message: 'Missing or invalid authorization header' }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) {
    return { error: errorResponse({ status: 401, message: 'Invalid or expired token' }) };
  }

  return { userId: data.user.id };
}

/**
 * Simple per-user rate limiting using Supabase table.
 * Returns true if the request is allowed, false if rate limited.
 */
async function checkRateLimit({ userId }: { userId: string }) {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await adminClient
    .from('ai_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }

  await adminClient.from('ai_rate_limits').insert({ user_id: userId });

  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse({ status: 405, message: 'Method not allowed' });
  }

  // Authenticate
  const auth = await authenticateRequest({
    authHeader: req.headers.get('authorization'),
  });
  if (auth.error) return auth.error;

  // Rate limit
  const allowed = await checkRateLimit({ userId: auth.userId! });
  if (!allowed) {
    return errorResponse({
      status: 429,
      message: 'Rate limit exceeded. Maximum 100 requests per hour.',
      code: 'rate_limit_exceeded',
    });
  }

  // Extract the OpenAI sub-path from the request URL.
  // Inside Supabase's Edge runtime, the function receives the request with the
  // function name still prefixed but WITHOUT /functions/v1, e.g.
  //   /ai-proxy/responses
  //   /ai-proxy/v1/chat/completions
  // Older clients may send the full /functions/v1/ai-proxy/... form. Strip
  // whichever prefix is present, then ensure the result starts with /v1/.
  const url = new URL(req.url);
  const pathAfterProxy = url.pathname
    .replace(/^\/functions\/v1\/ai-proxy/, '')
    .replace(/^\/ai-proxy/, '');
  let openaiPath = pathAfterProxy || '/v1/chat/completions';
  if (!openaiPath.startsWith('/v1/')) {
    openaiPath = `/v1${openaiPath}`;
  }
  const openaiUrl = `${OPENAI_BASE}${openaiPath}`;

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return errorResponse({
      status: 500,
      message: 'AI proxy not configured',
    });
  }

  // Forward the request to OpenAI
  const body = await req.text();
  const openaiHeaders = new Headers();
  openaiHeaders.set('Authorization', `Bearer ${openaiKey}`);
  openaiHeaders.set('Content-Type', 'application/json');

  // Forward select headers from the original request
  const userAgent = req.headers.get('user-agent');
  if (userAgent) openaiHeaders.set('User-Agent', userAgent);

  try {
    const openaiResponse = await fetch(openaiUrl, {
      method: 'POST',
      headers: openaiHeaders,
      body,
    });

    if (!openaiResponse.ok) {
      const cloned = openaiResponse.clone();
      const respBody = await cloned.text();
      console.error(
        `[ai-proxy] OpenAI returned ${openaiResponse.status} for ${openaiUrl} :: ${respBody.slice(0, 500)}`
      );
    }

    // Stream the response back transparently
    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set(
      'Content-Type',
      openaiResponse.headers.get('Content-Type') ?? 'application/json'
    );

    return new Response(openaiResponse.body, {
      status: openaiResponse.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('[ai-proxy] OpenAI request failed:', err);
    return errorResponse({
      status: 502,
      message: 'Failed to reach AI provider',
    });
  }
});
