import { beforeEach, describe, expect, it } from 'vitest';

import {
  appendEntry,
  clearHistory,
  findCached,
  getHistory,
  hashRequest,
  type CacheEntry,
} from '../coaching-cache';
import type { CoachingRequest } from '../coaching-runner';

function makeRequest(overrides: Partial<CoachingRequest> = {}): CoachingRequest {
  return {
    context: {
      analysis: { fps: 4, reps: [], cameraAngle: 'side' } as never,
      lift: 'deadlift',
      sagittalConfidence: 0.8,
      weightKg: 140,
      oneRmKg: null,
      sessionRpe: 8,
      biologicalSex: null,
      blockNumber: null,
      weekNumber: null,
      intensityType: null,
      isDeload: false,
      sorenessRatings: null,
      sleepQuality: null,
      energyLevel: null,
      activeDisruptions: null,
      previousVideoCount: 0,
      averageBarDriftCm: null,
      averageDepthCm: null,
      averageForwardLeanDeg: null,
      competitionPassRate: null,
      failedCriteria: [],
    },
    model: 'gpt-5',
    systemPrompt: 'test prompt',
    ...overrides,
  };
}

function makeEntry(overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    requestHash: 'hash-' + Math.random().toString(36).slice(2),
    request: makeRequest(),
    response: {
      summary: 'ok',
      repByRepBreakdown: [],
      cues: [],
      fatigueCorrelation: null,
      comparedToBaseline: null,
      competitionReadiness: null,
      nextSessionSuggestion: 'rest',
    } as never,
    latencyMs: 1234,
    tokensIn: null,
    tokensOut: null,
    ...overrides,
  };
}

describe('coaching-cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('hashRequest', () => {
    it('is deterministic regardless of object-key order', async () => {
      const a = makeRequest({ model: 'gpt-5', systemPrompt: 'X' });
      const b = makeRequest({ systemPrompt: 'X', model: 'gpt-5' });
      const h1 = await hashRequest(a);
      const h2 = await hashRequest(b);
      expect(h1).toBe(h2);
    });

    it('differs when model changes', async () => {
      const a = makeRequest({ model: 'gpt-5' });
      const b = makeRequest({ model: 'gpt-4o' });
      expect(await hashRequest(a)).not.toBe(await hashRequest(b));
    });

    it('differs when system prompt changes', async () => {
      const a = makeRequest({ systemPrompt: 'A' });
      const b = makeRequest({ systemPrompt: 'B' });
      expect(await hashRequest(a)).not.toBe(await hashRequest(b));
    });
  });

  describe('history cap', () => {
    it('keeps at most 10 entries, newest first', () => {
      for (let i = 0; i < 12; i++) {
        appendEntry('fix-1', makeEntry({ requestHash: `h${i}` }));
      }
      const history = getHistory('fix-1');
      expect(history).toHaveLength(10);
      expect(history[0].requestHash).toBe('h11');
      expect(history[9].requestHash).toBe('h2');
    });
  });

  describe('findCached', () => {
    it('returns the entry matching the hash', () => {
      const entry = makeEntry({ requestHash: 'abc' });
      appendEntry('fix-2', entry);
      expect(findCached('fix-2', 'abc')?.id).toBe(entry.id);
    });

    it('returns null for unknown hash', () => {
      appendEntry('fix-3', makeEntry({ requestHash: 'abc' }));
      expect(findCached('fix-3', 'nope')).toBeNull();
    });

    it('does not treat error entries as cache hits', () => {
      appendEntry(
        'fix-4',
        makeEntry({
          requestHash: 'abc',
          response: null,
          error: { kind: 'auth', message: 'bad key' },
        })
      );
      expect(findCached('fix-4', 'abc')).toBeNull();
    });
  });

  describe('clearHistory', () => {
    it('empties the fixture key', () => {
      appendEntry('fix-5', makeEntry());
      clearHistory('fix-5');
      expect(getHistory('fix-5')).toEqual([]);
    });
  });
});
