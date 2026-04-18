# Backlog

If you are a human, say to an Agent: **"Read docs/backlog.md and do item N"**

If you are an AI Agent, first read: `docs/README.md` and understand our intent and architecture.

Then always make sure to follow the [AI Workflow](./guide/ai-workflow.md) (orient → design → plan → implement → validate → wrap up).

At the end: update design doc status → Implemented, update specs to match what was actually built, update `docs/features/<feature>/index.md`, then review and add any learnings to `docs/guide/ai-workflow.md`.

---

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

## 19

**Video playback overlay — bar path + skeleton on top of `<VideoView>`.** Today the bar path is a standalone SVG card next to the video; the skeleton is only drawn over the camera preview during recording. Lifters watching their replay should be able to toggle either overlay onto the playing video. Phase 1 ships bar path overlay (no schema changes, works on all existing analysed videos). Phase 2 promotes `debug_landmarks` to a production write and ships the skeleton overlay. Toggle chips above the video; per-overlay AsyncStorage persistence; correct positioning under `contentFit="contain"` letterboxing; lerped interpolation between sparse 4fps stored frames. See [design doc](features/video-analysis/design-playback-overlay.md) and [spec](features/video-analysis/spec-playback-overlay.md).

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
