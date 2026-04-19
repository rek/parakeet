# Video Playback Overlay (Bar Path + Skeleton)

**Status:** Proposed
**Created:** 2026-04-18

## Problem

We extract bar path and full pose landmarks during analysis. Today the visualisation is decoupled from playback: `BarPathOverlay` renders the trail as a standalone SVG card next to the video, and `LiveSkeletonOverlay` only paints during in-app recording (camera preview). When a lifter replays their video, the visual feedback is "look at the chart and the video side-by-side and reconcile them in your head."

We want the bar path and the skeleton drawn **on top of the playing video frame**, optional, toggleable per-replay.

## Solution

Extend `VideoPlayerCard` to host one or more SVG overlays that:

1. Are positioned over the video display rect (correctly accounting for `contentFit="contain"` letterboxing).
2. Sync to `player.currentTime` via the `timeUpdate` event.
3. Render in MediaPipe normalised 0..1 coordinates, scaled to the video display rect.
4. Are toggled by a chip row above the video; last-used state persisted per-user via AsyncStorage.

Two overlay types:

| Overlay | Source data | Existing video coverage |
|---|---|---|
| Bar path trail | `analysis.repAnalyses[].barPath` | All videos with successful analysis |
| Skeleton (33 landmarks) | `debug_landmarks.frames` | None in prod yet — `debug_landmarks` is `__DEV__`-only today |

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Toggle placement | Chip row above the video, inside `VideoPlayerCard` | Native player controls already occupy the video surface — floating buttons fight them. Chips above are immediately discoverable, cost no extra navigation, and keep state co-located with the player. |
| 2 | Toggle persistence | AsyncStorage per overlay type (`video.overlay.barPath`, `video.overlay.skeleton`) | Lifter who likes the overlay shouldn't re-toggle every replay. Per-overlay (not bundled) so they can keep bar path on and skeleton off — different signal-to-clutter ratios. |
| 3 | Default state | Both off | Overlay is opinionated and can occlude the bar. Off-by-default avoids surprising users who just want playback. |
| 4 | Bar path render mode | Full path always visible + an animated head dot at current playback frame | The path *is* the analysis — partially-drawn trails feel like a "loading" state. The dot supplies the "where am I" cue without hiding the rest. |
| 5 | Per-rep colouring | Each rep is a distinct hue; rep number labelled at start | Distinguishing reps is more useful than colour-by-drift severity once the overlay is on the actual video — drift is now visually obvious from the path itself. |
| 6 | Skeleton render mode | Single frame at current playback time, lerped between adjacent stored frames | Source is sparse (4fps); video plays at ~30fps. Hard-snapping to nearest stored frame produces visible jitter. Linear interpolation per-landmark gives smooth motion. |
| 7 | Skeleton storage promotion | Promote `debug_landmarks` write out of `__DEV__` guard. Keep column name; treat as production data. | Column already exists. Cost is ~16KB JSON per video (33 × 4 × 4fps × 30s). Trivial vs the 5–8MB compressed video in the same row. No new schema. |
| 8 | Backfill | None — skeleton overlay enabled only on videos with non-null `debug_landmarks`. Re-analysis from local file is future work. | Existing prod videos lack landmarks. Re-running pose extraction per-video is expensive (4fps × duration of MediaPipe inference) and only valuable if user opts in. Defer; gate the chip with a tooltip. |
| 9 | Letterbox math | Compute display rect from container size + video aspect (from `videoWidthPx`/`videoHeightPx` columns persisted at insert) | `contentFit="contain"` letterboxes the video inside its container. Overlay must match the **display rect**, not the container rect, or landmarks drift off the body. Storing dimensions at insert avoids a second `getVideoMetaData` round-trip on every playback. |
| 10 | Time sync | `player.timeUpdateEventInterval = 0.1`; subscribe via `useEvent` from `expo` | Default interval is too coarse for a moving overlay. 100ms is the sweet spot (10Hz UI updates, well under perceptual lag, well within RN's affordable re-render budget). |
| 11 | Disabled state for missing skeleton | Skeleton chip rendered greyed with sub-label "No landmarks for this video" | Honest UX. Don't hide the feature — explain why it's unavailable. Future re-analysis CTA can slot in here. |
| 12 | Module placement | New `PlaybackBarPathOverlay.tsx` and `PlaybackSkeletonOverlay.tsx` in `modules/video-analysis/ui/`; consumed by `VideoPlayerCard` | Each overlay is independently testable. `VideoPlayerCard` becomes the composition point. No cross-module dependency. |
| 13 | Coordinate convention | All overlays consume normalised 0..1 coords + display-rect dimensions in pixels | Same convention as `LiveSkeletonOverlay`. Consistent mental model: stored data is camera-frame normalised; overlay scales to wherever it ends up rendered. |
| 14 | Performance budget | <2ms render per `timeUpdate` event; no `react-native-reanimated`, no Skia | SVG with 33 circles + 12 lines + 1 polyline is well within RN's render budget. Reanimated/Skia would be premature optimisation; the bottleneck (if any) will be `setState` re-renders, not draw calls. |

## UX Flow

```
┌──────────────────────────────────┐
│ [▣ Bar path]  [☐ Skeleton]       │  ← chip row, taps toggle overlay
├──────────────────────────────────┤
│                                  │
│       <VideoView contain>        │
│       <PlaybackBarPathOverlay/>  │  ← if enabled
│       <PlaybackSkeletonOverlay/> │  ← if enabled and landmarks present
│                                  │
├──────────────────────────────────┤
│ Duration: 12s    [Replace Video] │
└──────────────────────────────────┘
```

- Toggle a chip → overlay mounts/unmounts immediately (no re-render of `VideoView`, no playback hiccup).
- Chip preference persists via AsyncStorage; restored on next mount.
- Skeleton chip is disabled (greyed, non-interactive) when the video has no `debug_landmarks`. Tap on disabled chip is a no-op; sub-label explains why.

## Data flow

### Bar path overlay

```
analysis (already in DB)
  → repAnalyses[].barPath: BarPathPoint[]   // normalised, frame-indexed
  → flatten across reps, tag with repNumber
  → SVG <Polyline> per rep + head <Circle> at current frame
```

Frame index from playback time:
```
frameIdx = currentTime * analysis.fps
```

`barPath` covers only frames inside detected reps (between `startFrame` and `endFrame`). Between reps, the head dot hides and the polyline freezes at the rep endpoint. This is correct: outside a rep there is no bar movement to track.

### Skeleton overlay

```
debug_landmarks.frames (PoseFrame[])     // 33 landmarks per stored frame
debug_landmarks.fps                      // sampling rate (default 4)
  → frameIdxFloat = currentTime * fps
  → loFrame = floor(frameIdxFloat), hiFrame = ceil(frameIdxFloat)
  → t = frameIdxFloat - loFrame
  → for each landmark: lerp(frames[loFrame][i], frames[hiFrame][i], t)
  → SVG <Line> per skeleton bone + <Circle> per landmark with visibility >= 0.5
```

Reuses the existing `SKELETON_CONNECTIONS` constant from `useLivePoseOverlay`.

### Letterbox math

```
container = layout-measured Width × Height of <View>
videoAspect = videoWidthPx / videoHeightPx
containerAspect = containerWidth / containerHeight

if videoAspect > containerAspect:        // video is wider than container — bars top/bottom
  displayWidth = containerWidth
  displayHeight = containerWidth / videoAspect
  offsetX = 0
  offsetY = (containerHeight - displayHeight) / 2
else:                                     // video taller — bars left/right
  displayHeight = containerHeight
  displayWidth = containerHeight * videoAspect
  offsetX = (containerWidth - displayWidth) / 2
  offsetY = 0
```

SVG renders at `displayWidth × displayHeight`, positioned absolutely at `(offsetX, offsetY)`.

## Storage cost

| Item | Per video |
|---|---|
| Bar path (already in `analysis`) | ~0.5 KB |
| Full landmarks (after promotion) | ~16 KB JSON, 4fps × 30s × 33 × 4 floats |
| New columns (`video_width_px`, `video_height_px`) | 8 bytes |

Compared to the 5–8 MB compressed video in the same row, landmark JSON is rounding error.

## Performance

- `timeUpdate` fires at 10Hz with `timeUpdateEventInterval = 0.1`.
- Each event triggers one `setState` in the overlay component (current frame index).
- Re-render renders 12 lines + 33 circles + 1 polyline + 1 head dot. No measurable cost on tested Android devices (target: Pixel 7-class hardware).
- No animation library. No worklets. SVG re-renders are cheap because the SVG tree is small and the props are primitives.

## Backfill story

Skeleton overlay only works on videos recorded **after** the `__DEV__` guard is removed. Two options for older videos:

1. **Do nothing** — skeleton chip stays disabled, sub-label explains why. Simple; fine if most users don't care.
2. **Re-analyse on demand** — add a "Re-analyse for skeleton" CTA in the disabled chip's place. Re-runs `extractFramesFromVideo` against the local file (skipped if file missing) and writes `debug_landmarks`. Cost: ~10–30s depending on duration.

Initial release ships option 1. Add option 2 later if users ask.

## Out of scope

- Animated trail mode (bar path appears progressively as the video plays). Decision 4 chose full-path. If users ask for trail mode, add as a third chip state (`Off / Full / Trail`) rather than a separate chip.
- Marking fault frames with hot-spot markers. Useful, but separate concern from "show what we tracked".
- Multi-video comparison overlay (overlay one video's path onto another's playback). `LongitudinalComparison` already handles cross-video bar path overlays in chart form.
- Slow-motion / scrubbing controls. `<VideoView nativeControls>` already provides scrubbing; native rate adjustment exists on `player.playbackRate`. If desired later, a "0.5x" chip can sit alongside the overlay chips.
- Web/iOS support. Android-only project — overlay logic is platform-agnostic but only validated on Android.

## Phases

- **Phase 1:** Bar path overlay over playback (no schema changes; works on all existing analysed videos).
- **Phase 2:** Promote `debug_landmarks` to production write; add `video_width_px`/`video_height_px` columns; ship skeleton overlay.
- **Phase 3 (optional):** Re-analyse-from-file CTA for backfilling skeleton on older videos.
