import { describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/react-native', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@parakeet/training-engine', () => ({
  getJITModel: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('../data/session.repository', () => ({
  fetchBiologicalSex: vi.fn(),
  fetchExistingMotivationalMessage: vi.fn(),
  fetchPRsForSessions: vi.fn(),
  fetchSessionLogsForMotivational: vi.fn(),
  fetchSessionSetsBySessionIds: vi.fn(),
  insertMotivationalMessageLog: vi.fn(),
}));

import type { MotivationalContext } from './motivational-message.service';
import { buildMotivationalFallback } from './motivational-message.service';

function makeCtx(
  overrides: Partial<MotivationalContext> = {}
): MotivationalContext {
  return {
    primaryLifts: ['squat'],
    intensityTypes: ['heavy'],
    weekNumber: 2,
    blockNumber: 1,
    isDeload: false,
    sessionRpe: 8,
    performanceVsPlan: 'at',
    newPRs: [],
    currentStreak: 0,
    biologicalSex: 'male',
    cyclePhase: null,
    completionPct: 100,
    topWeightKg: 100,
    totalSetsCompleted: 5,
    ...overrides,
  };
}

describe('buildMotivationalFallback', () => {
  it('prefers a PR message when newPRs is non-empty', () => {
    const msg = buildMotivationalFallback(
      makeCtx({ newPRs: [{ lift: 'squat', prType: 'estimated_1rm' }] })
    );
    expect(msg).toBe('PR on squat — nice work.');
  });

  it('uses the first PR when multiple are present', () => {
    const msg = buildMotivationalFallback(
      makeCtx({
        newPRs: [
          { lift: 'deadlift', prType: 'tonnage' },
          { lift: 'squat', prType: 'estimated_1rm' },
        ],
      })
    );
    expect(msg).toBe('PR on deadlift — nice work.');
  });

  it('falls back to a generic completion message when no PR', () => {
    const msg = buildMotivationalFallback(makeCtx());
    expect(msg).toBe('Workout done. Nice work.');
  });
});
