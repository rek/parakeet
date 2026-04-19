# Spec — Lift-Label Sanity Check

**Status:** Implemented (2026-04-19)
**Primary code:** `modules/video-analysis/lib/detect-lift.ts`, `modules/video-analysis/lib/check-lift-mismatch.ts`, `modules/video-analysis/hooks/useVideoAnalysis.ts`, `modules/video-analysis/application/reanalyze.ts`
**Backlog:** #21

## Why this exists

If the user taps the wrong lift when adding a video (bench recorded but squat button pressed), the analysis pipeline happily produces nonsense metrics against the wrong reference frame. The existing pipeline has no sanity check — the declared lift is trusted blindly, and the first sign of the mistake is the user staring at a rep table with zero reps or garbage fault badges.

This spec covers a cheap pose-based classifier that catches the bench-as-squat style mistake before analysis runs. It never blocks analysis — on a confident mismatch it surfaces an Alert that lets the user fix the label or proceed anyway.

Out of scope: OHP (backlog #9), non-competition lifts, form judgement. The classifier only decides which of the three SBD lifts is happening, or abstains.

## Feature

Single one-dimensional signal — the vertical offset of wrist midpoint from shoulder midpoint, normalised by torso length so it's scale-invariant:

```
wrs = (wristMidY - shoulderMidY) / torsoLength
```

where `torsoLength = hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y)`. MediaPipe reports Y increasing downward, so `wrs > 0` means wrists are below shoulders in image space, `wrs < 0` means above.

The lifts sit in three different bands because the bar lives in three different places:

| Lift | Bar | wrs signature |
| --- | --- | --- |
| Squat | Traps | near zero (wrists on the bar, bar on shoulders) |
| Bench | Pressed up | negative (wrists above shoulders throughout the rep) |
| Deadlift | Floor → hip | large positive at floor, moderate positive at lockout |

We summarise the per-frame signal with two percentiles over the visible frames:

- `wrsP90` — 90th percentile. For deadlift, this captures the floor position where wrists are maximally below shoulders. For bench, even this is still ≤ 0 (lifter never drops wrists past shoulder line).
- `wrsMedian` — robustifies the "mostly bent over" signal for side-view deadlifts where the 90th percentile is dominated by lockout frames (close to squat's zero band).

Min / max are explicitly avoided — a single misdetected wrist drags either extreme by ±2 torso-lengths.

## Decision tree

```
if framesUsed < MIN_FRAMES (8):
    return abstain

if wrsP90 ≤ -0.1:
    return bench

if wrsP90 ≥ 1.0  or  wrsMedian ≥ 0.4:
    return deadlift

return squat
```

## Confidence

Every branch computes a `strength` that is 0 exactly on the decision boundary and 1 when the signal is unambiguously in-class. A shared `boundaryConfidence(strength, framesFactor)` then maps strength into the `[0.5, 1.0]` range, multiplied by `framesFactor = min(1, framesUsed / 20)` so short clips never land in the confident band.

| Branch | `strength` |
| --- | --- |
| Bench | `(BENCH_MAX_WRS_P90 − wrsP90) / 0.9` (saturates at 1 when wrsP90 ≈ −1) |
| Deadlift | `max((wrsP90 − 0.3) / 1.5, (wrsMedian − 0.2) / 0.5)` |
| Squat | `1 − abs(wrsMedian) × 3` (1 when median=0, 0 when `|median| ≥ 1/3`) |

`WARN_CONFIDENCE = 0.75` — the UX only prompts on a mismatch when the classifier clears this threshold. Lower-confidence predictions are still available for telemetry (breadcrumbs, Sentry) but silent.

### Why the `FLOOR = 0.5`

A prediction at the decision boundary is a coin flip, so its confidence should not exceed 0.5. The ramp from 0.5 → 1.0 reflects growing evidence; below 0.5 would mean "less likely than random," which we express as `lift: null` + `confidence: 0` rather than a negative-confidence prediction.

## Validation fixtures

Eval set lives in `test-videos/manifest.json`. The 16 calibrated fixtures cover the views we support:

| Lift | Fixtures |
| --- | --- |
| Squat | `squat-side`, `squat-45-3reps`, `squat-45-3reps-2`, `squat-45-5reps`, `squat-back-7reps` |
| Bench | `bench-45-5reps`, `bench-front-4reps` |
| Deadlift | `deadlift-side-*`, `deadlift-front-*`, `deadlift-45-6reps`, `dl-2-reps-side` |

Two fixtures (`squat-side`, `deadlift-side-5reps`) have zero usable frames after the visibility filter — they exercise the abstention path. Two more (`squat-45-3reps-2` with 14 usable frames and heavy landmark noise; `bench-45-5reps` sitting on the bench/squat boundary) exercise the low-confidence silent-abstention path.

## Invariants (enforced by tests)

1. **Never confidently wrong**: for every fixture, the classifier returns the correct lift, or `null`, or a wrong prediction with `confidence < WARN_CONFIDENCE`. A confidently-wrong prediction fires the user-facing warning and undermines trust — it's the one failure mode we treat as a test regression.
2. **Coverage**: at least 2 fixtures per lift category clear `WARN_CONFIDENCE`. Without this, a regression that silently drops confidence to 0 would pass the "never wrong" invariant trivially — no predictions, no wrong predictions.
3. **Adversarial abstention**: a bench clip trimmed to chest-touch frames only (no lockout frames) must abstain or return low confidence. A clip where most frames lack usable landmarks must return `lift: null`.

## Known weaknesses

- **Stationary standing video** (no lift happening, arms dangling): structurally identical to a deadlift lockout by this feature alone — wrists at hip level, below shoulders. The classifier returns `deadlift` with high confidence. Not fixable with pose alone; requires either a motion-variance check or, upstream, a lift-vs-rest gate. Not a priority today because users don't upload non-lifts intentionally.
- **Paused bench with camera cut at chest**: wrists never lift above shoulders during the clip. Classifier lands on the bench/squat boundary. By design, confidence stays below warn threshold → silent miss rather than false positive.
- **Low-bar squat with wide grip / dropped elbows in a 45° view**: wrs median can creep toward 0.4 and trigger the deadlift branch. Confidence lands below warn threshold per the fixture evidence, so the mismatch prompt stays silent, but this is a known edge case to revisit if we add a "strongly labelled" hint to high-stakes views.

## Out of scope

- **OHP**: will add when backlog #9 lands — OHP wrist-above-shoulders signature is nearly identical to bench, so the classifier needs a second discriminator (torso verticality).
- **Pin squats, rack pulls, block pulls, deficits**: partial-ROM variants. The classifier labels them by the strongest signal they still produce — rack pulls stay in the deadlift band because wrs_p90 still exceeds 0.4 at setup; pin squats stay in the squat band. Fine.
- **Dumbbell / machine lifts**: not in the SBD set; the classifier may still return one of the three, but the caller will never ask about them.

## Wiring (shipped 2026-04-19)

1. `lib/check-lift-mismatch.ts` wraps `detectLift` with the mismatch-decision rules (declared lift is supported; classifier is confident; detected ≠ declared) and returns `LiftMismatch | null`. Pure; 4 unit tests.
   → `apps/parakeet/src/modules/video-analysis/lib/check-lift-mismatch.ts:checkLiftMismatch`
2. `hooks/useVideoAnalysis.ts` runs `checkLiftMismatch` after `extractFramesFromVideo` inside `processVideo`. The mismatch is stashed in a local variable until after the video row has been saved to the DB, then a non-blocking `Alert.alert` surfaces with the message *"This looks like a <detected> — you labelled it <declared>. Form coaching will be wrong if the label is off."* Two buttons: `OK, will fix` (acknowledge) and `Continue anyway` (dismiss). Neither button mutates state — the user still deletes and re-records manually to correct the label, which matches the existing error-handling pattern in the app. Fires `addBreadcrumb('lift-label-mismatch', 'detected', { detected, declared, confidence })` for telemetry.
   → `apps/parakeet/src/modules/video-analysis/hooks/useVideoAnalysis.ts:processVideo` + `showLiftMismatchAlert`
3. `application/reanalyze.ts` also runs the check and exposes an optional `onLiftMismatch?: (mismatch) => void` dep so the hook's `reanalyze` can wire the same Alert. Emits a `lift-label-mismatch` breadcrumb via `onBreadcrumb` on detection.
   → `apps/parakeet/src/modules/video-analysis/application/reanalyze.ts:reanalyzeSessionVideo`
4. Analysis always runs regardless of the detection result — the warning is a nudge, not a gate.

### Deliberate deviations from the backlog sketch

- Alert copy uses *OK, will fix* / *Continue anyway* instead of *Continue as X* / *Change to Y*. A one-tap lift swap would need to re-run `analyzeVideoFrames` with the new reference frame, update `session_videos.lift` + set linkage, and (in `reanalyze`) also purge the previous coaching response. That's a larger surface; user feedback (`feedback_completeness.md`) says to keep scope tight and file follow-ups rather than half-ship a hidden flow. Today: the user acknowledges, deletes, and re-records — matching how every other correction in the app works. A future task can add in-place relabeling once the rest of the session-video lifecycle supports it.
- Declared-lift filter: only the three SBD lifts trigger the warning. OHP / rows / machine work never prompt, even though the classifier would happily say `bench` for an overhead press. Prevents false positives on lifts we're not equipped to analyse.
