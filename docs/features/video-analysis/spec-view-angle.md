# mobile-052: View Angle Rework — Continuous Sagittal Confidence

**Status:** Implemented
**Depends on:** mobile-046 (video form analysis), mobile-049 (additional video metrics)

## What This Covers

Replace the binary `'side' | 'front'` camera angle classification with a continuous `sagittalConfidence` score (0–1). Fix rep detection to use joint angles instead of hip Y-coordinate, making it viewpoint-invariant. Remove conditional metric gating so all metrics are always computed, each carrying a confidence score. Remove `CameraAnglePicker` from the UI.

## Problem

`detect-camera-angle.ts` does binary classification: if average shoulder X-separation > 0.15 normalized units across the first 10 frames → `'front'`, else `'side'`. This causes:

1. Most gym videos (~30–60° angles) are misclassified as one extreme
2. Binary threshold at 0.15 creates silent failures at intermediate angles
3. Side-classified at 45°: depth/lean computed from foreshortened coordinates → garbage values
4. Front-classified at 45°: depth/lean/butt-wink silently skipped → incomplete analysis
5. Rep detection uses hip/wrist Y periodicity, which compresses at oblique angles → false peaks, missed reps
6. `CameraAnglePicker` forces users to pick side or front — most videos are neither
7. `above_parallel` fault silently skipped when classified as front

## Design Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Classification model | `sagittalConfidence: number` (0–1) replaces `'side' \| 'front'` | 0 = pure front, 1 = pure side, 0.5 = 45°. Eliminates the binary cliff causing silent failures. |
| 2 | Metric computation | Always compute all metrics; attach per-metric confidence | No more if/else gating. Every metric carries a confidence score. UI and LLM weight by confidence. |
| 3 | Rep detection | Joint angle periodicity replaces hip Y periodicity | Joint angles are viewpoint-invariant. Knee 170°→90°→170° is a rep regardless of camera angle. PoseRAC approach (paper 2308.08632v2) without a trained model. |
| 4 | Confidence formula | `sagittalConfidence = 1 - clamp(avgShoulderSeparation / 0.30, 0, 1)` | Normalizes to 0–1. 0.30 = max expected separation (full front view). Pure side → shoulders overlap → ~1.0. Pure front → separation ~0.25–0.30 → ~0.0. |
| 5 | Per-metric confidence | Side-dependent: `sagittalConfidence`. Front-dependent: `1 - sagittalConfidence`. View-agnostic: `1.0`. | Simple and honest. Users and LLM see exactly how trustworthy each reading is. |
| 6 | Storage | `sagittal_confidence real` replaces `camera_angle text` in DB. `VideoAnalysisResult.sagittalConfidence: number` replaces `cameraAngle`. Backwards compat: derived getter `>= 0.5 ? 'side' : 'front'` until coaching prompts are fully migrated. | Clean migration path. |
| 7 | UI | Remove `CameraAnglePicker`. Replace with positioning guide: "For best results, film from the side." | Reduces friction. No wrong choice to make. |
| 8 | Depth correction | `value / Math.sqrt(sagittalConfidence)` applied to depth/lean when `sagittalConfidence < 0.8` | Dividing undoes foreshortening (at 45° / confidence ~0.5, raw values are ~30% too small). Floor at 0.1 prevents extreme amplification. Forward lean capped at 90°. |

## Phase 1 — Joint-Angle Rep Detection

Foundation. Everything downstream depends on correct rep boundaries.

**`modules/video-analysis/lib/rep-detector.ts`:**

- [x] Add `extractAngleSignal({ frames, lift }): number[] | null` — returns per-frame joint angle (inverted: `180 - angle` so peaks = rep bottom, matching Y-signal convention):
  - Squat: knee angle (hip-knee-ankle). Standing ≈ 170°, bottom ≈ 70–90°.
  - Deadlift: hip angle (shoulder-hip-knee). Standing ≈ 170°, floor ≈ 70–90°. Hip angle chosen over knee angle because the deadlift is hip-dominant — clearer oscillation signal.
  - Bench: elbow angle (shoulder-elbow-wrist). Lockout ≈ 170°, chest ≈ 50–70°.
  - Uses `computeAngle` primitive from `angle-calculator.ts` inline (no separate `computeElbowAngle` export needed — `computeAngle({ a, b, c })` handles all 3-point angles generically).
  - Averages left + right side when both visible; uses single side when one is occluded.
- [x] Replace `extractSignal` (hip/wrist Y) with `extractAngleSignal` in `detectReps`; old function renamed to `extractYSignal` and kept as fallback
- [x] Invert signal: `180 - angle` so peaks correspond to rep bottoms, matching the Y-coordinate convention. Existing `findPeaks` works unchanged.
- [x] Add `hasUsableRange(signal)`: rejects angle signals with < 5° range (flat = no real reps). Falls back to Y-coordinate in this case.
- [x] Keep existing smoothing and prominence filtering unchanged — adapted thresholds for angle signals (degrees vs normalized units): `zeroThreshold = 1.0` (vs 0.01), `flatThreshold = 2.0` (vs 0.005).
- [x] Fallback: if angle signal returns null (< 3 valid frames) or has insufficient range, fall back to `extractYSignal`
- [x] Tests: existing rep-detector tests still pass. Calibration tests validate on 15 real videos across all angles.

## Phase 2 — Continuous Sagittal Confidence

Replaces binary detection. Can be developed in parallel with Phase 1.

**`modules/video-analysis/lib/detect-camera-angle.ts` → renamed to `view-confidence.ts`:**

- [x] Rename file; update all imports across the module
- [x] `computeSagittalConfidence({ frames }): number` — replaces `detectCameraAngle`:
  - Measure average shoulder X-separation over first 10 frames: `|leftShoulder.x - rightShoulder.x|`
  - Incorporate hip separation as secondary signal: `|leftHip.x - rightHip.x|`
  - Weight: 70% shoulder, 30% hip (shoulders more reliable, hips confirm)
  - Formula: `1 - clamp(weightedAvgSeparation / 0.30, 0, 1)`
  - Return weighted average, clamped to [0, 1]
- [x] `deriveCameraAngle(sagittalConfidence: number): 'side' | 'front'` — backwards compat export: `>= 0.5 ? 'side' : 'front'`
- [x] Tests: pure side → ≈ 1.0, pure front → ≈ 0.0, 45° → ≈ 0.5, one shoulder occluded (falls back to hip signal)

## Phase 3 — Always-Compute Metrics with Confidence

Depends on Phase 2.

**`modules/video-analysis/lib/metrics-assembler.ts`:**

- [x] Replace `detectCameraAngle` call with `computeSagittalConfidence`
- [x] Remove `const isSideView = cameraAngle === 'side'` and all `if (isSideView)` / `if (!isSideView)` conditional blocks
- [x] Always compute: `forwardLeanDeg`, `kneeAngleAtMid`, `maxDepthCm`, `buttWinkDeg`
- [x] Apply perspective correction to depth and lean when `sagittalConfidence < 0.8`:
  - `perspectiveCorrection(value, confidence)`: divides by `Math.sqrt(confidence)` to undo foreshortening (at 45° / confidence ~0.5, values are foreshortened ~30%, so dividing compensates). Clamps confidence floor to 0.1 to avoid extreme amplification.
  - Applied to `maxDepthCm` and `forwardLeanDeg`; lean additionally capped at 90°.
- [x] Set `sagittalConfidence` on the assembled result; remove `cameraAngle` field (keep derived getter only)
- [x] Bump `ANALYSIS_VERSION` to 4

**`modules/video-analysis/lib/fault-detector.ts`:**

- [x] Remove `cameraAngle` parameter from `detectFaults` and `detectSquatFaults`
- [x] Remove `if (isSideView)` gates — always run depth, lean, and `above_parallel` checks
- [x] Add confidence-based severity adjustment: if `sagittalConfidence < 0.5`, downgrade fault severity from `'critical'` to `'warning'`

**`modules/video-analysis/lib/analysis-strategy.ts`:**

- [x] Update `FaultDetector` interface: remove `cameraAngle?`, add `sagittalConfidence: number`

## Phase 4 — Schema and DB Migration

Depends on Phase 3.

**`packages/shared-types/src/video-analysis.schema.ts`:**

- [x] Replace `cameraAngle: z.enum(['side', 'front'])` with `sagittalConfidence: z.number().min(0).max(1)`
- [x] Add deprecated field: `cameraAngle: z.enum(['side', 'front']).optional()` (derived, for backwards compat)

**`modules/video-analysis/model/types.ts`:**

- [x] `SessionVideo.cameraAngle: 'side' | 'front'` → `SessionVideo.sagittalConfidence: number`

**Supabase migration:**

- [x] `ALTER TABLE session_videos ADD COLUMN sagittal_confidence real DEFAULT 0.8;`
- [x] `UPDATE session_videos SET sagittal_confidence = CASE WHEN camera_angle = 'side' THEN 0.9 WHEN camera_angle = 'front' THEN 0.1 ELSE 0.8 END;`
- [x] `ALTER TABLE session_videos DROP COLUMN camera_angle;`

**`modules/video-analysis/data/video.repository.ts`:**

- [x] Update `insertSessionVideo` to accept `sagittalConfidence: number` instead of `cameraAngle`
- [x] Update read queries to return `sagittal_confidence` mapped to `sagittalConfidence`

## Phase 5 — UI Changes

Depends on Phase 4.

- [x] Delete `modules/video-analysis/ui/CameraAnglePicker.tsx`
- [x] Remove all imports and usages of `CameraAnglePicker` across the codebase
- [x] Update `modules/video-analysis/ui/RecordVideoSheet.tsx`:
  - Remove `cameraAngle` prop and angle picker
  - Add positioning guide text: "For best depth analysis, film from the side"
- [x] Update video analysis display screen: show per-metric confidence indicator (e.g. "high confidence" / "moderate" / "low" badge based on `sagittalConfidence` thresholds: ≥ 0.7 = high, 0.4–0.7 = moderate, < 0.4 = low)
- [x] Update `modules/video-analysis/application/assemble-coaching-context.ts`: pass `sagittalConfidence` to the LLM coaching context

## Phase 6 — Coaching Prompt Update

Depends on Phase 5.

**`packages/training-engine/src/coaching/form-coaching-prompt.ts`:**

- [x] Update `FORM_COACHING_SYSTEM_PROMPT` to explain sagittal confidence to the LLM
- [x] Instruct LLM: metrics with `sagittalConfidence < 0.5` should be mentioned cautiously; focus coaching on high-confidence metrics

## Phase 7 — Calibration Test Updates

Depends on Phases 1-3. The calibration test suite (mobile-050) must be updated to validate the new pipeline.

**`modules/video-analysis/lib/__tests__/calibration.test.ts`:**

- [x] Replace `detectCameraAngle` import with `computeSagittalConfidence` from `view-confidence.ts`
- [x] Camera angle assertion replaced with sagittal confidence range: `expect(confidence).toBeGreaterThanOrEqual(min)` / `toBeLessThanOrEqual(max)` per manifest entry
- [x] Remove `if (video.expected.camera_angle === 'side')` guards from metric presence checks — all metrics always present
- [x] Add sagittal confidence assertions per video: side videos → high confidence, 45° videos → moderate, front videos → low
- [x] Update `analysisVersion` assertion from 3 to 4
- [x] Re-run all 15 videos through updated pipeline, verify rep counts, tighten manifest `rep_count` ranges where improved
- [x] Regression suite: update to assert `sagittalConfidence` instead of `camera_angle` string match

**`test-videos/manifest.json`:**

- [x] Replace `expected.camera_angle: 'side' | 'front'` with `expected.sagittal_confidence: { min: number, max: number }`
- [x] Re-extract landmarks if needed (`npm run extract:landmarks`) — landmark data is unchanged but analysis outputs differ
- [x] The 45° angle videos (`squat-45-3reps`, `deadlift-45-6reps`, `bench-45-5reps`) are the critical regression anchors — they exercise exactly the code path this spec fixes

## Sequencing

```
Phase 1 (angle rep detection) ──┐
Phase 2 (sagittal confidence) ──┘ independent, develop in parallel

Phase 3 (always-compute) ── depends on Phase 2
Phase 4 (schema + DB) ──── depends on Phase 3
Phase 5 (UI) ──────────── depends on Phase 4
Phase 6 (coaching) ─────── depends on Phase 5
Phase 7 (calibration tests) ── depends on Phases 1-3, run after each phase to catch regressions
```

## Files Changed

| File | Change |
|------|--------|
| `lib/rep-detector.ts` | Replace Y-coordinate signal with joint angle signal |
| `lib/angle-calculator.ts` | Add `computeElbowAngle` |
| `lib/detect-camera-angle.ts` | Rename to `view-confidence.ts`, replace binary with continuous |
| `lib/metrics-assembler.ts` | Remove if/else gates, always compute all metrics, apply correction factor |
| `lib/fault-detector.ts` | Remove `cameraAngle` param, always detect, confidence-adjusted severity |
| `lib/analysis-strategy.ts` | Update `FaultDetector` interface |
| `lib/__tests__/calibration.test.ts` | Update assertions for sagittal confidence, remove angle gates |
| `packages/shared-types/src/video-analysis.schema.ts` | Replace `cameraAngle` enum with `sagittalConfidence` number |
| `modules/video-analysis/model/types.ts` | Update `SessionVideo` type |
| `modules/video-analysis/data/video.repository.ts` | Update insert/read for new column |
| `test-videos/manifest.json` | Replace `camera_angle` with `sagittal_confidence` ranges |
| `ui/CameraAnglePicker.tsx` | Delete |
| `ui/RecordVideoSheet.tsx` | Remove picker, add positioning guide |
| `application/assemble-coaching-context.ts` | Pass `sagittalConfidence` to LLM context |
| `packages/training-engine/src/coaching/form-coaching-prompt.ts` | Update system prompt |
| Supabase migration | Add `sagittal_confidence`, drop `camera_angle` |

## Enables

- Future PoseRAC v2 model training (joint angle rep detection is the foundation)
- Dual-phone 3D reconstruction (continuous confidence naturally supports multi-view fusion)
- Better coaching quality from any camera angle
