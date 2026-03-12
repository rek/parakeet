import { DecisionReplaySchema } from '@parakeet/shared-types';
import type { DecisionReplay } from '@parakeet/shared-types';
import { generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { scoreDecisionReplay } from './decision-replay';
import type { DecisionReplayContext } from './decision-replay';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn().mockReturnValue({}) },
}));
const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<DecisionReplayContext> = {}): DecisionReplayContext {
  return {
    jitInputSnapshot: { sessionId: 's-1', primaryLift: 'squat' } as never,
    plannedSets: [{ set_number: 1, weight_grams: 120000, reps: 5 }],
    actualSets: [{ set_number: 1, weight_grams: 120000, reps_completed: 5, rpe_actual: 8.5 }],
    auxiliarySets: [],
    sessionRpe: 8.5,
    lift: 'squat',
    intensityType: 'heavy',
    blockNumber: 1,
    ...overrides,
  };
}

function makeReplay(overrides: Partial<DecisionReplay> = {}): DecisionReplay {
  return {
    prescriptionScore: 82,
    rpeAccuracy: 90,
    volumeAppropriateness: 'right',
    insights: ['Good prescription for this athlete'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// scoreDecisionReplay
// ---------------------------------------------------------------------------

describe('scoreDecisionReplay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the LLM replay result on success', async () => {
    const fakeReplay = makeReplay({ prescriptionScore: 75, volumeAppropriateness: 'too_much' });
    mockGenerateText.mockResolvedValueOnce({ output: fakeReplay });

    const result = await scoreDecisionReplay(makeContext());

    expect(result.prescriptionScore).toBe(75);
    expect(result.volumeAppropriateness).toBe('too_much');
  });

  it('throws when generateText throws', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('timeout'));

    await expect(scoreDecisionReplay(makeContext())).rejects.toThrow('timeout');
  });

  it('throws when output is undefined', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: undefined });

    await expect(scoreDecisionReplay(makeContext())).rejects.toThrow(
      'Decision replay returned no structured output'
    );
  });

  it('passes prescription and actual as JSON prompt', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: makeReplay() });

    await scoreDecisionReplay(makeContext());

    expect(mockGenerateText).toHaveBeenCalledOnce();
    const call = mockGenerateText.mock.calls[0][0];
    const parsed = JSON.parse(call.prompt);
    expect(parsed).toHaveProperty('prescription');
    expect(parsed).toHaveProperty('actual');
    expect(parsed).toHaveProperty('context');
    expect(parsed.context.lift).toBe('squat');
  });

  it('uses a 10s abort signal', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: makeReplay() });

    await scoreDecisionReplay(makeContext());

    const call = mockGenerateText.mock.calls[0][0];
    expect(call.abortSignal).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DecisionReplaySchema
// ---------------------------------------------------------------------------

describe('DecisionReplaySchema', () => {
  it('parses a valid replay', () => {
    expect(() => DecisionReplaySchema.parse(makeReplay())).not.toThrow();
  });

  it('rejects prescriptionScore outside 0-100', () => {
    expect(() => DecisionReplaySchema.parse(makeReplay({ prescriptionScore: -1 }))).toThrow();
    expect(() => DecisionReplaySchema.parse(makeReplay({ prescriptionScore: 101 }))).toThrow();
  });

  it('rejects rpeAccuracy outside 0-100', () => {
    expect(() => DecisionReplaySchema.parse(makeReplay({ rpeAccuracy: -5 }))).toThrow();
    expect(() => DecisionReplaySchema.parse(makeReplay({ rpeAccuracy: 150 }))).toThrow();
  });

  it('rejects invalid volumeAppropriateness', () => {
    expect(() =>
      DecisionReplaySchema.parse({ ...makeReplay(), volumeAppropriateness: 'perfect' })
    ).toThrow();
  });

  it('accepts all valid volumeAppropriateness values', () => {
    for (const v of ['too_much', 'right', 'too_little'] as const) {
      expect(() =>
        DecisionReplaySchema.parse(makeReplay({ volumeAppropriateness: v }))
      ).not.toThrow();
    }
  });

  it('rejects more than 5 insights', () => {
    expect(() =>
      DecisionReplaySchema.parse(makeReplay({ insights: ['a', 'b', 'c', 'd', 'e', 'f'] }))
    ).toThrow();
  });

  it('rejects insight over 200 chars', () => {
    expect(() =>
      DecisionReplaySchema.parse(makeReplay({ insights: ['x'.repeat(201)] }))
    ).toThrow();
  });
});
