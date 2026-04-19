import {
  FormCoachingResultSchema,
  z,
  type FormCoachingResult,
} from '@parakeet/shared-types';

import type {
  CoachingErrorKind,
  CoachingRequest,
  CoachingRunResult,
} from './coaching-runner';

const KEY_PREFIX = 'dashboard.coaching';
const MAX_ENTRIES_PER_FIXTURE = 10;

/**
 * Persisted shape. We intentionally drop `request.context` on write:
 * - The full context is large (several KB per entry × 10 entries × N fixtures).
 * - Consumers only render `request.model` and `request.systemPrompt`.
 * - Cache lookup is by `requestHash`, which is computed live from the
 *   current form state — it does not require the historical context to
 *   round-trip.
 */
const StoredErrorSchema = z.object({
  kind: z.string(),
  message: z.string(),
  raw: z.string().optional(),
});

const StoredRequestSchema = z.object({
  model: z.string(),
  systemPrompt: z.string(),
});

const StoredCacheEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  requestHash: z.string(),
  request: StoredRequestSchema,
  response: FormCoachingResultSchema.nullable(),
  latencyMs: z.number(),
  tokensIn: z.number().nullable(),
  tokensOut: z.number().nullable(),
  error: StoredErrorSchema.optional(),
});

export type CacheEntry = z.infer<typeof StoredCacheEntrySchema> & {
  error?: {
    kind: CoachingErrorKind;
    message: string;
    raw?: string;
  };
};

function historyKey(fixtureId: string): string {
  return `${KEY_PREFIX}.${fixtureId}`;
}

function readHistoryRaw(fixtureId: string): CacheEntry[] {
  const raw = localStorage.getItem(historyKey(fixtureId));
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  // Drop entries that fail validation (schema drift or tampering) rather
  // than crashing the response card downstream. One bad entry does not
  // poison the rest of the history.
  return parsed.flatMap((e) => {
    const result = StoredCacheEntrySchema.safeParse(e);
    return result.success ? [result.data as CacheEntry] : [];
  });
}

function writeHistoryRaw(fixtureId: string, entries: CacheEntry[]): void {
  localStorage.setItem(historyKey(fixtureId), JSON.stringify(entries));
}

export function getHistory(fixtureId: string): CacheEntry[] {
  return readHistoryRaw(fixtureId);
}

export function appendEntry(fixtureId: string, entry: CacheEntry): void {
  const existing = readHistoryRaw(fixtureId);
  const next = [entry, ...existing].slice(0, MAX_ENTRIES_PER_FIXTURE);
  writeHistoryRaw(fixtureId, next);
}

export function findCached(
  fixtureId: string,
  requestHash: string
): CacheEntry | null {
  const entries = readHistoryRaw(fixtureId);
  return entries.find((e) => e.requestHash === requestHash && !e.error) ?? null;
}

export function clearHistory(fixtureId: string): void {
  localStorage.removeItem(historyKey(fixtureId));
}

/**
 * Stable JSON stringification: keys sorted recursively so object-key order
 * does not affect the hash. Input is trusted (we build the request shape),
 * so we skip cycle detection.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k]))
      .join(',') +
    '}'
  );
}

/** SHA-1 hex of the canonical JSON of the request. */
export async function hashRequest(request: CoachingRequest): Promise<string> {
  const canonical = canonicalJson(request);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildCacheEntry({
  run,
  requestHash,
  response,
}: {
  run: CoachingRunResult;
  requestHash: string;
  response: FormCoachingResult;
}): CacheEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    requestHash,
    request: {
      model: run.request.model,
      systemPrompt: run.request.systemPrompt,
    },
    response,
    latencyMs: run.latencyMs,
    tokensIn: run.tokensIn,
    tokensOut: run.tokensOut,
  };
}
