import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_BASE = 'https://api.openai.com';
const MAX_REQUESTS_PER_HOUR = 100;

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
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const windowStart = new Date(
    Date.now() - 60 * 60 * 1000
  ).toISOString();

  // Count requests in the current window
  const { count } = await supabase
    .from('ai_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }

  // Log this request
  await supabase
    .from('ai_rate_limits')
    .insert({ user_id: userId });

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

  // Extract the OpenAI path from the request URL.
  // Client sends to: /functions/v1/ai-proxy/v1/chat/completions
  // We forward to: https://api.openai.com/v1/chat/completions
  const url = new URL(req.url);
  const pathAfterProxy = url.pathname.replace(
    /^\/functions\/v1\/ai-proxy/,
    ''
  );
  // If no sub-path, default to /v1/chat/completions
  const openaiPath = pathAfterProxy || '/v1/chat/completions';
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
