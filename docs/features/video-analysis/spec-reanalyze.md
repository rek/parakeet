# Spec — Re-analyze an Existing Video

**Status:** done (shipped 2026-04-19, backlog #20)
**Primary code:** `modules/video-analysis/application/reanalyze.ts`, `hooks/useVideoAnalysis.ts` (`reanalyze` callback), `app/(tabs)/session/video-analysis.tsx` (Re-analyze button)

## Why this exists

Detector fixes (rep counters, metric formulas, new fault rules) do not retroactively apply to rows that already have an `analysis` JSONB. Before Re-analyze, the only way to pick up a detector improvement on an old recording was to re-record the set — impractical weeks after the session. Re-analyze runs the current pipeline against the **existing local `.mp4`** and overwrites the row in place.

## Flow

```
[Re-analyze button] → hooks/useVideoAnalysis.reanalyze
                    → application/reanalyzeSessionVideo
                      ├─ deps.fileExists(localUri)
                      ├─ deps.getVideoDurationSec(localUri)     // prefers probe over cached result.durationSec
                      ├─ deps.extractFrames({ videoUri, durationSec })   // same extractor as first-run analysis
                      ├─ checkLiftMismatch({ frames, declared: lift })   // pose sanity check (spec-lift-label.md)
                      │    └─ deps.onLiftMismatch?(mismatch)             // non-blocking nudge
                      ├─ deps.analyze({ frames, fps, lift })
                      ├─ deps.update({ id, analysis })          // session_videos UPDATE via repository
                      └─ deps.saveDebugLandmarks({ id, frames, fps })    // dev builds only
                    → queryClient.setQueryData + invalidateQueries
                    → Alert.alert('Re-analyze complete — Detected N reps (was M)')
                      // suppressed if onLiftMismatch fired, to avoid stacking two alerts on Android
```

Every branch throws with a specific message so the caller's `catch` surfaces it. The success alert fires on completion **unless** a lift-mismatch alert was already shown — on Android two `Alert.alert` calls in the same tick can race, so the mismatch (more informative) wins.

## Deps contract

`reanalyzeSessionVideo` takes a `ReanalyzeDeps` object, all injected. This is what makes the orchestration testable without RN in the loop.

```ts
interface ReanalyzeDeps {
  fileExists: (uri: string) => boolean;
  getVideoDurationSec: (uri: string) => Promise<number | null>;
  extractFrames: (args: {
    videoUri: string;
    durationSec: number;
    onProgress?: (pct: number) => void;
  }) => Promise<{ frames: PoseFrame[]; fps: number }>;
  analyze: (args: {
    frames: PoseFrame[];
    fps: number;
    lift: SupportedLift;
  }) => VideoAnalysisResult;
  update: (args: {
    id: string;
    analysis: VideoAnalysisResult;
  }) => Promise<SessionVideo>;
  saveDebugLandmarks?: (args: {
    id: string;
    frames: PoseFrame[];
    fps: number;
  }) => Promise<void> | void;
  onProgress?: (pct: number) => void;
  onBreadcrumb?: (step: string, data?: Record<string, unknown>) => void;
  /** Fires once, between extract and analyze, when `checkLiftMismatch` returns
   *  non-null. Non-blocking — analysis still runs under the declared lift. */
  onLiftMismatch?: (mismatch: LiftMismatch) => void;
}
```

Hook wires:
- `fileExists`: `new File(normalizeVideoUri(uri)).exists`
- `getVideoDurationSec`: `react-native-compressor.getVideoMetaData(uri).duration`
- `extractFrames`: `application/analyze-video.extractFramesFromVideo`
- `analyze`: `application/analyze-video.analyzeVideoFrames`
- `update`: `data/video.repository.updateSessionVideoAnalysis`
- `saveDebugLandmarks`: `data/video.repository.updateSessionVideoDebugLandmarks`, gated on `__DEV__`
- `onProgress`: `setProgress` from hook local state
- `onBreadcrumb`: `platform/utils/captureException.addBreadcrumb('reanalyze', …)` — writes to Sentry + `__DEV__` console

## Breadcrumbs

| Step | Data |
| --- | --- |
| `extract-start` | `{ durationSec, lift }` |
| `extract-done` | `{ frameCount, fps }` |
| `analyze-done` | `{ reps, version }` |
| `db-update-ok` | `{ id, repsReturned }` |
| `duration-probe-failed` | `{ message }` (non-fatal) |
| `debug-landmarks-save-failed` | `{ message }` (non-fatal) |

Breadcrumbs land in Sentry for every build and print to `adb logcat` in dev. The four happy-path steps plus the final success Alert give a clean story: if you tap Re-analyze and don't see at least `extract-start`, the callback never fired; if you see all four plus the Alert, the pipeline succeeded and any "nothing changed" observation is content-identical output (same reps → same analysis shape).

## Error surface

Top-level errors caught by the hook path `Alert.alert('Video Error', message)` via the screen's `useEffect([error])` watcher. Specific messages:

- `Re-analyze not supported for lift "X"` — lift isn't one of `squat | bench | deadlift`.
- `Local video file missing (URI)` — `local_uri` points at a file the OS can't see (app reinstall, different device, expired thumbnail cache).
- `Invalid video duration: Xs` — both `result.durationSec` and the live probe returned 0 or negative.
- `Pose extraction produced 0 frames` — extraction returned an empty array (duration or sampling misconfigured).
- Any error from `deps.update` — `PGRST116` on 0-row RLS-filtered UPDATE, network failure, etc.

`Re-analyze not supported for lift "X"` is a guard against non-SBD lifts (OHP work in #9 will expand this).

## Definition of done (met)

1. Tapping Re-analyze on a prod row triggers a new analysis, writes it to `session_videos.analysis`, and the UI reflects the updated rep count without re-navigation.
2. Blocking diagnostic alerts from `ee01490` removed; replaced with Sentry breadcrumbs + a post-success Alert.
3. Node/Vitest integration test — `application/__tests__/reanalyze.test.ts` — exercises auth → RLS UPDATE → round-trip against local Supabase with the `dl-2-reps-side` fixture. Skips cleanly when `SUPABASE_URL` isn't reachable, so CI without the stack stays green.

## Things deliberately not done

- **Background / queue-mode re-analyze.** Today this is one tap = one synchronous run. Batch "re-analyze every video for this lift" is possible but would need a queue, backoff, and UI to surface per-video outcomes. Deferred until we actually ship a detector change that warrants it.
- **Re-fetch video from Supabase Storage if `local_uri` is missing.** Aligned with [design-local-only-storage.md](./design-local-only-storage.md) — raw video bytes are staying local. If the file is gone, re-analyze throws with a clear message.
- **Auto-trigger on detector version bump.** Tempting (bump `ANALYSIS_VERSION`, auto-run on next screen visit) but noisy and surprising; stays manual for now.
