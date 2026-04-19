import type {
  CoachingRequest,
  CoachingRunResult,
} from './coaching-runner';
import type { FormCoachingResult } from '@parakeet/training-engine';

const KEY_PREFIX = 'dashboard.coaching';
const MAX_ENTRIES_PER_FIXTURE = 10;

export interface CacheEntry {
  id: string;
  timestamp: number;
  requestHash: string;
  request: CoachingRequest;
  response: FormCoachingResult | null;
  latencyMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  error?: {
    kind: string;
    message: string;
    raw?: string;
  };
}

function historyKey(fixtureId: string): string {
  return `${KEY_PREFIX}.${fixtureId}`;
}

function readHistoryRaw(fixtureId: string): CacheEntry[] {
  const raw = localStorage.getItem(historyKey(fixtureId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CacheEntry[]) : [];
  } catch {
    return [];
  }
}

function writeHistoryRaw(fixtureId: string, entries: CacheEntry[]): void {
  localStorage.setItem(historyKey(fixtureId), JSON.stringify(entries));
}

export function getHistory(fixtureId: string): CacheEntry[] {
  return readHistoryRaw(fixtureId);
}

export function appendEntry(fixtureId: string, entry: CacheEntry): void {
  const existing = readHistoryRaw(fixtureId);
  // Newest first, capped.
  const next = [entry, ...existing].slice(0, MAX_ENTRIES_PER_FIXTURE);
  writeHistoryRaw(fixtureId, next);
}

export function findCached(
  fixtureId: string,
  requestHash: string
): CacheEntry | null {
  const entries = readHistoryRaw(fixtureId);
  // Only successful entries are treated as cache hits.
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
}: {
  run: CoachingRunResult;
  requestHash: string;
}): CacheEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    requestHash,
    request: run.request,
    response: run.result,
    latencyMs: run.latencyMs,
    tokensIn: run.tokensIn,
    tokensOut: run.tokensOut,
  };
}
