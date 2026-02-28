import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateText } from 'ai'
import {
  assembleCycleReviewPrompt,
  buildLiftProgress,
  extractSummary,
  generateCycleReview,
} from './cycle-review-generator'
import type { PreviousCycleSummary } from './cycle-review-generator'
import type { CycleReport } from './assemble-cycle-report'
import type { CycleReview } from '@parakeet/shared-types'

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn().mockReturnValue({}) },
}))
const mockGenerateText = generateText as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeReport(overrides: Partial<CycleReport> = {}): CycleReport {
  return {
    programId: 'prog-001',
    totalWeeks: 12,
    completionPct: 0.9,
    lifts: {
      squat: {
        startOneRmKg: 140,
        endOneRmKg: 147.5,
        sessionCount: 12,
        completedCount: 11,
        avgRpeVsTarget: 0.3,
        blockRpeTrends: [
          { block: 1, avgRpe: 8.3, targetRpe: 8.5 },
          { block: 2, avgRpe: 8.6, targetRpe: 8.5 },
          { block: 3, avgRpe: 8.9, targetRpe: 8.5 },
        ],
      },
      bench: {
        startOneRmKg: 100,
        endOneRmKg: 100,
        sessionCount: 12,
        completedCount: 12,
        avgRpeVsTarget: -0.2,
        blockRpeTrends: [
          { block: 1, avgRpe: 8.2, targetRpe: 8.5 },
          { block: 2, avgRpe: 8.3, targetRpe: 8.5 },
          { block: 3, avgRpe: 8.4, targetRpe: 8.5 },
        ],
      },
    },
    weeklyVolume: [],
    auxiliaryCorrelations: [
      { exercise: 'Pause Squat', lift: 'squat', precedingWeeks: 4, liftChangePct: 5.4 },
      { exercise: 'Box Squat', lift: 'squat', precedingWeeks: 4, liftChangePct: 5.4 },
      { exercise: 'Close Grip', lift: 'bench', precedingWeeks: 4, liftChangePct: 0 },
    ],
    disruptions: [
      { type: 'illness', severity: 'minor', affectedLifts: null, reportedAt: '2026-02-01T00:00:00Z' },
    ],
    formulaChanges: [
      { source: 'ai_suggestion', overrides: {}, createdAt: '2026-01-15T00:00:00Z' },
    ],
    ...overrides,
  }
}

function makeReview(overrides: Partial<CycleReview> = {}): CycleReview {
  return {
    overallAssessment: 'Good cycle.',
    progressByLift: {
      squat: { rating: 'good', narrative: 'Squat improved well.' },
      bench: { rating: 'stalled', narrative: 'Bench stalled.' },
      deadlift: { rating: 'good', narrative: 'Deadlift solid.' },
    },
    auxiliaryInsights: {
      mostCorrelated: [
        { exercise: 'Pause Squat', lift: 'squat', explanation: 'Strong correlation.' },
      ],
      leastEffective: [
        { exercise: 'Close Grip', lift: 'bench', explanation: 'No correlation.' },
      ],
      recommendedChanges: { add: [], remove: ['Close Grip'], reorder: [] },
    },
    volumeInsights: {
      musclesUnderRecovered: ['quads'],
      musclesUndertrained: ['triceps'],
      frequencyRecommendation: 'Consider 4-day week.',
    },
    formulaSuggestions: [],
    structuralSuggestions: [],
    nextCycleRecommendations: 'Increase squat frequency.',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildLiftProgress
// ---------------------------------------------------------------------------

describe('buildLiftProgress', () => {
  it('computes oneRmChangeKg correctly from liftSummary', () => {
    const report = makeReport()
    const progress = buildLiftProgress(report.lifts)

    expect(progress.squat?.oneRmStartKg).toBe(140)
    expect(progress.squat?.oneRmEndKg).toBe(147.5)
    expect(progress.squat?.oneRmChangeKg).toBeCloseTo(7.5, 5)
    expect(progress.squat?.avgRpeVsTarget).toBe(0.3)
    expect(progress.squat?.sessionCount).toBe(12)
  })

  it('returns zero change when start equals end', () => {
    const report = makeReport()
    const progress = buildLiftProgress(report.lifts)
    expect(progress.bench?.oneRmChangeKg).toBe(0)
  })

  it('returns empty object when lifts is empty', () => {
    const progress = buildLiftProgress({})
    expect(Object.keys(progress)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// extractSummary
// ---------------------------------------------------------------------------

describe('extractSummary', () => {
  it('correctly maps CycleReport + CycleReview to PreviousCycleSummary', () => {
    const report = makeReport()
    const review = makeReview()

    const summary = extractSummary(report, review, 2, 80, 79.5, 420.5)

    expect(summary.cycleNumber).toBe(2)
    expect(summary.programLengthWeeks).toBe(12)
    expect(summary.completionPct).toBe(0.9)
    expect(summary.formulaChangesCount).toBe(1)
    expect(summary.disruptionCount).toBe(1)
    expect(summary.bodyWeightStartKg).toBe(80)
    expect(summary.bodyWeightEndKg).toBe(79.5)
    expect(summary.wilksScore).toBe(420.5)
  })

  it('maps liftProgress fields', () => {
    const report = makeReport()
    const review = makeReview()
    const summary = extractSummary(report, review, 1, 80, 80, 400)

    expect(summary.liftProgress.squat?.oneRmChangeKg).toBeCloseTo(7.5, 5)
  })

  it('classifies aux correlations using review insights', () => {
    const report = makeReport()
    const review = makeReview()
    const summary = extractSummary(report, review, 1, 80, 80, 400)

    const pauseSquat = summary.topAuxCorrelations.find((c) => c.exercise === 'Pause Squat')
    const closeGrip = summary.topAuxCorrelations.find((c) => c.exercise === 'Close Grip')
    const boxSquat = summary.topAuxCorrelations.find((c) => c.exercise === 'Box Squat')

    expect(pauseSquat?.correlationDirection).toBe('positive')
    expect(closeGrip?.correlationDirection).toBe('negative')
    expect(boxSquat?.correlationDirection).toBe('neutral')
  })

  it('builds volumeNotes from volumeInsights', () => {
    const report = makeReport()
    const review = makeReview()
    const summary = extractSummary(report, review, 1, 80, 80, 400)

    expect(summary.volumeNotes.some((n) => n.includes('quads'))).toBe(true)
    expect(summary.volumeNotes.some((n) => n.includes('triceps'))).toBe(true)
    expect(summary.volumeNotes.some((n) => n.includes('4-day'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// assembleCycleReviewPrompt
// ---------------------------------------------------------------------------

describe('assembleCycleReviewPrompt', () => {
  it('includes serialised previous summaries when provided', () => {
    const report = makeReport()
    const review = makeReview()
    const summary = extractSummary(report, review, 1, 80, 80, 400)

    const prompt = assembleCycleReviewPrompt(report, [summary])

    expect(prompt).toContain('Previous 1 cycle(s) summary:')
    expect(prompt).toContain('"cycleNumber": 1')
    expect(prompt).toContain('Use this history to:')
  })

  it('includes "first cycle" message when previousSummaries is empty', () => {
    const report = makeReport()
    const prompt = assembleCycleReviewPrompt(report, [])

    expect(prompt).toContain('first completed cycle')
    expect(prompt).not.toContain('Previous')
  })

  it('includes cycleReport in all cases', () => {
    const report = makeReport()

    const promptWithHistory = assembleCycleReviewPrompt(report, [])
    const promptEmpty = assembleCycleReviewPrompt(report, [])

    expect(promptWithHistory).toContain('"programId": "prog-001"')
    expect(promptEmpty).toContain('"programId": "prog-001"')
  })

  it('multi-cycle prompt contains instruction text', () => {
    const report = makeReport()
    const review = makeReview()
    const summaries: PreviousCycleSummary[] = [
      extractSummary(report, review, 1, 80, 80, 400),
      extractSummary(report, review, 2, 80, 79, 410),
    ]

    const prompt = assembleCycleReviewPrompt(report, summaries)
    expect(prompt).toContain('Previous 2 cycle(s) summary:')
    expect(prompt).toContain('Identify trends across cycles')
  })
})

// ---------------------------------------------------------------------------
// generateCycleReview
// ---------------------------------------------------------------------------

describe('generateCycleReview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes prompt with previous summaries to generateText', async () => {
    const fakeReview = makeReview()
    mockGenerateText.mockResolvedValueOnce({ output: fakeReview })

    const report = makeReport()
    const prevSummary = extractSummary(report, makeReview(), 1, 80, 80, 400)

    await generateCycleReview(report, [prevSummary])

    expect(mockGenerateText).toHaveBeenCalledOnce()
    const call = mockGenerateText.mock.calls[0][0]
    expect(call.prompt).toContain('Previous 1 cycle(s) summary:')
  })

  it('passes "first cycle" message when no previous summaries', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: makeReview() })

    await generateCycleReview(makeReport(), [])

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.prompt).toContain('first completed cycle')
  })

  it('defaults to empty previousSummaries when not provided', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: makeReview() })

    await generateCycleReview(makeReport())

    const call = mockGenerateText.mock.calls[0][0]
    expect(call.prompt).toContain('first completed cycle')
  })

  it('returns the LLM CycleReview object', async () => {
    const fakeReview = makeReview({ overallAssessment: 'Excellent cycle.' })
    mockGenerateText.mockResolvedValueOnce({ output: fakeReview })

    const result = await generateCycleReview(makeReport())
    expect(result.overallAssessment).toBe('Excellent cycle.')
  })
})
