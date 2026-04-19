# Spec: Video Playback Overlay

**Status:** Proposed
**Design:** [design-playback-overlay.md](./design-playback-overlay.md)
**Depends on:** mobile-046 (video form analysis), mobile-052 (view angle rework)

## What This Covers

Render bar path and full skeleton as optional overlays on top of `<VideoView>` during playback. Toggle chips above the video; per-overlay AsyncStorage persistence; correct positioning under `contentFit="contain"` letterboxing; smooth interpolation between sparse pose frames.

Non-goals: animated trail mode, fault hot-spots, scrubbing/slow-mo controls, web/iOS, backfill of historical videos beyond the disabled-chip affordance.

## Phase 1 — Bar path overlay (no schema changes)

### 1.1 — Persist video dimensions

Needed for letterbox math. Cheap to capture at insert.

- [ ] Migration: add `video_width_px integer` and `video_height_px integer` to `session_videos` (nullable — old rows have null and overlay falls back to container rect with a sub-label warning).
- [ ] Update `supabase/types.ts` (`npm run db:types` after `db:reset`).
- [ ] In `useVideoAnalysis.processVideo`: capture `meta.width` / `meta.height` from the existing `getVideoMetaData(videoUri)` call; pass through `insertSessionVideo`.
- [ ] `insertSessionVideo`: accept and persist `videoWidthPx`, `videoHeightPx`.
- [ ] `SessionVideo` model + `toSessionVideo` mapper: surface as `videoWidthPx`, `videoHeightPx` (nullable).

### 1.2 — Display-rect helper

- [ ] New file: `modules/video-analysis/lib/video-display-rect.ts`.
- [ ] Pure function `computeDisplayRect({ containerWidth, containerHeight, videoWidthPx, videoHeightPx })` returning `{ width, height, offsetX, offsetY }` per the design doc's letterbox math.
- [ ] Fallback when `videoWidthPx`/`videoHeightPx` are null: return container rect unchanged. Caller decides whether to render a sub-label.
- [ ] Vitest: aspect wider than container (top/bottom bars), taller than container (side bars), exact match (no offsets), null dimensions (passthrough).

### 1.3 — Time sync hook

- [ ] New file: `modules/video-analysis/hooks/usePlaybackTime.ts`.
- [ ] Accepts `player: VideoPlayer`. Sets `player.timeUpdateEventInterval = 0.1` in an effect (idempotent; restored on unmount only if changed).
- [ ] Returns `currentTime: number` via `useEvent(player, 'timeUpdate', { currentTime: 0, … })` (from `expo`).
- [ ] No tests (thin wrapper); covered indirectly by overlay component tests.

### 1.4 — Bar path overlay component

- [ ] New file: `modules/video-analysis/ui/PlaybackBarPathOverlay.tsx`.
- [ ] Props: `analysis: VideoAnalysisResult`, `currentTime: number`, `displayRect: { width, height, offsetX, offsetY }`, `colors: ColorScheme`.
- [ ] Render: absolute-positioned `<Svg>` at `displayRect`. For each rep: `<Polyline>` of the rep's full bar path in a per-rep colour. One `<Circle>` (head dot) at the bar position for `currentFrame = currentTime * analysis.fps` if it falls inside any rep's `[startFrame, endFrame]`; otherwise hidden.
- [ ] Per-rep colour: cycle through a fixed palette of 6 hues from the theme (avoid pure red/green to stay accessible against arbitrary video backgrounds).
- [ ] Rep number label: small `<Text>` near the start point of each rep's polyline.
- [ ] Vitest: rep colour assignment, head-dot visibility logic, frame-to-rep mapping, empty-analysis no-op.

### 1.5 — Toggle chip + persistence

- [ ] New file: `modules/video-analysis/hooks/useOverlayPreference.ts`.
- [ ] Signature: `useOverlayPreference(key: 'barPath' | 'skeleton'): [enabled: boolean, setEnabled: (v: boolean) => void]`.
- [ ] AsyncStorage key: `video.overlay.${key}`. Reads on mount (default `false`); writes on change with `await + try/catch + captureException` (per `feedback_error_handling_screens.md`).
- [ ] No tests (thin AsyncStorage wrapper).

- [ ] New file: `modules/video-analysis/ui/OverlayToggleChips.tsx`.
- [ ] Props: `barPathEnabled`, `onToggleBarPath`, `skeletonEnabled`, `onToggleSkeleton`, `skeletonAvailable: boolean`, `colors`.
- [ ] Renders two chips. Skeleton chip is non-interactive when `skeletonAvailable === false`, with sub-label "No landmarks for this video".
- [ ] Accessible: each chip is `accessibilityRole="switch"` with `accessibilityState={{ checked: enabled, disabled: !available }}`.

### 1.6 — Wire into `VideoPlayerCard`

- [ ] Accept new prop: `analysis?: VideoAnalysisResult | null`.
- [ ] Use `usePlaybackTime(player)` for `currentTime`.
- [ ] Use `onLayout` on the video wrapper to capture container size; recompute `displayRect` via `computeDisplayRect` when container size or video dimensions change (`useMemo`).
- [ ] Read `useOverlayPreference('barPath')`; render `OverlayToggleChips` above the video; mount `PlaybackBarPathOverlay` only when enabled and `analysis != null`.
- [ ] Skeleton chip: `skeletonAvailable={false}` in Phase 1.

### 1.7 — Module exports

- [ ] Export `OverlayToggleChips`, `PlaybackBarPathOverlay`, `usePlaybackTime`, `useOverlayPreference`, `computeDisplayRect` from `modules/video-analysis/index.ts` only if external consumers need them. Default: keep internal, expose only `VideoPlayerCard` (already exported).

### 1.8 — Validation

- [ ] `/verify` passes: typecheck, boundaries, tests.
- [ ] Manual on-device: pick an existing analysed video, toggle bar path on, scrub video, verify the head dot tracks playback and polyline positions match wrist motion. Letterbox: test with portrait and landscape source videos.

## Phase 2 — Skeleton overlay (promote landmarks to prod)

### 2.1 — Promote `debug_landmarks` write

- [ ] In `useVideoAnalysis.processVideo` step 7: remove the `__DEV__` guard around `updateSessionVideoDebugLandmarks`. Keep it non-blocking (fire-and-forget with `captureException`) — landmark loss is non-fatal.
- [ ] Rename consideration: column stays `debug_landmarks` for now (no migration needed). If renaming, do it in a follow-up to keep this spec focused.
- [ ] Repository: surface `debugLandmarks` on `SessionVideo` model (new field, nullable). Add a Zod codec for the `{ frames, fps, extractedAt }` shape so we don't read raw `unknown` at the UI layer.

### 2.2 — Skeleton overlay component

- [ ] New file: `modules/video-analysis/ui/PlaybackSkeletonOverlay.tsx`.
- [ ] Props: `frames: PoseFrame[]`, `fps: number`, `currentTime: number`, `displayRect`, `colors`.
- [ ] Compute lerped frame: `frameIdxFloat = currentTime * fps`; clamp to `[0, frames.length - 1]`; lerp per-landmark x/y/visibility between `floor` and `ceil`.
- [ ] Render: `<Line>` per `SKELETON_CONNECTIONS` entry (reuse from `useLivePoseOverlay`); `<Circle>` per landmark with `visibility >= 0.5`. Same visual style as `LiveSkeletonOverlay`.
- [ ] Skip rendering if both endpoints of a bone have `visibility < 0.5` (matches `LiveSkeletonOverlay` behaviour).
- [ ] Vitest: lerp math (boundary cases: t=0, t=1, mid-frame), visibility filtering, empty-frames no-op.

### 2.3 — Wire into `VideoPlayerCard`

- [ ] Read `useOverlayPreference('skeleton')`.
- [ ] `skeletonAvailable = video.debugLandmarks?.frames != null && video.debugLandmarks.frames.length > 0`.
- [ ] Mount `PlaybackSkeletonOverlay` when enabled, available, and `displayRect` resolved.

### 2.4 — Validation

- [ ] `/verify` passes.
- [ ] Manual on-device: record a fresh video, confirm `debug_landmarks` is persisted in prod, toggle skeleton overlay on during playback, verify joints track the lifter smoothly through the rep (no visible jitter from sparse-frame interpolation).
- [ ] Storage check: confirm a 30s video's row stays well under 50KB JSON for `debug_landmarks` + `analysis`.

## Phase 3 (optional) — Re-analysis backfill

Defer until users ask. Spec stub:

- [ ] Replace skeleton chip's "No landmarks for this video" sub-label with a "Re-analyse for skeleton" button when `localUri` exists and the file is present.
- [ ] On tap: call `extractFramesFromVideo({ videoUri: localUri, durationSec })`; on success, `updateSessionVideoDebugLandmarks` and refetch the video row.
- [ ] Loading state during re-extraction (10–30s typical).
- [ ] No-op if the local file has been pruned (cloud-only).

## Test coverage targets

| File | Tests |
|---|---|
| `lib/video-display-rect.ts` | 4 (wider, taller, exact, null) |
| `ui/PlaybackBarPathOverlay.tsx` | ~5 (rep colour assignment, head-dot visibility per phase, frame→rep mapping, multi-rep render, empty analysis) |
| `ui/PlaybackSkeletonOverlay.tsx` | ~4 (lerp boundaries, visibility filter, empty frames, single-frame degenerate) |
| Integration / on-device | manual checklist above |

No snapshot tests on overlay components — SVG output is brittle and the value lives in math, not pixels.

## Files touched

```
docs/features/video-analysis/
  design-playback-overlay.md            (new)
  spec-playback-overlay.md              (new — this file)
  index.md                              (link new docs)

apps/parakeet/src/modules/video-analysis/
  lib/video-display-rect.ts             (new)
  hooks/usePlaybackTime.ts              (new)
  hooks/useOverlayPreference.ts         (new)
  ui/PlaybackBarPathOverlay.tsx         (new — Phase 1)
  ui/PlaybackSkeletonOverlay.tsx        (new — Phase 2)
  ui/OverlayToggleChips.tsx             (new)
  ui/VideoPlayerCard.tsx                (edit — accept analysis prop, mount overlays)
  hooks/useVideoAnalysis.ts             (edit — capture video dimensions; remove __DEV__ guard in Phase 2)
  data/video.repository.ts              (edit — persist + read videoWidthPx, videoHeightPx; surface debugLandmarks)
  model/types.ts                        (edit — videoWidthPx, videoHeightPx, debugLandmarks fields)

supabase/migrations/
  <timestamp>_add_video_dimensions.sql  (new — Phase 1)

supabase/types.ts                       (regen)
```

## Risks

| Risk | Mitigation |
|---|---|
| Letterbox math wrong on portrait videos | Manual on-device validation with both portrait and landscape sources before Phase 1 lands. Pure-function tests cover both branches. |
| `timeUpdate` interval too noisy / janky | 100ms tested as default; if RN re-render budget is exceeded on low-end devices, fall back to 200ms or move overlay to Reanimated `useDerivedValue`. |
| Existing prod videos with no `videoWidthPx`/`videoHeightPx` | Display-rect helper falls back to container rect; sub-label warns "Overlay alignment may be off". User can re-record to fix. |
| `debug_landmarks` JSON inflates row size | At 4fps × 30s, ~16KB JSON. Even at 60s × 5fps, ~50KB. Negligible vs the 5–8MB video. Add a hard cap (`frames.length > 600 → drop oldest`) only if real videos exceed expectations. |
| Skeleton lerp produces "rubber-band" effect when landmark visibility flips | Visibility threshold (0.5) is checked per-frame, not lerped. Hide bone if either endpoint drops below threshold in the *nearest* stored frame, not the lerped frame. |
