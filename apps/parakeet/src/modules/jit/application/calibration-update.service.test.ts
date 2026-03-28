import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateModifierCalibrations } from './calibration-update.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

const fromMock = vi.hoisted(() => vi.fn());
const mockCaptureException = vi.hoisted(() => vi.fn());
const mockExtractModifierSamples = vi.hoisted(() => vi.fn());
const mockComputeCalibrationBias = vi.hoisted(() => vi.fn());
const mockCanAutoApply = vi.hoisted(() => vi.fn());
const mockShouldTriggerReview = vi.hoisted(() => vi.fn());
const mockReviewCalibrationAdjustment = vi.hoisted(() => vi.fn());
const mockUpsertModifierCalibration = vi.hoisted(() => vi.fn());
const mockAsyncStorageSetItem = vi.hoisted(() => vi.fn());

vi.mock('@platform/supabase', () => ({
  typedSupabase: {
    from: fromMock,
  },
}));

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
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: mockAsyncStorageSetItem,
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal Supabase chainable query that resolves to `resolvedValue` on terminal call. */
function createQueryChain(terminalMethod: string, resolvedValue: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const key of ['select', 'eq']) {
    chain[key].mockReturnValue(chain);
  }
  chain[terminalMethod].mockResolvedValue(resolvedValue);
  return chain;
}

/** Trace with one readiness modifier and a first set with rpeTarget=8. */
function makeTrace(modifiers: Array<{ source: string; value: number }> = [{ source: 'readiness', value: -0.05 }]) {
  return {
    mainLift: {
      sets: [{ rpeTarget: 8 }],
      weightDerivation: {
        modifiers: modifiers.map((m) => ({ source: m.source, value: m.value })),
      },
    },
  };
}

function makeCalibration(overrides: Partial<{
  suggestedAdjustment: number;
  confidence: string;
}> = {}) {
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
  });

  it('returns early without upserting when session has no jit_output_trace', async () => {
    const sessionChain = createQueryChain('maybeSingle', { data: { jit_output_trace: null }, error: null });
    fromMock.mockReturnValueOnce(sessionChain);

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    expect(mockUpsertModifierCalibration).not.toHaveBeenCalled();
  });

  it('returns early when session query returns no data', async () => {
    const sessionChain = createQueryChain('maybeSingle', { data: null, error: null });
    fromMock.mockReturnValueOnce(sessionChain);

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    expect(mockUpsertModifierCalibration).not.toHaveBeenCalled();
  });

  it('returns early when session_log has no session_rpe', async () => {
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: makeTrace() },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: null }, error: null });
    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain);

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    expect(mockUpsertModifierCalibration).not.toHaveBeenCalled();
  });

  it('returns early when trace has no modifiers', async () => {
    const traceNoModifiers = {
      mainLift: {
        sets: [{ rpeTarget: 8 }],
        weightDerivation: { modifiers: [] },
      },
    };
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: traceNoModifiers },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 8.5 }, error: null });
    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain);

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    expect(mockUpsertModifierCalibration).not.toHaveBeenCalled();
  });

  it('returns early when extractModifierSamples returns empty array', async () => {
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: makeTrace() },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 9 }, error: null });
    const calibrationsChain = { select: vi.fn(), eq: vi.fn() };
    calibrationsChain.select.mockReturnValue(calibrationsChain);
    calibrationsChain.eq.mockResolvedValue({ data: [], error: null });

    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain);
    mockExtractModifierSamples.mockReturnValue([]);

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    expect(mockUpsertModifierCalibration).not.toHaveBeenCalled();
  });

  it('auto-applies calibration when canAutoApply returns true', async () => {
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: makeTrace() },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 9 }, error: null });
    const calibrationsChain = { select: vi.fn(), eq: vi.fn() };
    calibrationsChain.select.mockReturnValue(calibrationsChain);
    calibrationsChain.eq.mockResolvedValue({ data: [], error: null });

    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(calibrationsChain);

    const sample = { modifierSource: 'readiness', multiplier: 0.95, rpeTarget: 8, rpeActual: 9 };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration({ suggestedAdjustment: 0.03 }));
    mockCanAutoApply.mockReturnValue(true);

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

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
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: makeTrace() },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 9 }, error: null });
    const calibrationsChain = { select: vi.fn(), eq: vi.fn() };
    calibrationsChain.select.mockReturnValue(calibrationsChain);
    calibrationsChain.eq.mockResolvedValue({ data: [], error: null });

    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(calibrationsChain);

    const sample = { modifierSource: 'readiness', multiplier: 0.95, rpeTarget: 8, rpeActual: 9 };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration({ suggestedAdjustment: 0.15 }));
    mockCanAutoApply.mockReturnValue(false);
    mockShouldTriggerReview.mockReturnValue(true);
    mockReviewCalibrationAdjustment.mockResolvedValue({
      apply: true,
      askUser: false,
      reason: 'consistent bias',
    });

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

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
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: makeTrace() },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 9 }, error: null });
    const calibrationsChain = { select: vi.fn(), eq: vi.fn() };
    calibrationsChain.select.mockReturnValue(calibrationsChain);
    calibrationsChain.eq.mockResolvedValue({
      data: [{ modifier_source: 'readiness', sample_count: 5, mean_bias: 0.5, adjustment: 0.01 }],
      error: null,
    });

    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(calibrationsChain);

    const sample = { modifierSource: 'readiness', multiplier: 0.95, rpeTarget: 8, rpeActual: 9 };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration({ suggestedAdjustment: 0.08 }));
    mockCanAutoApply.mockReturnValue(false);
    mockShouldTriggerReview.mockReturnValue(true);
    mockReviewCalibrationAdjustment.mockResolvedValue({ apply: true, askUser: false, reason: '' });

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    expect(mockUpsertModifierCalibration).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: 0.08 })
    );
  });

  it('retains existing adjustment when review.apply is false', async () => {
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: makeTrace() },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 9 }, error: null });
    const calibrationsChain = { select: vi.fn(), eq: vi.fn() };
    calibrationsChain.select.mockReturnValue(calibrationsChain);
    calibrationsChain.eq.mockResolvedValue({
      data: [{ modifier_source: 'readiness', sample_count: 3, mean_bias: 0.2, adjustment: 0.01 }],
      error: null,
    });

    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(calibrationsChain);

    const sample = { modifierSource: 'readiness', multiplier: 0.95, rpeTarget: 8, rpeActual: 9 };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration({ suggestedAdjustment: 0.12 }));
    mockCanAutoApply.mockReturnValue(false);
    mockShouldTriggerReview.mockReturnValue(true);
    mockReviewCalibrationAdjustment.mockResolvedValue({ apply: false, askUser: false, reason: '' });

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    // review.apply=false → keep currentAdjustment (0.01)
    expect(mockUpsertModifierCalibration).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: 0.01 })
    );
  });

  it('queues AsyncStorage prompt when review.askUser is true', async () => {
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: makeTrace() },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 9 }, error: null });
    const calibrationsChain = { select: vi.fn(), eq: vi.fn() };
    calibrationsChain.select.mockReturnValue(calibrationsChain);
    calibrationsChain.eq.mockResolvedValue({ data: [], error: null });

    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(calibrationsChain);

    const sample = { modifierSource: 'readiness', multiplier: 0.95, rpeTarget: 8, rpeActual: 9 };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration({ suggestedAdjustment: 0.12 }));
    mockCanAutoApply.mockReturnValue(false);
    mockShouldTriggerReview.mockReturnValue(true);
    mockReviewCalibrationAdjustment.mockResolvedValue({
      apply: true,
      askUser: true,
      reason: 'large bias detected',
    });

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    expect(mockAsyncStorageSetItem).toHaveBeenCalledWith(
      'pending_calibration_prompt',
      expect.stringContaining('readiness')
    );
  });

  it('stores stats-only when neither canAutoApply nor shouldTriggerReview', async () => {
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: makeTrace() },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 8 }, error: null });
    const calibrationsChain = { select: vi.fn(), eq: vi.fn() };
    calibrationsChain.select.mockReturnValue(calibrationsChain);
    calibrationsChain.eq.mockResolvedValue({
      data: [{ modifier_source: 'readiness', sample_count: 1, mean_bias: 0.1, adjustment: 0.005 }],
      error: null,
    });

    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(calibrationsChain);

    const sample = { modifierSource: 'readiness', multiplier: 0.95, rpeTarget: 8, rpeActual: 8 };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration({ suggestedAdjustment: 0.001 }));
    mockCanAutoApply.mockReturnValue(false);
    mockShouldTriggerReview.mockReturnValue(false);

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    // Retains current adjustment (0.005), still upserts to save updated stats
    expect(mockUpsertModifierCalibration).toHaveBeenCalledOnce();
    expect(mockUpsertModifierCalibration).toHaveBeenCalledWith(
      expect.objectContaining({ adjustment: 0.005 })
    );
    expect(mockReviewCalibrationAdjustment).not.toHaveBeenCalled();
  });

  it('uses running mean when prior calibration exists', async () => {
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: makeTrace() },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 10 }, error: null });
    const calibrationsChain = { select: vi.fn(), eq: vi.fn() };
    calibrationsChain.select.mockReturnValue(calibrationsChain);
    // Existing: 4 samples, mean_bias = 1.0
    calibrationsChain.eq.mockResolvedValue({
      data: [{ modifier_source: 'readiness', sample_count: 4, mean_bias: 1.0, adjustment: 0.02 }],
      error: null,
    });

    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(calibrationsChain);

    const sample = { modifierSource: 'readiness', multiplier: 0.95, rpeTarget: 8, rpeActual: 10 };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration());
    mockCanAutoApply.mockReturnValue(true);

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

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
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: trace },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 9 }, error: null });
    const calibrationsChain = { select: vi.fn(), eq: vi.fn() };
    calibrationsChain.select.mockReturnValue(calibrationsChain);
    calibrationsChain.eq.mockResolvedValue({ data: [], error: null });

    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(calibrationsChain);

    const sample = { modifierSource: 'readiness', multiplier: 0.95, rpeTarget: 8, rpeActual: 9 };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration());
    mockCanAutoApply.mockReturnValue(true);

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    // extractModifierSamples must only receive the readiness modifier (not bodyweight)
    const [{ modifiers }] = mockExtractModifierSamples.mock.calls[0] as [{ modifiers: Array<{ source: string }> }];
    expect(modifiers.every((m) => ['readiness', 'cycle_phase', 'soreness'].includes(m.source))).toBe(true);
  });

  it('catches errors and calls captureException', async () => {
    fromMock.mockImplementation(() => {
      throw new Error('network failure');
    });

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

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
    const sessionChain = createQueryChain('maybeSingle', {
      data: { jit_output_trace: traceNoSets },
      error: null,
    });
    const logChain = createQueryChain('maybeSingle', { data: { session_rpe: 9 }, error: null });
    const calibrationsChain = { select: vi.fn(), eq: vi.fn() };
    calibrationsChain.select.mockReturnValue(calibrationsChain);
    calibrationsChain.eq.mockResolvedValue({ data: [], error: null });

    fromMock
      .mockReturnValueOnce(sessionChain)
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(calibrationsChain);

    const sample = { modifierSource: 'readiness', multiplier: 0.95, rpeTarget: 8, rpeActual: 9 };
    mockExtractModifierSamples.mockReturnValue([sample]);
    mockComputeCalibrationBias.mockReturnValue(makeCalibration());
    mockCanAutoApply.mockReturnValue(true);

    await updateModifierCalibrations({ sessionId: SESSION_ID, userId: USER_ID });

    // rpeTarget defaults to 8 when sets array is empty
    expect(mockExtractModifierSamples).toHaveBeenCalledWith(
      expect.objectContaining({ rpeTarget: 8 })
    );
  });
});
