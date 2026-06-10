import { JudgeReviewSchema } from '@parakeet/shared-types';
import type { JudgeReview } from '@parakeet/shared-types';
import { generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JUDGE_REVIEW_SYSTEM_PROMPT } from '../ai/prompts';
import type { JITInput, JITOutput } from '../generator/jit-session-generator';
import { groundReview, reviewJITDecision, SILENT_PASS } from './judge-reviewer';

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
  intensityModifier: 1.0,
  volumeModifier: 1.0,
  skippedMainLift: false,
} as unknown as JITOutput;

function makeInput(overrides: Partial<JITInput> = {}): JITInput {
  return {
    sessionId: 's-1',
    primaryLift: 'squat',
    sorenessRatings: { quads: 1, glutes: 1, lower_back: 1 },
    sleepQuality: 4,
    energyLevel: 3,
    activeDisruptions: [],
    ...overrides,
  } as unknown as JITInput;
}

function makeOutput(overrides: Partial<JITOutput> = {}): JITOutput {
  return {
    mainLiftSets: [],
    generatedAt: new Date(),
    intensityModifier: 1.0,
    volumeModifier: 1.0,
    skippedMainLift: false,
    ...overrides,
  } as unknown as JITOutput;
}

function makeReview(overrides: Partial<JudgeReview> = {}): JudgeReview {
  return {
    score: 85,
    verdict: 'accept',
    concerns: [],
    suggestedOverrides: null,
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

    const result = await reviewJITDecision(
      makeInput({ sorenessRatings: { quads: 7, glutes: 7, lower_back: 7 } }),
      stubOutput
    );

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
// groundReview — filters hallucinated concerns against actual numbers (gh#216)
// ---------------------------------------------------------------------------

describe('groundReview', () => {
  it('drops "reduce" concerns when no reduction was applied', () => {
    const review = makeReview({
      score: 65,
      verdict: 'flag',
      concerns: [
        'Intensity and volume reduce for mild soreness, which may not be warranted.',
      ],
    });
    const grounded = groundReview(review, makeInput(), makeOutput());
    expect(grounded.concerns).toEqual([]);
    expect(grounded.verdict).toBe('accept');
    expect(grounded.score).toBeGreaterThanOrEqual(85);
  });

  it('keeps "reduce" concerns when a reduction actually fired', () => {
    const review = makeReview({
      score: 60,
      verdict: 'flag',
      concerns: ['Intensity reduced too aggressively for moderate soreness.'],
    });
    const grounded = groundReview(
      review,
      makeInput({ sorenessRatings: { quads: 6, glutes: 6, lower_back: 6 } }),
      makeOutput({ intensityModifier: 0.95, volumeModifier: 0.66 })
    );
    expect(grounded.concerns).toHaveLength(1);
    expect(grounded.verdict).toBe('flag');
  });

  it('drops "sore muscles" concerns when worst soreness <= 4', () => {
    const review = makeReview({
      score: 65,
      verdict: 'flag',
      concerns: [
        'Auxiliary work targets sore muscles, potentially exacerbating recovery.',
      ],
    });
    const grounded = groundReview(review, makeInput(), makeOutput());
    expect(grounded.concerns).toEqual([]);
    expect(grounded.verdict).toBe('accept');
  });

  it('keeps "sore muscles" concerns when worst soreness >= 5', () => {
    const review = makeReview({
      score: 60,
      verdict: 'flag',
      concerns: ['Auxiliary work targets sore quads (rated 7).'],
    });
    const grounded = groundReview(
      review,
      makeInput({ sorenessRatings: { quads: 7, glutes: 3, lower_back: 3 } }),
      makeOutput()
    );
    expect(grounded.concerns).toHaveLength(1);
  });

  it('drops "low energy" concerns when energy >= 3', () => {
    const review = makeReview({
      score: 65,
      verdict: 'flag',
      concerns: ['Intensity is high given low energy levels (3).'],
    });
    const grounded = groundReview(
      review,
      makeInput({ energyLevel: 3 }),
      makeOutput()
    );
    expect(grounded.concerns).toEqual([]);
  });

  it('keeps "low energy" concerns when energy <= 2', () => {
    const review = makeReview({
      score: 60,
      verdict: 'flag',
      concerns: ['Intensity is high given low energy (1).'],
    });
    const grounded = groundReview(
      review,
      makeInput({ energyLevel: 1 }),
      makeOutput()
    );
    expect(grounded.concerns).toHaveLength(1);
  });

  it('keeps only the grounded concern when one of two is hallucinated', () => {
    const review = makeReview({
      score: 60,
      verdict: 'flag',
      concerns: [
        'Intensity reduced for mild soreness, which may not be warranted.',
        'Rest is too short given high recent RPE.',
      ],
    });
    const grounded = groundReview(review, makeInput(), makeOutput());
    expect(grounded.concerns).toEqual([
      'Rest is too short given high recent RPE.',
    ]);
    expect(grounded.verdict).toBe('flag');
  });

  it('passes through review unchanged when no filtering applies', () => {
    const review = makeReview({
      score: 88,
      verdict: 'accept',
      concerns: [],
    });
    const grounded = groundReview(review, makeInput(), makeOutput());
    expect(grounded).toBe(review);
  });

  it('downgrades verdict but preserves a high score when filtering empties concerns', () => {
    const review = makeReview({
      score: 92,
      verdict: 'flag',
      concerns: ['Intensity reduced for mild soreness.'],
    });
    const grounded = groundReview(review, makeInput(), makeOutput());
    expect(grounded.score).toBe(92);
    expect(grounded.verdict).toBe('accept');
  });

  it('respects skippedMainLift as a reduction signal', () => {
    const review = makeReview({
      score: 60,
      verdict: 'flag',
      concerns: ['Volume reduced too aggressively.'],
    });
    const grounded = groundReview(
      review,
      makeInput({ sorenessRatings: { quads: 9, glutes: 9, lower_back: 9 } }),
      makeOutput({ skippedMainLift: true })
    );
    expect(grounded.concerns).toHaveLength(1);
  });

  // GH#217 — aux outvolumes main
  it('drops "aux outvolumes main" concerns when no aux exceeds main sets', () => {
    const review = makeReview({
      score: 65,
      verdict: 'flag',
      concerns: ['Auxiliary work outvolumes the main lift on a penalty day.'],
    });
    const grounded = groundReview(
      review,
      makeInput(),
      makeOutput({
        mainLiftSets: [
          { set_number: 1, weight_kg: 100, reps: 5, rpe_target: 8 },
          { set_number: 2, weight_kg: 100, reps: 5, rpe_target: 8 },
        ],
        auxiliaryWork: [
          {
            exercise: 'Pause Squat',
            exerciseType: 'weighted',
            sets: [
              { set_number: 1, weight_kg: 80, reps: 10, rpe_target: 7.5 },
              { set_number: 2, weight_kg: 80, reps: 10, rpe_target: 7.5 },
            ],
            skipped: false,
          },
        ],
      } as unknown as JITOutput)
    );
    expect(grounded.concerns).toEqual([]);
  });

  it('keeps "aux outvolumes main" concerns when an aux actually has more sets', () => {
    const review = makeReview({
      score: 60,
      verdict: 'flag',
      concerns: [
        'Auxiliary exercise exceeds main lift in number of sets after penalty reduction.',
      ],
    });
    const grounded = groundReview(
      review,
      makeInput(),
      makeOutput({
        intensityModifier: 0.7,
        volumeModifier: 0.5,
        mainLiftSets: [
          { set_number: 1, weight_kg: 100, reps: 5, rpe_target: 8 },
        ],
        auxiliaryWork: [
          {
            exercise: 'Close-Grip Bench',
            exerciseType: 'weighted',
            sets: [
              { set_number: 1, weight_kg: 80, reps: 10, rpe_target: 7.5 },
              { set_number: 2, weight_kg: 80, reps: 10, rpe_target: 7.5 },
              { set_number: 3, weight_kg: 80, reps: 10, rpe_target: 7.5 },
            ],
            skipped: false,
          },
        ],
      } as unknown as JITOutput)
    );
    expect(grounded.concerns).toHaveLength(1);
  });

  it('ignores top-up aux when checking outvolume claim', () => {
    const review = makeReview({
      score: 60,
      verdict: 'flag',
      concerns: ['Auxiliary work outvolumes main lift.'],
    });
    const grounded = groundReview(
      review,
      makeInput(),
      makeOutput({
        mainLiftSets: [
          { set_number: 1, weight_kg: 100, reps: 5, rpe_target: 8 },
        ],
        // Only top-ups exceed main sets — should be ignored, concern dropped
        auxiliaryWork: [
          {
            exercise: 'Cable Fly',
            exerciseType: 'weighted',
            isTopUp: true,
            topUpReason: 'biceps below MEV',
            sets: [
              { set_number: 1, weight_kg: 30, reps: 12, rpe_target: 7.5 },
              { set_number: 2, weight_kg: 30, reps: 12, rpe_target: 7.5 },
              { set_number: 3, weight_kg: 30, reps: 12, rpe_target: 7.5 },
            ],
            skipped: false,
          },
        ],
      } as unknown as JITOutput)
    );
    expect(grounded.concerns).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Prompt content (GH#217)
// ---------------------------------------------------------------------------

describe('JUDGE_REVIEW_SYSTEM_PROMPT', () => {
  it('teaches the LLM to check aux/main proportionality on penalty days', () => {
    expect(JUDGE_REVIEW_SYSTEM_PROMPT).toMatch(/aux\/main proportionality/i);
    expect(JUDGE_REVIEW_SYSTEM_PROMPT).toMatch(/penalty cascade gap/i);
  });

  it('grounds the aux-outvolumes claim against actual numbers', () => {
    expect(JUDGE_REVIEW_SYSTEM_PROMPT).toMatch(
      /Do NOT claim "aux outvolumes the main lift"/i
    );
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
        auxOverrides: [
          { exercise: 'rdl', action: 'skip', anchorOverride: null },
        ],
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

  it('truncates concern over 200 chars instead of rejecting', () => {
    const parsed = JudgeReviewSchema.parse(
      makeReview({ concerns: ['x'.repeat(250)] })
    );
    expect(parsed.concerns[0].length).toBe(200);
    expect(parsed.concerns[0].endsWith('...')).toBe(true);
  });

  it('enforces intensityModifier bounds on suggestedOverrides', () => {
    expect(() =>
      JudgeReviewSchema.parse(
        makeReview({
          suggestedOverrides: {
            intensityModifier: 1.5,
            setModifier: null,
            auxOverrides: null,
          },
        })
      )
    ).toThrow();
    expect(() =>
      JudgeReviewSchema.parse(
        makeReview({
          suggestedOverrides: {
            intensityModifier: 0.3,
            setModifier: null,
            auxOverrides: null,
          },
        })
      )
    ).toThrow();
  });

  it('enforces setModifier bounds on suggestedOverrides', () => {
    expect(() =>
      JudgeReviewSchema.parse(
        makeReview({
          suggestedOverrides: {
            intensityModifier: null,
            setModifier: 5,
            auxOverrides: null,
          },
        })
      )
    ).toThrow();
    expect(() =>
      JudgeReviewSchema.parse(
        makeReview({
          suggestedOverrides: {
            intensityModifier: null,
            setModifier: -4,
            auxOverrides: null,
          },
        })
      )
    ).toThrow();
  });

  it('allows suggestedOverrides to be null', () => {
    expect(() =>
      JudgeReviewSchema.parse(makeReview({ suggestedOverrides: null }))
    ).not.toThrow();
  });
});
