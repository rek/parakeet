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
