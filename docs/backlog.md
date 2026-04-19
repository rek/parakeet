# Backlog

If you are a human, say to an Agent: **"Read docs/backlog.md and do item N"**

If you are an AI Agent, first read: `docs/README.md` and understand our intent and architecture.

Then always make sure to follow the [AI Workflow](./guide/ai-workflow.md) (orient → design → plan → implement → validate → wrap up).

At the end: update design doc status → Implemented, update specs to match what was actually built, update `docs/features/<feature>/index.md`, then review and add any learnings to `docs/guide/ai-workflow.md`.

---

## 22

**Mobile pose-detection gets 0 valid frames on videos where dashboard gets reps.** Observed 2026-04-19 on a ~14s squat clip: `[pose] 0/38 valid frames (0%)` from the mobile pipeline; the same video loaded in the dashboard (`apps/dashboard/src/app/VideoOverlayPreview.tsx` → `browser-pose-extractor.ts`) produces real landmarks and rep analysis. Mobile reanalyze completes end-to-end (see #20) but the upstream signal is empty — everything downstream is correct-but-useless.

Five concrete divergences between the two extraction paths, ranked by suspected impact:

1. **Thumbnail orientation** — `expo-video-thumbnails.getThumbnailAsync` may emit a thumbnail that ignores the video's rotation metadata, so portrait recordings land sideways and MediaPipe can't find a pose. Dashboard reads the `<video>` element which honours rotation via the decoder. Test: save one of the thumbnails mobile hands to MediaPipe and `adb pull` it.
2. **fps**: mobile 4 vs dashboard 30 (default). 7.5× fewer detection chances — any clip where pose is only visible in a subset of frames loses coverage.
3. **Model size**: mobile pinned to `pose_landmarker_lite.task` (5.6MB) due to device memory limits; dashboard lets you pick full (9MB) or heavy (29MB). Lite is much more brittle on oblique angles / partial occlusions.
4. **Running mode**: mobile uses MediaPipe `IMAGE` per-frame; dashboard uses `VIDEO` with temporal tracking, which recovers flaky frames via continuity.
5. **Delegate**: mobile forced to CPU (GPU SIGSEGVs on Android MediaPipe's GL runner); dashboard defaults GPU. Shouldn't affect accuracy, only speed — but worth excluding.

Direction: start with (1). If `adb pull`-ed thumbnails are rotated wrong, pipe them through `expo-image-manipulator.rotate` (or bypass thumbnails entirely — `react-native-mediapipe` has a video-file extractor that skips the thumbnail step). Then revisit fps: 8fps is probably safe; 15fps on a 15s clip is 225 frames, likely fine with lite model. Validate: the same squat clip that currently returns `0/38 valid` must return ≥80% valid frames and non-zero reps. Write a device-side log harness or add a "debug landmarks pull" dashboard action for easy A/B.

## 21

**Lift-label sanity check from pose data.** Catch the "recorded a bench, tapped squat" mistake before it lands as a garbage analysis. Cheap because we already run MediaPipe — no new pipeline, just a post-extract classifier over the existing `PoseFrame[]`.

Two features separate the three lifts cleanly:
- **Torso angle** (shoulder→hip vector vs vertical): bench ~90°, squat/deadlift <30°
- **Wrist vertical Y-range** across the clip: deadlift large (floor→hip), squat tiny (bar on traps), bench small at chest level

Decision tree on those two, confidence from distance to nearest class centroid. Run in `application/analyze-video.ts` (or a new `lib/detect-lift.ts`) right after extract, before `analyzeVideoFrames`. If the classifier's lift ≠ user-declared lift with confidence ≥ 0.7, surface an Alert: *"This looks like a bench — fix the label?"* with Fix / Continue anyway buttons. Analysis still runs regardless so nothing blocks.

Risk: heavy-arch bench, box squats, high-bar vs low-bar squats — tune threshold + fixtures from `test-videos/landmarks/` (all 16 already labelled correctly in `manifest.json`, so we have a ready-made eval set). Validate: all 16 fixtures classify correctly; synthetic "mislabel" test (feed bench landmarks, claim it's a squat) must warn.

## ~~2~~ (Done — 13 Mar 2026)

Fixed: unending lift rotation now uses history-based selection (last completed lift → next in rotation) instead of counter-based derivation. See [design doc](features/programs/design-unending.md#lift-rotation--history-based-updated-13-mar-2026).

## ~~1~~ (Done — 13 Mar 2026)

All exercises already existed in the catalog (Row Machine, Ski Erg, Run - Treadmill, Run - Outside, Toes to Bar, Plank). Fixed timed exercise logging UX: "Round N + duration (min)" input instead of "Complete / as prescribed"; RPE picker and rest timer suppressed for timed exercises. Users can add any of these via Settings › Auxiliary Exercises → General filter.

## ~~15~~ (Done — 5 Apr 2026)

Video view angle rework: replaced binary side/front camera angle with continuous sagittal confidence (0–1). Joint-angle rep detection (viewpoint-invariant), always-compute metrics with confidence weighting, removed CameraAnglePicker. See [spec](features/video-analysis/spec-view-angle.md) and [design doc](features/video-analysis/design-form-analysis.md).

## ~~16~~ (Done — 18 Apr 2026, pending column-drop coordination)

**Set durability — prevent data loss when End is not tapped.** Real incident 2026-04-15: user logged a full bench session, forgot to tap End, sets vanished when reconciliation flipped the session to `skipped`. Root cause: sets only persist to server in a batch on End.

Shipped: append-only `set_logs` with first-set trigger, per-set dual-write via `useSetPersistence` subscriber, offline queue with slot-key dedupe, server-side auto-finalise of stale in-progress sessions with Sentry breadcrumb, flush-on-clobber in session screen, pathological-case recovery hook + Alert. All readers cut over to set_logs.

**Still pending**: coordinated DB/client deploy to drop `session_logs.actual_sets` / `auxiliary_sets` JSONB columns. Sequence documented at [`tools/scripts/pending-drop-session-logs-jsonb.md`](tools/scripts/pending-drop-session-logs-jsonb.md).

See [design doc](features/session/design-durability.md), [spec-set-persistence](features/session/spec-set-persistence.md), [spec-auto-finalize](features/session/spec-auto-finalize.md).

## ~~20~~ (Done — 19 Apr 2026)

Reanalyze made testable + observable. Orchestration extracted to `modules/video-analysis/application/reanalyze.ts` (pure, dep-injected); hook is a thin RN wrapper. Local Node repro against local Supabase confirmed the DB write path works end-to-end; integration vitest at `application/__tests__/reanalyze.test.ts` exercises auth → RLS UPDATE → round-trip with a real landmark fixture so the next regression lands with a failing test, not a prod report. Blocking diagnostic alerts (from commit `ee01490`) removed in favour of Sentry breadcrumbs (`addBreadcrumb('reanalyze', step, data)`) plus an explicit success Alert (`Re-analyze complete — Detected N reps (was M)`) so the user can no longer confuse "silent no-op" with "worked but yielded 0 reps".

Ruled out along the way: (a) PostgREST `.update().eq().select('*').single()` silently swallowing an RLS-filtered 0-row update — verified it throws `PGRST116` on the no-rows path; (b) analyzeVideoFrames producing stale output — fixture `dl-2-reps-side` yields 2 reps + `fatigueSignatures` on the current detector, matching the DB round-trip.

### Repro notes (kept for future agents)

**Video re-analyze silently does nothing — debug with a dev build, not prod OTAs.**

Symptom: In prod, on the video-analysis screen, tapping the new "Re-analyze" button appears to run to completion (no error, UI behaves normally) but the `session_videos` row in prod Postgres is never updated. The displayed analysis (0 reps) stays the same after tapping. Verified twice by querying prod DB directly (`SUPABASE_ACCESS_TOKEN` is set — see `npx supabase db query --linked`).

### Lesson for the next agent — do not debug this from prod

Earlier agent burned multiple production OTA cycles guessing at causes. That is the wrong loop. Use one of:

- **Dev build on device**: `npx nx run parakeet:run-android` (Metro over USB, live reload, `adb logcat *:S ReactNativeJS:V` shows console output). The `.env.local` points at a *local* Supabase by default — either temporarily repoint it at prod by swapping in `.env.production` values, or seed the bug row into local Supabase.
- **Node reproduction**: the analysis half runs outside React via `scripts/calibrate-videos.ts` already. Extending it to also exercise `updateSessionVideoAnalysis` against prod is ~50 lines — no phone needed. This is the fastest loop to isolate whether the bug is in frame extraction, analyzeVideoFrames, or the DB write.

Only touch prod OTAs to ship the fix, not to probe it.

### Repro setup

- **Video row**: id `f13fc174-f40a-4fd7-85b4-a303a50a4845`, user_id `dfcc71c4-b16a-4fbb-af5b-8235c6a10861`, session `af2213b7-f379-4289-aac2-d518ace7c724`, lift `deadlift`, set 2.
- **Actual analysis in DB** (old, unchanged despite re-analyze): `{"fps":4,"reps":[],"cameraAngle":"side","analysisVersion":4,"sagittalConfidence":0.8}` — note the missing `fatigueSignatures` key, which is load-bearing for the diagnosis: current `metrics-assembler.ts` always emits that key, so if reanalyze had actually written, the shape would differ.
- **Local .mp4 on the user's phone**: `/data/user/0/com.adam.tombleson.parakeet/files/videos/video_af2213b7-...deadlift_set2_1776424436927.mp4` — not in Supabase Storage (the remote_uri points at a 0-byte object from the earlier upload bug, see backlog #17). The video is 12.76s, 30fps, 383 frames, real rep count = 2.
- **Same video as a calibration fixture**: `test-videos/dl-2-reps-side.mp4` + `test-videos/landmarks/dl-2-reps-side.landmarks.json` (49/52 valid frames at 4fps). `npx tsx scripts/calibrate-videos.ts --video dl-2-reps-side` correctly detects 2 reps, proving the detector itself is fine. The bug is in the **reanalyze plumbing**, not the detector.

### What was already built

The re-analyze feature was added in commits `9d74aa1` → `ee01490`:

- `apps/parakeet/src/modules/video-analysis/hooks/useVideoAnalysis.ts` — new `reanalyze` callback. Reads `result.localUri`, probes duration via `react-native-compressor.getVideoMetaData`, runs `extractFramesFromVideo` + `analyzeVideoFrames`, calls `updateSessionVideoAnalysis({ id, analysis })`, updates React Query cache.
- `apps/parakeet/src/app/(tabs)/session/video-analysis.tsx` — "Re-analyze" button wired to `reanalyze`.
- `apps/parakeet/src/modules/video-analysis/data/video.repository.ts` — `updateSessionVideoAnalysis` does `update(...).eq('id', id).select('*').single()` and throws on error.

Commit `ee01490` added blocking `Alert.alert(...)` diagnostic checkpoints at each step of `reanalyze` — file-check, post-extraction, post-DB-update, and error paths. **That OTA was published but the user has not reported back which alerts appear**, so the flow's failure point is still unknown. First action for the next agent: either get the user to tap Re-analyze on the latest bundle and report the last alert they see, or reproduce in dev.

### Hypotheses worth checking (un-eliminated)

1. **React Native's `Alert.alert` from a background async continuation may no-op when the app is backgrounded or the scroll container unmounts the button.** If the user was expecting alerts but none fired, this is plausible — though blocking promise-wrapped alerts should still fire on the next UI tick.
2. **`updateSessionVideoAnalysis` silently returns zero rows.** `.select('*').single()` should throw `PGRST116` when zero rows match, but an edge case (RLS silently filtering with a non-error path) could swallow this. RLS policy on update is `auth.uid() = user_id`. Row's `user_id` = `dfcc71c4-...`. If the user's session token doesn't carry that uid (session expired, re-logged in as someone else, anon key bug), the update touches 0 rows. Verify by logging `(await typedSupabase.auth.getUser()).data.user?.id` inside reanalyze and comparing against row's `user_id`.
3. **`analyzeVideoFrames` returns a truthy object with `reps: []`** — my `if (!analysis) throw` only checks nullishness, so an empty-reps result would proceed to `updateSessionVideoAnalysis`. The DB should still show a NEW analysis JSON (with `fatigueSignatures` key), which it doesn't — so reanalyze isn't reaching the update call at all, OR it's reaching it and the update silently touches zero rows.
4. **`File.exists` on `expo-file-system` misbehaves on a URL written by an older build.** The `localUri` was written by pre-fix pipeline code. If `new File(normalizeVideoUri(localUri)).exists` returns false in prod (even though the file is actually there), reanalyze throws "Local video file missing" early — but the diagnostic OTA would have surfaced that via Alert. Worth reverifying once the user reports.
5. **Hook closure staleness.** `useCallback` deps are `[result, lift, queryClient, queryOpts.queryKey]`. `queryOpts` is a fresh object every render (from `videoQueries.forSessionLiftSet(...)`), so `queryOpts.queryKey` may be a new reference each render and the callback rebuilds constantly — but that makes it *fresher*, not staler, so this is unlikely.

### Adjacent state worth knowing

- Two other detector/upload fixes shipped in the same sprint: `3f26558` (real video duration probe) and `0bb3f0d` (0-byte Storage upload root cause). Neither should interact with reanalyze beyond the shared hook.
- The screen file was modified out-of-band to pass `analysis`, `videoWidthPx`, `videoHeightPx`, `recordedByName` to `VideoPlayerCard` as part of backlog #19 (playback overlay). Harmless to reanalyze but noted.
- Memory pointers: `gotcha_eas_update_environment.md`, `gotcha_expo_file_system_blob.md`, `feedback_android_only.md`.

### Definition of done

- Tapping Re-analyze on a prod row with 0 reps (or stale analysis) triggers a new analysis, writes it to `session_videos.analysis`, and the UI reflects the updated rep count without re-navigation.
- Diagnostic `Alert.alert` calls added in `ee01490` are removed before final OTA.
- Add a Vitest or Node-side test that exercises the reanalyze path end-to-end (or at least the non-React pieces — `updateSessionVideoAnalysis` + the analyze pipeline) so the next regression gets caught without a device.

## 19

**Video playback overlay — bar path + skeleton on top of `<VideoView>`.** Today the bar path is a standalone SVG card next to the video; the skeleton is only drawn over the camera preview during recording. Lifters watching their replay should be able to toggle either overlay onto the playing video. Phase 1 ships bar path overlay (no schema changes, works on all existing analysed videos). Phase 2 promotes `debug_landmarks` to a production write and ships the skeleton overlay. Toggle chips above the video; per-overlay AsyncStorage persistence; correct positioning under `contentFit="contain"` letterboxing; lerped interpolation between sparse 4fps stored frames. See [design doc](features/video-analysis/design-playback-overlay.md) and [spec](features/video-analysis/spec-playback-overlay.md).

## ~~22 (Coach panel)~~ (Done — 19 Apr 2026)

Dashboard "Coach" panel wired the LLM form-coaching pipeline into the Video Overlay page. Reuses the mobile path verbatim — `assembleCoachingContext` + `generateFormCoaching` — with a synthetic-inputs form, model picker (gpt-5 / gpt-5-mini / gpt-4o / gpt-4o-mini), optional system-prompt override, and per-fixture localStorage cache (last 10; hash keyed on context + model + prompt). Engine signature extended with optional `model` / `systemPrompt` overrides (mobile caller unchanged). `@ai-sdk/openai` stays inside the engine via `createDirectOpenAIModel` so the dashboard never hoists a conflicting version. See [design doc](features/dashboard/design-coach-panel.md) and [spec](features/dashboard/spec-coach-panel.md).

> ⚠ backlog reused number 22 — a new "#22 mobile pose-detection" entry was filed at the top of this file on 2026-04-19 (same day). Renumber it when convenient.

## 9

4-day programs with overhead press as a first-class primary lift. See [design doc](features/ohp/design.md) and [feature index](features/ohp/index.md). ~30 files, 8 specs.

## ~~18~~ (Done — 18 Apr 2026)

Deadlift rep detector replaced the peak-counting algorithm with a hip-angle state machine for deadlift only (squat/bench keep peak-based). Root cause of the overcount was that peak-counting on the inverted hip signal flagged both the concentric bottom AND the eccentric bottom as separate reps — effectively 2× counting. The new detector tracks FLOOR (hip < 143°) → LOCKOUT (hip > 162°) transitions with a spike filter (single-frame lockouts surrounded by floor are rejected as MediaPipe noise) and anchors `startFrame` at the first floor frame of the setup cluster so metrics get the full concentric window. `dl-2-reps-side` now detects 2 reps exactly; all 16 calibration fixtures pass. See `apps/parakeet/src/modules/video-analysis/lib/rep-detector.ts`.

## 17

**Local-only video storage — drop Supabase Storage uploads.** Raw `.mp4` bytes do not need to live in the cloud; only analysis results (metrics, coaching, landmarks) do. Triggered by a 0-byte upload bug on 2026-04-17 (expo-file-system's `File` class does not correctly implement `Blob`, so `supabase.storage.upload(path, file, …)` wrote empty objects silently). Patched in-place, but the incident exposed that the upload path is fragile and low-value. Gym-partner flow is the one open question — likely resolved by sending only partner-computed analysis, not video bytes. See [design doc](features/video-analysis/design-local-only-storage.md).

## ~~13~~ (Done — 16 Mar 2026)

Training-age-scaled MRV/MEV: `applyTrainingAgeMultiplier` in training-engine scales MRV/MEV by training age (beginner ×0.8 MRV, advanced ×1.2 MRV / ×1.1 MEV). Wired into simulator; all 14 scenarios pass. See [design doc](features/volume/design-training-age.md) and [spec](features/volume/spec-training-age.md).

## ~~14~~ (Done — 16 Mar 2026)

Simulation CI improvements: 3 new life scripts (peaking, competition-prep, return-from-layoff → 14 total scenarios), `--output` flag for JSON artifacts uploaded to GitHub Actions, threshold tracking with `baseline.json` that warns on regressions. See [design doc](features/infra/design-simulation.md) and [spec](features/infra/spec-simulation.md).
