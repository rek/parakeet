# mobile-047: Competition Readiness Scoring

**Status:** Planned
**Design:** [competition-readiness.md](../../design/competition-readiness.md)
**Domain:** Video Analysis (app-side, not engine)

## What This Covers

Grade every rep against IPF competition standards. Pure deterministic functions that take existing `RepAnalysis` data and return pass/fail/borderline verdicts. No new CV processing — builds entirely on Phase 1-3 video analysis output. Adds a readiness score aggregated across recent videos.

## Phase 4.1 — Competition grading (pure lib)

**`modules/video-analysis/lib/competition-grader.ts`:**

- [ ] `RepVerdict` type: `{ verdict: 'white_light' | 'red_light' | 'borderline'; criteria: CriterionResult[] }`
- [ ] `CriterionResult` type: `{ name: string; verdict: 'pass' | 'borderline' | 'fail'; measured: number; threshold: number; unit: string; message: string }`
- [ ] `gradeSquatRep({ rep, frames })` — evaluate:
  - Depth: hip crease vs knee Y at bottom frame. Pass ≥2cm below, borderline 0-2cm, fail above.
  - Lockout: knee angle at end frame. Pass ≥175°, borderline 170-175°, fail <170°.
  - Forward motion at top: bar path X drift in final 20% of rep. Pass <2cm, borderline 2-4cm, fail >4cm.
- [ ] `gradeBenchRep({ rep, frames, fps })` — evaluate:
  - Pause at bottom: compute bar Y velocity from bar path, detect stall ≥0.3s. Pass ≥0.3s, borderline 0.15-0.3s, fail <0.15s.
  - Lockout: need elbow angle — compute from shoulder-elbow-wrist landmarks at end frame. Pass ≥170°, borderline 165-170°, fail <165°.
  - Even press: left vs right wrist Y delta at end frame. Pass <2cm, borderline 2-4cm, fail >4cm.
- [ ] `gradeDeadliftRep({ rep, frames })` — evaluate:
  - Hip lockout: hip angle at end frame. Pass ≥175°, borderline 170-175°, fail <170°.
  - Knee lockout: knee angle at end frame. Pass ≥175°, borderline 170-175°, fail <170°.
  - No downward motion: check bar path Y for non-monotonic segments during the concentric phase. Pass = monotonic, borderline ≤1cm dip, fail >1cm dip.
  - Shoulders back: shoulder X behind or aligned with hip X at end frame. Pass = behind, borderline = aligned (±1cm), fail = forward.
- [ ] `gradeRep({ rep, frames, fps, lift })` — dispatcher that calls the lift-specific grader
  - Returns `RepVerdict` with overall verdict (worst criterion wins) + individual criterion results

**`modules/video-analysis/lib/__tests__/competition-grader.test.ts`:**

- [ ] Squat depth: pass (5cm below), borderline (1cm below), fail (2cm above)
- [ ] Squat lockout: pass (178°), borderline (172°), fail (165°)
- [ ] Deadlift lockout: pass (hip 178° + knee 176°), fail (hip 168°)
- [ ] Deadlift downward motion: pass (monotonic), fail (2cm dip)
- [ ] Bench pause: pass (0.4s stall), borderline (0.2s), fail (no stall)
- [ ] Overall verdict: worst criterion determines rep verdict
- [ ] Invariant: every rep gets exactly one verdict

## Phase 4.2 — Readiness score aggregation

**`modules/video-analysis/lib/readiness-score.ts`:**

- [ ] `ComputeReadinessScore({ videos, lift })` — takes recent `SessionVideo[]` (with analysis), returns:
  - `passRate`: white_light count / total reps (excluding deload sessions)
  - `totalReps`, `passedReps`, `borderlineReps`, `failedReps`
  - `trend`: 'improving' | 'stable' | 'declining' — compare first half vs second half of window
  - `mostCommonFailure`: the criterion name that appears most in red_light verdicts, or null
  - `window`: number of videos used (max 5)
- [ ] Filter: skip videos where `intensityType === 'deload'` (deload form is not representative)
- [ ] Filter: only include videos from the last 8 weeks (stale data not useful for readiness)

**`modules/video-analysis/lib/__tests__/readiness-score.test.ts`:**

- [ ] 100% pass rate when all reps pass
- [ ] Correct trend detection (improving: first half worse, second half better)
- [ ] Deload exclusion
- [ ] Most common failure aggregation
- [ ] Empty input returns null

## Phase 4.3 — Schema + model updates

**`packages/shared-types/src/video-analysis.schema.ts`:**

- [ ] Add `RepVerdictSchema` and `CriterionResultSchema`
- [ ] Add optional `verdict: RepVerdictSchema` field to `RepAnalysisSchema`
  - Populated by the grader after analysis runs, stored in the analysis JSONB

**`modules/video-analysis/lib/metrics-assembler.ts`:**

- [ ] After assembling analysis, run `gradeRep()` on each rep and attach `verdict` field
  - This means every new analysis automatically includes competition grading

**`modules/video-analysis/lib/angle-calculator.ts`:**

- [ ] Add `computeElbowAngle({ frame })` — shoulder-elbow-wrist angle for bench lockout detection
- [ ] Add `computeBarVelocity({ barPath, fps })` — frame-to-frame Y velocity for pause detection

## Phase 4.4 — UI: verdict badges + readiness card

**`modules/video-analysis/ui/VerdictBadge.tsx`:**

- [ ] Compact badge per rep: green check (white_light), red X (red_light), yellow ~ (borderline)
- [ ] Tap to expand: shows individual criterion results with measured vs threshold

**`modules/video-analysis/ui/ReadinessCard.tsx`:**

- [ ] Section below rep metrics on analysis screen
- [ ] Shows per-lift pass rate as a large percentage with colored ring
- [ ] Trend indicator (arrow + label)
- [ ] Most common failure callout
- [ ] "Based on last N sessions" subtitle

**`app/(tabs)/session/video-analysis.tsx`:**

- [ ] Wire `VerdictBadge` into each rep card
- [ ] Wire `ReadinessCard` below the analysis section
- [ ] Compute readiness from `usePreviousVideos` + current analysis

## Phase 4.5 — Integration with LLM coaching

**`modules/video-analysis/application/assemble-coaching-context.ts`:**

- [ ] Add verdict data to coaching context so the LLM can reference competition grades
  - `competitionPassRate`, `failedCriteria[]` included in the prompt context

**`packages/training-engine/src/ai/prompts.ts`:**

- [ ] Extend `FORM_COACHING_SYSTEM_PROMPT` with competition context:
  - "If competition verdicts are provided, reference specific failed criteria"
  - "Distinguish training faults (form optimization) from competition faults (would cause a red light)"

## Dependencies

- [mobile-046](./mobile-046-video-form-analysis.md) Phase 1-3 — all video analysis infrastructure
- `RepAnalysis` fields: `maxDepthCm`, `hipAngleAtLockoutDeg`, `kneeAngleDeg`, `barPath`, `faults`
- `PoseFrame[]` access for per-frame landmark queries (elbow angle, wrist delta)
