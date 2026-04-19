# mobile-049: Additional Video Analysis Metrics

**Status:** Implemented
**Design:** [video-analysis-future-directions.md](../../design/video-analysis-future-directions.md) §0
**Depends on:** mobile-046 (video form analysis), mobile-048 (set-level video linking)

## What This Covers

New biomechanical metrics computed from existing MediaPipe pose landmarks. Pure math — no new models, no new dependencies. Each metric is a function in `modules/video-analysis/lib/` plugged into `assembleAnalysis` via the strategy pattern.

All metrics use the same `PoseFrame[]` input. Landmarks available: shoulders (11,12), elbows (13,14), wrists (15,16), hips (23,24), knees (25,26), ankles (27,28). `CM_PER_UNIT = 243`.

## Phase 1 — Fatigue Signatures (cross-rep analysis)

**`modules/video-analysis/lib/fatigue-signatures.ts`:**

- [x] `computeFatigueSignatures({ reps }): FatigueSignatures` — takes the `reps[]` array from `VideoAnalysisResult`, returns per-metric deltas from rep 1 to rep N:
  - `forwardLeanDriftDeg: number | null` — `lean[last] - lean[first]`. Positive = increasing lean (posterior chain fatigue).
  - `barDriftIncreaseCm: number | null` — `drift[last] - drift[first]`. Increasing = motor control loss.
  - `romCompressionCm: number | null` — `rom[first] - rom[last]`. Positive = reps getting shorter (cheating).
  - `descentSpeedChange: number | null` — ratio of last eccentric duration to first. >1 = slowing down, <1 = rushing.
  - `lockoutDegradationDeg: number | null` — `lockout[first] - lockout[last]`. Positive = lockout getting worse.
  - `velocityLossTrend: 'increasing' | 'stable' | 'decreasing' | null` — monotonicity of velocity loss across reps.
- [x] Add `FatigueSignaturesSchema` to `packages/shared-types/src/video-analysis.schema.ts`
- [x] Add `fatigueSignatures` field to `VideoAnalysisResultSchema` (optional, top-level)
- [x] Wire into `assembleAnalysis` after rep loop (takes `repsWithVelocity` array)
- [x] Tests: flat set (no fatigue), progressive fatigue, improving set, mixed, stable velocity trend, first/last only deltas (7 tests)

## Phase 2 — Squat-Specific Metrics

### 2.1 — Butt Wink Detection

**`modules/video-analysis/lib/butt-wink-detector.ts`:**

- [x] `detectButtWink({ frames, bottomFrame, fps }): { detected: boolean; magnitudeDeg: number | null; frameIndex: number | null }`
  - Compute hip angle (shoulder-hip-knee) frame-by-frame during the last 30% of descent
  - "Butt wink" = hip angle drops sharply (>10° in <200ms) at the bottom
  - Uses: `LANDMARK.LEFT_SHOULDER`, `LEFT_HIP`, `LEFT_KNEE` (or right side, average both)
  - Always computed; accuracy highest from side view (high `sagittalConfidence`)
- [x] Add to `RepAnalysis`: `buttWinkDeg: z.number().optional()`
- [x] Add as a fault: `type: 'butt_wink'`, severity `'warning'`
- [x] Tests: clean squat (no wink), wink at bottom, gradual hip flexion (not wink)

### 2.2 — Stance Width

**`modules/video-analysis/lib/stance-width.ts`:**

- [x] `computeStanceWidth({ frame }): number` — `|leftAnkle.x - rightAnkle.x| × CM_PER_UNIT`
  - Always computed; most accurate from front view (low `sagittalConfidence`). Side view gives compressed projection.
  - Compute at standing frame (first or last frame of rep)
- [x] Add to `RepAnalysis`: `stanceWidthCm: z.number().optional()`
- [x] Tests: narrow, medium, wide stance

### 2.3 — Hip Shift / Lateral Lean

**`modules/video-analysis/lib/hip-shift.ts`:**

- [x] `computeHipShift({ frames, startFrame, endFrame }): { maxShiftCm: number; direction: 'left' | 'right' | 'none' }`
  - Track `(leftHip.y - rightHip.y) × CM_PER_UNIT` per frame
  - Return max asymmetry and which side drops
  - Always computed; most accurate from front view (low `sagittalConfidence`)
- [x] Add to `RepAnalysis`: `hipShiftCm: z.number().optional()`, `hipShiftDirection: z.string().optional()`
- [x] Tests: symmetric, left shift, right shift

## Phase 3 — Bench-Specific Metrics

### 3.1 — Elbow Flare Angle

**`modules/video-analysis/lib/elbow-flare.ts`:**

- [x] `computeElbowFlare({ frame }): number` — angle between upper arm (shoulder→elbow) and torso (shoulder→hip) at bottom frame
  - Side view: compute on the visible side
  - Ideal range: 45-75° depending on grip width
- [x] Add to `RepAnalysis`: `elbowFlareDeg: z.number().optional()`
- [x] Add as fault when >80° or <30°: `type: 'elbow_flare'`
- [x] Tests: optimal (60°), excessive (85°), overtucked (25°)

### 3.2 — Pause Quality (Sink Detection)

**`modules/video-analysis/lib/pause-quality.ts`:**

- [x] `assessPauseQuality({ repPath, fps }): { pauseDurationSec: number; isSinking: boolean }`
  - Find the bottom frame (max Y in bar path)
  - Check if Y continues increasing after the "bottom" (sinking vs settled)
  - Pause duration = frames where velocity < threshold around the bottom
- [x] Add to `RepAnalysis`: `pauseDurationSec: z.number().optional()`, `isSinking: z.boolean().optional()`
- [x] Tests: clean pause, sinking, no pause (touch-and-go)

## Phase 4 — Deadlift-Specific Metrics

### 4.1 — Hip Hinge Timing

**`modules/video-analysis/lib/hip-hinge-timing.ts`:**

- [x] `analyzeHipHingeTiming({ frames, startFrame, endFrame, fps }): { crossoverPct: number; isEarlyHipShoot: boolean }`
  - For each concentric frame: compute knee angle velocity vs hip angle velocity
  - `crossoverPct` = position in the concentric (0-100%) where hip velocity exceeds knee velocity
  - Early crossover (<30%) = "hips shooting up" (bad)
  - Late crossover (>50%) = proper leg drive first, then hip extension (good)
- [x] Add to `RepAnalysis`: `hipHingeCrossoverPct: z.number().optional()`
- [x] Add as fault when crossoverPct < 30%: `type: 'early_hip_shoot'`
- [x] Tests: proper timing, early hip shoot, stiff-leg pull

### 4.2 — Bar-to-Shin Distance

**`modules/video-analysis/lib/bar-shin-distance.ts`:**

- [x] `computeBarToShinDistance({ frames, startFrame, endFrame }): number`
  - During first third of pull: `wristAvg.x - kneeAvg.x` in normalized coords → cm
  - Should be near zero for conventional, slightly positive for sumo
- [x] Add to `RepAnalysis`: `barToShinDistanceCm: z.number().optional()`
- [x] Add as fault when >5cm: `type: 'bar_away_from_shins'`
- [x] Tests: bar close, bar drifting forward

## Phase 6 — Front-On Bench (v5, 2026-04-19) — backlog #24 Track B

Side-view bench metrics project the L/R wrists to near-identical image points and the elbow angle collapses toward collinearity, so from the front the v4 pipeline produced degenerate readings. Phase 6 gates a dedicated front-bench block on `sagittalConfidence < 0.5` and adds three asymmetry metrics plus a rep-detection signal that actually oscillates from the front. Elbow flare is also rewritten as a per-frame series (applies to every bench view).

Bumps `ANALYSIS_VERSION` to **5**. Old rows remain displayable — all new fields are optional.

### 6.1 — Front-on rep-detection signal

**`modules/video-analysis/lib/rep-detector.ts`:**

- [x] Extend `detectReps` signature with optional `sagittalConfidence` (default 1, matching legacy side-view behaviour).
- [x] `extractFrontBenchSignal({ frames }): number[] | null` — `(meanWristY − meanShoulderY)` per frame; null when fewer than `MIN_ANGLE_FRAMES` frames have both wrists + both shoulders visible.
- [x] When `lift === 'bench' && sagittalConfidence < 0.5`, use this signal instead of the inverted elbow angle. Peaks stay at chest touch (higher value = wrists dropped toward shoulders).
- [x] Absolute-value filter for the signal-range calculation — front-bench signal is signed.
- [x] Synthetic test: near-collinear shoulder/elbow/wrist frames at `sagittalConfidence = 0.2` → 4 reps detected; `sagittalConfidence = 1` → falls through to the elbow-angle path.

### 6.2 — Elbow flare series

**`modules/video-analysis/lib/elbow-flare-series.ts`:**

- [x] `computeElbowFlareSeries({ frames, startFrame, endFrame }): { minDeg, maxDeg, meanDeg, framesUsed }` — sample flare every frame across the rep; average left + right when both visible, fall back to whichever side is visible.
- [x] Fault now fires on `maxDeg > 80` or `maxDeg < 30` (v4 fired on the single midpoint sample).
- [x] `RepAnalysis.elbowFlareDeg` preserved as the series **mean** so downstream consumers (coaching prompts, UI chips) don't break; new fields `elbowFlareMinDeg` / `elbowFlareMaxDeg` / `elbowFlareMeanDeg` surface the full distribution.

### 6.3 — Bar tilt

**`modules/video-analysis/lib/bar-tilt.ts`:**

- [x] `computeBarTiltSeries({ frames, startFrame, endFrame }): { maxDeg, meanDeg, framesUsed }` — per-frame absolute angle of the L-R wrist line vs. horizontal.
- [x] `RepAnalysis.barTiltMaxDeg` / `barTiltMeanDeg` — front-view only.
- [x] Fault `uneven_lockout` when `maxDeg > 8°`.

### 6.4 — Press asymmetry

**`modules/video-analysis/lib/press-asymmetry.ts`:**

- [x] `computePressAsymmetry({ frames, startFrame, endFrame }): { ratio, framesUsed }` — peak `|leftWristY − rightWristY|` / torso length across the window.
- [x] `RepAnalysis.pressAsymmetryRatio` — front-view only.
- [x] Fault `press_asymmetry` when ratio > 0.08 (≈ 8% of torso).

### 6.5 — Elbow-path symmetry

**`modules/video-analysis/lib/elbow-path-symmetry.ts`:**

- [x] `computeElbowPathSymmetry({ frames, startFrame, endFrame }): { ratio, framesUsed }` — mean L/R elbow horizontal distance from shoulder midline, returned as left÷right.
- [x] `RepAnalysis.elbowPathSymmetryRatio` — front-view only.
- [x] Fault `elbow_asymmetry` when ratio < 0.8 or > 1.25.

### Fault thresholds (provisional — tuned on one fixture)

The following fault thresholds fire `warning`-severity faults from within `metrics-assembler.ts`:

| Constant | Value | Applies to |
| --- | --- | --- |
| `BAR_TILT_FAULT_DEG` | 8° | `uneven_lockout` fault when `barTiltMaxDeg` exceeds this |
| `PRESS_ASYMMETRY_FAULT_RATIO` | 0.08 | `press_asymmetry` fault when `pressAsymmetryRatio` exceeds this (≈ 8% of torso) |
| `ELBOW_PATH_SYMMETRY_MIN` / `MAX` | 0.8 / 1.25 | `elbow_asymmetry` fault when `elbowPathSymmetryRatio` falls outside this band |
| `ELBOW_FLARE_MAX_FAULT_DEG` / `MIN` | 80° / 30° | `elbow_flare` fault on the per-rep max (unchanged thresholds from v4, now driven by the series rather than a midpoint sample) |

These were tuned by eye against a single `bench-front-4reps` fixture. They are **provisional** — revisit once we have ≥ 3 independent front-bench fixtures across lifters and phone positions. If real-world usage shows them firing on clean form, widen; if they let through what a coach would flag, tighten. Keep them co-located in `metrics-assembler.ts` (not a domain doc) until the tuning stabilises — promotion to `docs/domain/` is the signal that the values are load-bearing across sessions.

### Validation

- [x] Unit tests per new lib (6–8 synthetic cases each).
- [x] Calibration run across 16 fixtures: 4 reps on `bench-front-4reps`; new faults `press_asymmetry` + `uneven_lockout` now flag on the front-view fixture; 15 side-view fixtures pass unchanged.
- [x] Manifest `metrics_present` + `faults_to_test` updated for `bench-front-4reps`.

### Out of scope (tracked in #24)

- Track A occlusion robustness (heavy model, plausibility filtering, wrist-anchored reconstruction).
- UI surfacing of the new metrics (rep card chips).
- LLM coaching prompts referencing the new asymmetry fields — revisit once the values stabilise over real-world sessions.

## Phase 7 — Bench Chest-Touch Gap (v6, 2026-04-19) — backlog #26

Surfaced while sanity-checking v5 front-bench metrics on `bench-front-4reps`: the user confirmed the bar never touches the chest on any of the 4 reps, but v5 reported a clean rep count and emitted no partial-rep fault. In competition bench this is the single most red-lightable form fault; for training it is the difference between a real press and a partial.

Phase 7 adds a per-rep `chestTouchGap` (signed, torso-normalised) plus two faults — `no_chest_touch` (critical) and `shallow_bench` (warning) — gated to front view only. Bumps `ANALYSIS_VERSION` to **6**. All new fields are optional.

### 7.1 — Chest-touch gap

**`modules/video-analysis/lib/bench-chest-touch.ts`:**

- [x] `computeChestTouchGap({ frames, startFrame, endFrame, sagittalConfidence }): { gap: number; framesUsed: number }` — per-frame compute `(refY − meanWristY) / torsoLen`, return the min across the rep window. `gap > 0` ⇒ bar stopped above the chest reference (partial); `gap ≤ 0` ⇒ bar reached or passed it.
- [x] Front view (`sagittalConfidence < MIN_SAGITTAL_CONFIDENCE`): reference Y = shoulder midpoint Y. Clean read on a supine lifter filmed from the foot end.
- [x] Side view: reference Y = `shoulderY + 0.2 * (hipY − shoulderY)` — a coarse chest approximation without a dedicated sternum landmark.
- [x] All required landmarks gated at `VIS_THRESHOLD = 0.5`; hips required on both angles (torso-length normalisation).
- [x] Returns `{ gap: 0, framesUsed: 0 }` when no frame is usable — caller treats zero framesUsed as "no signal".

### 7.2 — Wiring into `metrics-assembler.ts`

- [x] Computed on every bench rep using the existing `safeStart..safeEnd` window.
- [x] `RepAnalysis.chestTouchGap` stored on both angles (raw signal visible to future consumers).
- [x] Faults gated to front view only. Side-view approximation was validated against `bench-45-5reps` and produced gaps of 0.3–1.0 torso on reps the lifter touched — too unstable to fault on without a proper sternum landmark. Backlog #26 explicitly predicted this outcome.
- [x] `no_chest_touch` severity does NOT downgrade below `MIN_SAGITTAL_CONFIDENCE` (contrast with `butt_wink`): the front view is where the metric is most reliable, and that is also where confidence is low by construction.

### Fault thresholds (provisional — tuned on one fixture)

| Constant | Value | Applies to |
| --- | --- | --- |
| `NO_CHEST_TOUCH_GAP` | 0.10 | `no_chest_touch` (critical) fault when `chestTouchGap` exceeds this on a front-view bench rep |
| `SHALLOW_BENCH_GAP` | 0.03 | `shallow_bench` (warning) fault when `chestTouchGap` exceeds this on a front-view bench rep |

Tuned by eye against `bench-front-4reps` (user-confirmed partial on all 4 reps). **Provisional** — widen or tighten once ≥ 3 independent front-bench fixtures confirm the bands across lifters and phone positions. Constants stay co-located in `metrics-assembler.ts` until the tuning stabilises.

### Validation

- [x] 9 unit tests in `lib/__tests__/bench-chest-touch.test.ts` (front deep touch, clear partial, shallow band, side-view approximation, visibility gates, frame-index clamping, zero-signal path).
- [x] `analysisVersion` expectations bumped 5 → 6 in `analyze-video.test.ts` and `calibration.test.ts`.
- [x] Calibration run across 16 fixtures: `bench-front-4reps` emits `no_chest_touch` on every rep; `bench-45-5reps` (side view) emits neither chest-touch fault.
- [x] Manifest `metrics_present` + `faults_to_test` updated for `bench-front-4reps`.

### Out of scope

- Touch-and-go vs paused bench — `pauseDurationSec` / `isSinking` already cover pause timing.
- Bar-Y velocity profile — already computed upstream.
- Coaching-prompt update to mention partial reps — follow up once the metric stabilises over real-world sessions.
- UI rep-card chip for the new metric — follow up.

## Phase 5 — Lockout Stability (All Lifts)

**`modules/video-analysis/lib/lockout-stability.ts`:**

- [x] `computeLockoutStability({ frames, endFrame, fps }): number`
  - Compute hip angle variance in last 10% of rep frames
  - Low variance = stable lockout, high variance = wobbling
  - Returns coefficient of variation (CV) as a percentage
- [x] Add to `RepAnalysis`: `lockoutStabilityCv: z.number().optional()`
- [x] Add as fault when CV > 5%: `type: 'unstable_lockout'`
- [x] Tests: stable, wobbly, still ascending at end

## Barrel Exports

All new functions exported from `modules/video-analysis/index.ts` for use in coaching context and UI display.

## Dependencies

- `PoseFrame[]` from existing extraction pipeline
- `CM_PER_UNIT` from `pose-types.ts`
- `LANDMARK` indices from `pose-types.ts`
- `RepAnalysis` schema from `@parakeet/shared-types`

## Sequencing

```
Phase 1 (fatigue signatures) — highest coaching value, uses existing per-rep metrics
Phase 2 (squat) ──┐
Phase 3 (bench) ──┤ independent, can run in parallel
Phase 4 (deadlift)┤
Phase 5 (lockout) ┘
```
