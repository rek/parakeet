import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateModifierCalibrations } from './calibration-update.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCaptureException = vi.hoisted(() => vi.fn());
const mockExtractModifierSamples = vi.hoisted(() => vi.fn());
const mockComputeCalibrationBias = vi.hoisted(() => vi.fn());
const mockCanAutoApply = vi.hoisted(() => vi.fn());
const mockShouldTriggerReview = vi.hoisted(() => vi.fn());
const mockReviewCalibrationAdjustment = vi.hoisted(() => vi.fn());
const mockUpsertModifierCalibration = vi.hoisted(() => vi.fn());
const mockFetchRawModifierCalibrations = vi.hoisted(() => vi.fn());
const mockFetchSessionById = vi.hoisted(() => vi.fn());
const mockFetchSessionLogBySessionId = vi.hoisted(() => vi.fn());
const mockAsyncStorageSetItem = vi.hoisted(() => vi.fn());

vi.mock('@platform/utils/captureException', () => ({
  captureException: mockCaptureException,
}));

vi.mock('@parakeet/training-engine', () => ({
  extractModifierSamples: mockExtractModifierSamples,
  computeCalibrationBias: mockComputeCalibrationBias,
  canAutoApply: mockCanAutoApply,
  shouldTriggerReview: mockShouldTriggerReview,
  reviewCalibrationAdjustment: mockReviewCalibrationAdjustment,
}));

vi.mock('../data/calibration.repository', () => ({
  upsertModifierCalibration: mockUpsertModifierCalibration,
  fetchRawModifierCalibrations: mockFetchRawModifierCalibrations,
}));

vi.mock('../../session/data/session.repository', () => ({
  fetchSessionById: mockFetchSessionById,
  fetchSessionLogBySessionId: mockFetchSessionLogBySessionId,
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: mockAsyncStorageSetItem,
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Trace with one readiness modifier and a first set with rpeTarget=8. */
function makeTrace(
  modifiers: Array<{ source: string; value: number }> = [
    { source: 'readiness', value: -0.05 },
  ]
) {
  return {
    mainLift: {
      sets: [{ rpeTarget: 8 }],
      weightDerivation: {
        modifiers: modifiers.map((m) => ({ source: m.source, value: m.value })),
      },
    },
  };
}

function makeCalibration(
  overrides: Partial<{
    suggestedAdjustment: number;
    confidence: string;
  }> = {}
) {
  return {
    suggestedAdjustment: 0.02,
    confidence: 'medium',
    ...overrides,
  };
}

const USER_ID = 'user-abc';
const SESSION_ID = 'session-xyz';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('updateModifierCalibrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertModifierCalibration.mockResolvedValue(undefined);
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
    // Default to empty existing calibrations; individual tests override.
    mockFetchRawModifierCalibrations.mockResolvedValue([]);
  });

  it('returns early without upserting when session has no jit_output_trace', async () => {
    mockFetchSessionById.mockResolvedValue({ jit_output_trace: null });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(mockUpsertModifierCalibration).not.toHaveBeenCalled();
  });

  it('returns early when session query returns no data', async () => {
    mockFetchSessionById.mockResolvedValue(null);
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(mockUpsertModifierCalibration).not.toHaveBeenCalled();
  });

  it('returns early when session_log has no session_rpe', async () => {
    mockFetchSessionById.mockResolvedValue({
      jit_output_trace: makeTrace(),
    });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: null });

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(mockUpsertModifierCalibration).not.toHaveBeenCalled();
  });

  it('returns early when trace has no modifiers', async () => {
    const traceNoModifiers = {
      mainLift: {
        sets: [{ rpeTarget: 8 }],
        weightDerivation: { modifiers: [] },
      },
    };
    mockFetchSessionById.mockResolvedValue({
      jit_output_trace: traceNoModifiers,
    });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 8.5 });

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(mockUpsertModifierCalibration).not.toHaveBeenCalled();
  });

  it('returns early when extractModifierSamples returns empty array', async () => {
    mockFetchSessionById.mockResolvedValue({
      jit_output_trace: makeTrace(),
    });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });
    mockExtractModifierSamples.mockReturnValue([]);

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(mockUpsertModifierCalibration).not.toHaveBeenCalled();
  });

  it('auto-applies calibration when canAutoApply returns true', async () => {
    mockFetchSessionById.mockResolvedValue({
      jit_output_trace: makeTrace(),
    });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });

    const sample = {
      modifierSource: 'readiness',
      multiplier: 0.95,
      rpeTarget: 8,
      rpeActual: 9,
    };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(
      makeCalibration({ suggestedAdjustment: 0.03 })
    );
    mockCanAutoApply.mockReturnValue(true);

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(mockUpsertModifierCalibration).toHaveBeenCalledOnce();
    expect(mockUpsertModifierCalibration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        modifierSource: 'readiness',
        adjustment: 0.03,
      })
    );
    expect(mockReviewCalibrationAdjustment).not.toHaveBeenCalled();
  });

  it('triggers LLM review when canAutoApply is false and shouldTriggerReview is true', async () => {
    mockFetchSessionById.mockResolvedValue({
      jit_output_trace: makeTrace(),
    });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });

    const sample = {
      modifierSource: 'readiness',
      multiplier: 0.95,
      rpeTarget: 8,
      rpeActual: 9,
    };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(
      makeCalibration({ suggestedAdjustment: 0.15 })
    );
    mockCanAutoApply.mockReturnValue(false);
    mockShouldTriggerReview.mockReturnValue(true);
    mockReviewCalibrationAdjustment.mockResolvedValue({
      apply: true,
      askUser: false,
      reason: 'consistent bias',
    });

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(mockReviewCalibrationAdjustment).toHaveBeenCalledOnce();
    expect(mockUpsertModifierCalibration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        modifierSource: 'readiness',
        adjustment: 0.15, // review.apply=true → use suggestedAdjustment
      })
    );
  });

  it('stores suggested adjustment when review.apply is true', async () => {
    mockFetchSessionById.mockResolvedValue({
      jit_output_trace: makeTrace(),
    });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });
    mockFetchRawModifierCalibrations.mockResolvedValue([
      {
        modifier_source: 'readiness',
        sample_count: 5,
        mean_bias: 0.5,
        adjustment: 0.01,
      },
    ]);

    const sample = {
      modifierSource: 'readiness',
      multiplier: 0.95,
      rpeTarget: 8,
      rpeActual: 9,
    };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(
      makeCalibration({ suggestedAdjustment: 0.08 })
    );
    mockCanAutoApply.mockReturnValue(false);
    mockShouldTriggerReview.mockReturnValue(true);
    mockReviewCalibrationAdjustment.mockResolvedValue({
      apply: true,
      askUser: false,
      reason: '',
    });

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(mockUpsertModifierCalibration).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: 0.08 })
    );
  });

  it('retains existing adjustment when review.apply is false', async () => {
    mockFetchSessionById.mockResolvedValue({
      jit_output_trace: makeTrace(),
    });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });
    mockFetchRawModifierCalibrations.mockResolvedValue([
      {
        modifier_source: 'readiness',
        sample_count: 3,
        mean_bias: 0.2,
        adjustment: 0.01,
      },
    ]);

    const sample = {
      modifierSource: 'readiness',
      multiplier: 0.95,
      rpeTarget: 8,
      rpeActual: 9,
    };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(
      makeCalibration({ suggestedAdjustment: 0.12 })
    );
    mockCanAutoApply.mockReturnValue(false);
    mockShouldTriggerReview.mockReturnValue(true);
    mockReviewCalibrationAdjustment.mockResolvedValue({
      apply: false,
      askUser: false,
      reason: '',
    });

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    // review.apply=false → keep currentAdjustment (0.01)
    expect(mockUpsertModifierCalibration).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: 0.01 })
    );
  });

  it('queues AsyncStorage prompt when review.askUser is true', async () => {
    mockFetchSessionById.mockResolvedValue({
      jit_output_trace: makeTrace(),
    });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });

    const sample = {
      modifierSource: 'readiness',
      multiplier: 0.95,
      rpeTarget: 8,
      rpeActual: 9,
    };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(
      makeCalibration({ suggestedAdjustment: 0.12 })
    );
    mockCanAutoApply.mockReturnValue(false);
    mockShouldTriggerReview.mockReturnValue(true);
    mockReviewCalibrationAdjustment.mockResolvedValue({
      apply: true,
      askUser: true,
      reason: 'large bias detected',
    });

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
      'pending_calibration_prompt',
      expect.stringContaining('readiness')
    );
  });

  it('stores stats-only when neither canAutoApply nor shouldTriggerReview', async () => {
    mockFetchSessionById.mockResolvedValue({
      jit_output_trace: makeTrace(),
    });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 8 });
    mockFetchRawModifierCalibrations.mockResolvedValue([
      {
        modifier_source: 'readiness',
        sample_count: 1,
        mean_bias: 0.1,
        adjustment: 0.005,
      },
    ]);

    const sample = {
      modifierSource: 'readiness',
      multiplier: 0.95,
      rpeTarget: 8,
      rpeActual: 8,
    };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(
      makeCalibration({ suggestedAdjustment: 0.001 })
    );
    mockCanAutoApply.mockReturnValue(false);
    mockShouldTriggerReview.mockReturnValue(false);

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    // Retains current adjustment (0.005), still upserts to save updated stats
    expect(mockUpsertModifierCalibration).toHaveBeenCalledOnce();
    expect(mockUpsertModifierCalibration).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: 0.005 })
    );
    expect(mockReviewCalibrationAdjustment).not.toHaveBeenCalled();
  });

  it('uses running mean when prior calibration exists', async () => {
    mockFetchSessionById.mockResolvedValue({
      jit_output_trace: makeTrace(),
    });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 10 });
    // Existing: 4 samples, mean_bias = 1.0
    mockFetchRawModifierCalibrations.mockResolvedValue([
      {
        modifier_source: 'readiness',
        sample_count: 4,
        mean_bias: 1.0,
        adjustment: 0.02,
      },
    ]);

    const sample = {
      modifierSource: 'readiness',
      multiplier: 0.95,
      rpeTarget: 8,
      rpeActual: 10,
    };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration());
    mockCanAutoApply.mockReturnValue(true);

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    // New bias = rpeActual - rpeTarget = 10 - 8 = 2.0 (1 new sample)
    // Combined: (1.0 * 4 + 2.0 * 1) / 5 = 1.2
    // sampleCount passed to upsert should be 5
    expect(mockUpsertModifierCalibration).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleCount: 5,
        meanBias: expect.closeTo(1.2, 5),
      })
    );
  });

  it('only processes calibrated sources (readiness, cycle_phase, soreness)', async () => {
    // Trace has modifiers from both calibrated and non-calibrated sources
    const trace = makeTrace([
      { source: 'readiness', value: -0.05 },
      { source: 'bodyweight', value: 0.02 }, // not in CALIBRATED_SOURCES
    ]);
    mockFetchSessionById.mockResolvedValue({ jit_output_trace: trace });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });

    const sample = {
      modifierSource: 'readiness',
      multiplier: 0.95,
      rpeTarget: 8,
      rpeActual: 9,
    };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration());
    mockCanAutoApply.mockReturnValue(true);

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    // extractModifierSamples must only receive the readiness modifier (not bodyweight)
    const [{ modifiers }] = mockExtractModifierSamples.mock.calls[0] as [
      { modifiers: Array<{ source: string }> },
    ];
    expect(
      modifiers.every((m) =>
        ['readiness', 'cycle_phase', 'soreness'].includes(m.source)
      )
    ).toBe(true);
  });

  it('catches errors and calls captureException', async () => {
    mockFetchSessionById.mockRejectedValue(new Error('network failure'));
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('uses rpeTarget from first set, defaulting to 8 when no sets exist', async () => {
    const traceNoSets = {
      mainLift: {
        sets: [],
        weightDerivation: {
          modifiers: [{ source: 'readiness', value: -0.05 }],
        },
      },
    };
    mockFetchSessionById.mockResolvedValue({ jit_output_trace: traceNoSets });
    mockFetchSessionLogBySessionId.mockResolvedValue({ session_rpe: 9 });

    const sample = {
      modifierSource: 'readiness',
      multiplier: 0.95,
      rpeTarget: 8,
      rpeActual: 9,
    };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration());
    mockCanAutoApply.mockReturnValue(true);

    await updateModifierCalibrations({
      sessionId: SESSION_ID,
      userId: USER_ID,
    });

    // rpeTarget defaults to 8 when sets array is empty
    expect(mockExtractModifierSamples).toHaveBeenCalledWith(
      expect.objectContaining({ rpeTarget: 8 })
    );
  });
});
