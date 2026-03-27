import { JudgeReviewSchema } from '@parakeet/shared-types';
import type { JudgeReview } from '@parakeet/shared-types';
import { generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JITInput, JITOutput } from '../generator/jit-session-generator';
import { reviewJITDecision, SILENT_PASS } from './judge-reviewer';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn().mockReturnValue({}) },
}));
const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const stubInput = {
  sessionId: 's-1',
  primaryLift: 'squat',
} as unknown as JITInput;
const stubOutput = {
  mainLiftSets: [],
  generatedAt: new Date(),
} as unknown as JITOutput;

function makeReview(overrides: Partial<JudgeReview> = {}): JudgeReview {
  return {
    score: 85,
    verdict: 'accept',
    concerns: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// reviewJITDecision
// ---------------------------------------------------------------------------

describe('reviewJITDecision', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the LLM review on success', async () => {
    const fakeReview = makeReview({
      score: 72,
      verdict: 'flag',
      concerns: ['High soreness ignored'],
    });
    mockGenerateText.mockResolvedValueOnce({ output: fakeReview });

    const result = await reviewJITDecision(stubInput, stubOutput);

    expect(result.score).toBe(72);
    expect(result.verdict).toBe('flag');
    expect(result.concerns).toEqual(['High soreness ignored']);
  });

  it('returns SILENT_PASS when generateText throws', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('timeout'));

    const result = await reviewJITDecision(stubInput, stubOutput);

    expect(result).toEqual(SILENT_PASS);
    expect(result.score).toBe(100);
    expect(result.verdict).toBe('accept');
    expect(result.concerns).toEqual([]);
  });

  it('returns SILENT_PASS when output is undefined', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: undefined });

    const result = await reviewJITDecision(stubInput, stubOutput);

    expect(result).toEqual(SILENT_PASS);
  });

  it('passes input and output as JSON prompt', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: makeReview() });

    await reviewJITDecision(stubInput, stubOutput);

    expect(mockGenerateText).toHaveBeenCalledOnce();
    const call = mockGenerateText.mock.calls[0][0];
    const parsed = JSON.parse(call.prompt);
    expect(parsed).toHaveProperty('input');
    expect(parsed).toHaveProperty('output');
  });

  it('uses an 8s abort signal', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: makeReview() });

    await reviewJITDecision(stubInput, stubOutput);

    const call = mockGenerateText.mock.calls[0][0];
    expect(call.abortSignal).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// JudgeReviewSchema
// ---------------------------------------------------------------------------

describe('JudgeReviewSchema', () => {
  it('parses a valid accept review', () => {
    const valid = makeReview();
    expect(() => JudgeReviewSchema.parse(valid)).not.toThrow();
  });

  it('parses a valid flag review with concerns and overrides', () => {
    const valid = makeReview({
      score: 55,
      verdict: 'flag',
      concerns: [
        'Aux conflict with sore hamstrings',
        'Rest too short for RPE 9.5',
      ],
      suggestedOverrides: {
        intensityModifier: 0.9,
        setModifier: -1,
        auxOverrides: { rdl: 'skip' },
      },
    });
    expect(() => JudgeReviewSchema.parse(valid)).not.toThrow();
  });

  it('rejects score outside 0-100', () => {
    expect(() => JudgeReviewSchema.parse(makeReview({ score: -1 }))).toThrow();
    expect(() => JudgeReviewSchema.parse(makeReview({ score: 101 }))).toThrow();
  });

  it('rejects invalid verdict', () => {
    expect(() =>
      JudgeReviewSchema.parse({ ...makeReview(), verdict: 'maybe' })
    ).toThrow();
  });

  it('rejects more than 3 concerns', () => {
    expect(() =>
      JudgeReviewSchema.parse(makeReview({ concerns: ['a', 'b', 'c', 'd'] }))
    ).toThrow();
  });

  it('rejects concern over 200 chars', () => {
    expect(() =>
      JudgeReviewSchema.parse(makeReview({ concerns: ['x'.repeat(201)] }))
    ).toThrow();
  });

  it('enforces intensityModifier bounds on suggestedOverrides', () => {
    expect(() =>
      JudgeReviewSchema.parse(
        makeReview({ suggestedOverrides: { intensityModifier: 1.5 } })
      )
    ).toThrow();
    expect(() =>
      JudgeReviewSchema.parse(
        makeReview({ suggestedOverrides: { intensityModifier: 0.3 } })
      )
    ).toThrow();
  });

  it('enforces setModifier bounds on suggestedOverrides', () => {
    expect(() =>
      JudgeReviewSchema.parse(
        makeReview({ suggestedOverrides: { setModifier: 5 } })
      )
    ).toThrow();
    expect(() =>
      JudgeReviewSchema.parse(
        makeReview({ suggestedOverrides: { setModifier: -4 } })
      )
    ).toThrow();
  });

  it('allows suggestedOverrides to be omitted', () => {
    const { suggestedOverrides: _, ...noOverrides } = makeReview();
    expect(() => JudgeReviewSchema.parse(noOverrides)).not.toThrow();
  });
});
