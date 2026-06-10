# Backlog

If you are a human, say to an Agent: **"Read docs/backlog.md and do item N"**

If you are an AI Agent, first read: `docs/README.md` and understand our intent and architecture.

Then always make sure to follow the [AI Workflow](./guide/ai-workflow.md) (orient → design → plan → implement → validate → wrap up).

At the end: update design doc status → Implemented, update specs to match what was actually built, update `docs/features/<feature>/index.md`, then review and add any learnings to `docs/guide/ai-workflow.md`. Once a finished item has a shipped design + spec linking back to it, delete the backlog entry — the spec is the durable record, not this file.

---

## 23

**Back-annotate `@spec` headers across all modules + spec back-links.** Convention + checker shipped 2026-04-19 (see [docs/guide/spec-linking.md](./guide/spec-linking.md) and `tools/scripts/check-spec-links.mjs`).

**2026-04-22: @spec headers shipped across 244 files in 21 modules.** Checker now reports `21/22 modules unlinked → 1/22 unlinked`. Only `updates` remains: it has no feature spec dir (OTA updates was never specced). Write a spec first, then link.

Remaining work:

- ~50 spec files whose ticked tasks have no `→ path:symbol` back-link — do incrementally when features are touched
- Engine code under `packages/training-engine/src/` — same convention, not yet linked
- When spec back-links reach ~100%, flip `npm run check:spec-links` from advisory to `--strict` in `/verify`

**2026-04-24:** `updates` module specced (`docs/features/updates/spec-ota-updates.md`) and `@spec` headers added to all 3 non-trivial files. Checker should now report 0/22 unlinked modules.

## 25

**Mobile pose-detection gets 0 valid frames on videos where dashboard gets reps.** Observed 2026-04-19 on a ~14s squat clip: `[pose] 0/38 valid frames (0%)` from the mobile pipeline; the same video loaded in the dashboard (`apps/dashboard/src/app/VideoOverlayPreview.tsx` → `browser-pose-extractor.ts`) produces real landmarks and rep analysis. Mobile reanalyze completes end-to-end (see #20) but the upstream signal is empty — everything downstream is correct-but-useless.

### Diagnostic landed (2026-04-19)

`extractFramesFromVideo` now emits a structured one-line `__DEV__` log on every analysis:
`[pose] X/Y valid frames (Z%) thumb=WxH (aspect=A) reject=N noResult+T trunc+E err firstValidVis=V`. This separates the four failure modes that previously all collapsed into "valid=0":

- `thumb=WxH` — thumbnail dimensions. If `aspect > 1` on a portrait recording, hypothesis #1 (rotation) is confirmed.
- `noResult` — MediaPipe ran but the pose didn't pass the 0.5 confidence gates. High → model/orientation issue.
- `trunc` — fewer than 33 landmarks returned. Should always be 0; non-zero indicates an upstream API change.
- `err` — `PoseDetectionOnImage` threw. Captured to Sentry already; counter just makes the rate visible alongside the rest.
- `firstValidVis` — mean visibility on the 12 powerlifting-relevant landmarks of the first frame that _did_ detect. If this is < 0.3, the lifter is being detected but at a confidence the plausibility filter will reject downstream.

### Next step (waiting on device run)

Reanalyze the failing 14s squat clip with the new diagnostic, then act per branch:

Five concrete divergences between the two extraction paths, ranked by suspected impact:

1. **Thumbnail orientation** — `expo-video-thumbnails.getThumbnailAsync` may emit a thumbnail that ignores the video's rotation metadata, so portrait recordings land sideways and MediaPipe can't find a pose. Dashboard reads the `<video>` element which honours rotation via the decoder. Test: save one of the thumbnails mobile hands to MediaPipe and `adb pull` it.
2. **fps**: mobile 4 vs dashboard 30 (default). 7.5× fewer detection chances — any clip where pose is only visible in a subset of frames loses coverage.
3. **Model size**: mobile pinned to `pose_landmarker_lite.task` (5.6MB) due to device memory limits; dashboard lets you pick full (9MB) or heavy (29MB). Lite is much more brittle on oblique angles / partial occlusions.
4. **Running mode**: mobile uses MediaPipe `IMAGE` per-frame; dashboard uses `VIDEO` with temporal tracking, which recovers flaky frames via continuity.
5. **Delegate**: mobile forced to CPU (GPU SIGSEGVs on Android MediaPipe's GL runner); dashboard defaults GPU. Shouldn't affect accuracy, only speed — but worth excluding.

Direction: start with (1). If `adb pull`-ed thumbnails are rotated wrong, pipe them through `expo-image-manipulator.rotate` (or bypass thumbnails entirely — `react-native-mediapipe` has a video-file extractor that skips the thumbnail step). Then revisit fps: 8fps is probably safe; 15fps on a 15s clip is 225 frames, likely fine with lite model. Validate: the same squat clip that currently returns `0/38 valid` must return ≥80% valid frames and non-zero reps. Write a device-side log harness or add a "debug landmarks pull" dashboard action for easy A/B.

### Follow-up implementation paths (gated on diagnostic)

1. **If `thumb=` aspect is wrong** (most likely): native fix needed. `expo-video-thumbnails` calls Android's `MediaMetadataRetriever.getFrameAtTime()` which returns frames in the encoded orientation, not the displayed orientation — vendor-dependent across devices. Two options:
   - Patch `expo-video-thumbnails` (or fork) to read `METADATA_KEY_VIDEO_ROTATION` and rotate the bitmap before writing the JPEG.
   - Add a tiny native helper exposing rotation to JS, then add `expo-image-manipulator` (new dep, requires fresh dev build) and rotate each thumbnail in the loop. More invasive but doesn't touch a third-party module.
2. **If `noResult` is high but `thumb=` aspect looks right**: bump `targetFps` cautiously (4 → 6, then re-check 60-frame stability ceiling). Consider per-clip switch to `pose_landmarker_full.task` for confirmed-failed clips, gated on memory headroom.
3. **If `firstValidVis < 0.3` consistently**: detection is happening but at very low confidence — likely lighting / framing. Lower the per-frame confidence floor in the assembler instead of changing extraction.

`react-native-mediapipe` does **not** expose a video-file extractor (only `PoseDetectionOnImage` for paths and `usePoseDetection` for live camera frames) — original backlog mention was optimistic. Path-based extraction stays.

---

# 2026-05 review follow-ups

Items 26–50 below all came out of the 2026-05 /review pass. Most have a `## Open Issues (2026-05 review)` checkbox in a spec doc still marked `[ ]` — that's the durable tracking. See [guide/migration-pattern.md](./guide/migration-pattern.md) for the migration-bundled ones.

## 26

**`personal_records.value` grams migration.** Companion to `weight_kg → weight_grams` already shipped. The `value` column still holds kg as `numeric` for `pr_type IN ('estimated_1rm','volume')` — violates the integer-grams invariant. Use the same cast-as-bridge pattern documented in [guide/migration-pattern.md](./guide/migration-pattern.md). Tracking: [`achievements/spec-pr-detection.md`](./features/achievements/spec-pr-detection.md) Open Issues block.

## 27

**Per-session `adjustment_applied` lookup helper.** The soreness screen's "Regenerate prescription?" confirm currently uses `jit_generated_at` + `affected_lifts` overlap as a proxy — over-prompts for sessions that weren't actually adjusted. Build a `wasAdjustedByDisruption(sessionId)` repo helper that joins `disruptions.session_ids_affected` per session, expose from `@modules/disruptions`, swap into the soreness confirm. Spec doc: [`soreness-and-readiness/spec-soreness-screen.md`](./features/soreness-and-readiness/spec-soreness-screen.md).

## 28

**CI typecheck enforcement audit.** With the baseline now at 0 errors across `parakeet` + `training-engine`, this is the moment to make "any new error fails CI" durable. Confirm `.github/workflows/` (or whatever CI surface) runs `nx affected --target=typecheck` on PRs and fails the build on any error. If it doesn't, wire it up. Small change, large protective value.

## 29

**`MIN_SESSIONS_FOR_REVIEW` floor in `useEndProgram`.** A user abandoning a scheduled program at 10% currently triggers a thin LLM review at full cost. Either gate `triggerCycleReview` on terminal-session-count ≥ floor (suggest 5), or surface the trade-off in the End Program confirm: "No review will be generated — end at 100% for one." Inline TODO already in [`apps/parakeet/src/modules/program/hooks/useEndProgram.ts`](../apps/parakeet/src/modules/program/hooks/useEndProgram.ts).

## 30

**Expose `reported_at` on the active-disruption query** + tighten the ongoing-disruption prompt trigger. Today the prompt fires for any open-ended disruption; should fire only when `(today - reported_at) > DISRUPTION_SHELF_LIFE_DAYS[type]`. Add `reported_at` to the select in `fetchActiveDisruptions`, expose on `ActiveDisruption` type, gate the filter in `today.tsx`. TODO in [`app/(tabs)/today.tsx`](<../apps/parakeet/src/app/(tabs)/today.tsx>) marks the site.

## 31

**Extract `resolveReadiness` from `soreness.tsx`.** Three callers now (auto-generate, manual generate, disruption-overwrite confirm) — the case strengthened after the 2026-05 review. Move ~40 lines of inline reconciliation logic to `modules/jit/application/resolveReadiness.ts` as a pure function with unit tests, then collapse the screen call sites to one-liners. TODO comment already in [`soreness.tsx`](<../apps/parakeet/src/app/(tabs)/session/soreness.tsx>) pointing at the future home.

## 32

**`session_logs` plan-revision tracking after mid-cycle rep reduction.** If a user reports moderate illness on an `in_progress` session, `applyDisruptionAdjustment` rewrites `planned_sets` but the existing `session_log` still references the pre-revision plan — completion stats misclassify. Decide: refuse to apply disruptions to `in_progress` sessions, OR add a `plan_revision` marker on `session_logs` and update `classifyPerformance` to compare against the right plan. Spec: [`disruptions/spec-apply.md`](./features/disruptions/spec-apply.md) Open Issues.

## 33

**Session-log route JSON parse alert.** `app/(tabs)/session/[sessionId].tsx` bootstrap should surface `Alert.alert('Session data corrupted', ...)` + `captureException` before navigating back when `effectiveJitData` fails to parse. Currently silent. Spec: [`session/spec-logging.md`](./features/session/spec-logging.md).

## 34

**Distinguish motivational-message lookup failures from LLM failures.** `motivational-message.service.ts` wraps the existing-message DB lookup in try/catch but silently falls through to fresh LLM generation on error — duplicates a generation for a cached message. Surface a "couldn't load" path instead so we don't burn LLM cost re-deriving. Spec: [`session/spec-motivational.md`](./features/session/spec-motivational.md).

## 35

**Decide `suggestProgramAdjustments` fate.** The engine function has tests + `DEFAULT_THRESHOLDS_FEMALE` exists, but the app-side DB write into `performance_metrics` is never read by any screen — dead path. Either wire into a weekly-review job that surfaces in the formula editor (medium), or delete the `performance_metrics` insert in `session.service.ts` and keep the engine fn for future use (small). Spec: [`core-engine/spec-performance-adjuster.md`](./features/core-engine/spec-performance-adjuster.md).

## 36

**Disruption rationale from type/severity, not raw description.** Engine's `applyDisruptionAdjustment` step currently appends user-typed description as rationale, so "ow" becomes "ow — main lift skipped." Build from `${disruption_type} (${severity})`; append description only when `description.length > 8`. Spec: [`disruptions/spec-apply.md`](./features/disruptions/spec-apply.md).

## 37

**Fix `@spec` tag in `modules/settings/lib/warmup-config.ts:1`** — points at the wrong spec (`settings-and-tools/spec-bar-weight.md` instead of `warmup/spec-config.md`). Trivial. Spec: [`warmup/spec-config.md`](./features/warmup/spec-config.md).

## 38

**Verify `LiftHistorySheet` empty-state copy.** When `data?.entries?.length === 0`, the sheet should render "No history yet" instead of empty space. Check the component, add the empty state if missing. Spec: [`session/spec-logging.md`](./features/session/spec-logging.md).

## 39

**Resolve session ↔ program circular dep.** `useRetryProgramGeneration.ts` inlines `SESSION_QUERY_KEY = ['session']` with a `SYNC` comment to dodge a circular import. Move shared query keys to `platform/query/` or accept the duplication formally with a top-of-file note that survives `sessionQueries.all()` shape changes.

## 40

**Consolidate the 4 duplicate `captureException.ts` utilities.** `modules/{cycle-review,program,session}/utils/captureException.ts` all wrap the authoritative `platform/utils/captureException.ts`. Drop the wrappers, import platform directly. Single sweep across ~30-40 call sites.

## 41

**Add `AbortSignal.timeout(120_000)` to `generateCycleReview`'s `generateObject` call.** Without a timeout, a stalled LLM call hangs indefinitely and the pending cycle-review row stays `pending` forever. Pre-existing item in [`cycle-review/spec-generator.md`](./features/cycle-review/spec-generator.md). Pairs naturally with #42.

## 42

**Defer cycle-review trigger to 100% completion (not 80%).** Current 80% gate excludes the last week + deload from the review payload. Either move the gate to `terminal/total === 1.0`, or allow one regeneration when the program hits 100% and overwrite if meaningfully different. Pre-existing item in [`cycle-review/spec-generator.md`](./features/cycle-review/spec-generator.md).

## 43

**Populate bodyweight + Wilks in `PreviousCycleSummary`.** `getPreviousCycleSummaries` currently calls `extractSummary(report, review, cycleNumber, 0, 0, 0)` — hardcodes `bodyWeightStartKg`, `bodyWeightEndKg`, `wilksScore` to zero, making multi-cycle LLM context useless for tracking strength progression. Pull real values from `bodyweight_entries` + `lifter_maxes`. Pre-existing in [`cycle-review/spec-generator.md`](./features/cycle-review/spec-generator.md).

## 44

**Onboarding sex-change should re-estimate persisted 1RMs.** When a user transitions `biological_sex` from undefined to a known value during onboarding, re-run `estimateOneRmKgFromProfile` on `lifter_maxes` rows where `source = 'estimated'` and update. Otherwise the male-default estimate persists despite the user being female. Spec: [`core-engine/spec-1rm.md`](./features/core-engine/spec-1rm.md).

## 45

**Add `NOVICE_SCALE = 0.6` reference in `docs/domain/`.** Heuristic lives in `modules/jit/lib/max-estimation.ts` but isn't referenced from any domain doc. One-liner in [`docs/domain/performance-analysis.md`](./domain/performance-analysis.md) (or `exercise-catalog.md`) so audits trace home.

## 46

**Unit test for `models.ts` 401-refresh-and-retry path.** Reviewer's optional polish item from commit 8. Mock proxy returns 401, `refreshAuthToken` resolves, second call returns 200 → assert exactly one retry happened. Cheap insurance against regression in the refresh-then-retry path.

## 47

**Invariant test that `unprogrammed_event` returns `[]` from `suggestDisruptionAdjustment`.** Today the engine returns no suggestions for this type, and the review screen's `handleApply` path is unreachable. If a future contributor returns suggestions for unprogrammed_event, the Apply button silently drops them. Lock the contract with a test. Spec: [`disruptions/spec-unprogrammed.md`](./features/disruptions/spec-unprogrammed.md).

## 48

**CSV import + change-days: write specs or archive designs.** `settings-and-tools/index.md` references design docs (`design-csv-import.md`, `design-change-days.md`) without matching specs. Either write `spec-csv-import.md` + `spec-change-days.md` (medium), or move both design docs to `docs/features/_archive/` if the work is no longer planned (trivial).

## 49

**EMG-weights spec: confirm-or-defer.** [`volume/index.md`](./features/volume/index.md) flags `spec-emg-weights.md` as `planned` with no GH issue and no code references in `modules/training-volume/`. Decide: link a tracking issue OR flip the spec to `deferred` and promote the feature status to `implemented`.

## 50

**Test-coverage initiative — application services + video-analysis lib + pure utils.** Multi-session effort, treat as its own program:

- **18 application services without sibling tests** (top targets by size): `program.service` (284L), `disruption.service` (252L), `achievement.service` (214L), `motivational-message.service` (185L), `video-analysis/application/{analyze-frames,analyze-video,assemble-coaching-context,reanalyze}` (139–171L each), `set-persistence.service` (149L), `wearable/application/{sync,recovery,baseline}.service`.
- **30+ untested `modules/video-analysis/lib/*.ts`** pure-math files: `angle-calculator`, `bar-velocity`, `butt-wink-detector`, `competition-grader`, `depth-detector`, `rep-detector`, `bar-path`, `bar-tilt`, etc. Highest-leverage gap in the repo — pure functions with deterministic inputs.
- **Pure `utils/*` without tests**: `modules/session/utils/{buildIntensityLabel,buildRpeContextLabel,groupAuxSetsByExercise,selectPostRestWeight,validateSet,volume-recovery-check,weight-autoregulation-check}`; `modules/training-volume/utils/volume-thresholds`; `modules/gym-partners/lib/{partner-state-machine,qr-payload}`.

Recommend tackling video-analysis lib first — pure functions, ideal test surface, zero coverage today. Then largest application services. Pure utils last (smallest leverage, simplest to land).
