# mobile-051: PostRestOverlay Recording Integration

**Status:** Planned
**Design:** [video-form-analysis.md](../../design/video-form-analysis.md), [set-level-video-linking.md](../../design/set-level-video-linking.md)
**Depends on:** mobile-046 (video form analysis — RecordVideoSheet), mobile-048 (set-level video linking)

## What This Covers

Integrate video recording into the PostRestOverlay so lifters can start recording before their set. This is the primary in-app recording path — the phone is already propped up, the rest timer just expired, and full set context (set number, weight, reps, RPE) is available without a picker.

Also:
- Remove the header-level `VideoEntryButton` (icon variant) from the active session screen — redundant since mobile-048 added per-set entry points
- Clarify `SetVideoIcon` on completed set rows as the camera-roll-import entry point (behavior unchanged)

## Problem

In-app recording is in the wrong place. `SetVideoIcon` only appears on completed sets (`is_completed === true`), but you need to start recording *before* you lift. The current flow assumes you either filmed with the native camera app (camera roll import) or want to record after the fact (doesn't make sense for self-recording).

The header-level `VideoEntryButton` was the original Phase 1 entry point before set-level linking existed. It navigates to the analysis screen with only `sessionId + lift` — no set number, no weight, no RPE. The coaching assembler falls back to a "heaviest weight" heuristic instead of knowing the exact set context. This is the coarse granularity that mobile-048 was designed to replace.

## Entry Point Model (After This Spec)

| Entry point | When | Context | Use case |
|---|---|---|---|
| **PostRestOverlay "Record" button** | Before the set (rest timer expired) | Full: set number, weight, reps from `postRestState` | Primary in-app recording path |
| **SetVideoIcon on completed set row** | After completing a set | Full: set number, weight, reps, RPE from set data | Camera roll import (filmed with native camera) |
| **History detail "Add Video" link** | After the session | Session + lift only | Retrospective add from camera roll |
| ~~Header-level VideoEntryButton~~ | ~~Removed~~ | — | Superseded by PostRestOverlay + SetVideoIcon |

## UX Flow

### Pre-set recording (primary)

1. Rest timer expires. PostRestOverlay appears: "Set 3 — 140kg × 3" / "Go lift!"
2. A "Record" button is visible below the context label, above the Complete/Failed row.
3. Lifter taps "Record". `RecordVideoSheet` opens as a full-screen overlay with the camera preview and guide overlay.
4. Lifter positions phone (if not already), taps the record button on RecordVideoSheet, performs the set, then taps stop.
5. RecordVideoSheet closes. PostRestOverlay shows a "Recording saved" indicator next to the Record button.
6. Lifter taps "Complete" (or "Failed" with rep stepper).
7. On set completion, the recorded video is saved to the database with full set context (`sessionId`, `lift`, `setNumber`, `weightGrams`, `reps`, `rpe`) and analysis runs in the background.

### Post-set import (secondary — unchanged)

1. Lifter completes a set. Camera icon (📷) appears on the completed set row.
2. Lifter taps the camera icon → navigates to the video analysis screen with full set context.
3. Lifter picks a video from camera roll. Analysis runs.

### Retrospective add (unchanged)

1. From the history detail screen, lifter taps "Add Video / View Analysis".
2. Navigates to the video analysis screen with session + lift context.
3. Lifter picks a video from camera roll or records. Analysis runs.

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Recording trigger | Explicit "Record" button on PostRestOverlay (opt-in) | Not every set needs recording. Phone may not be positioned. Must not add friction to the normal Complete/Failed flow. |
| 2 | Camera angle | Default to `side`, no picker in PostRestOverlay | Speed over configurability — the lifter is in a time-pressured moment (rest just expired). The analysis screen's CameraAnglePicker handles the import path. Future: remember last-used angle per lift. |
| 3 | Recording stop | Manual stop on RecordVideoSheet | Decoupled from set completion to avoid accidental truncation. The lifter stops recording, then decides Complete vs Failed. |
| 4 | Video processing timing | Background, after set completion | Don't block the lifter. Save the raw video URI on set completion, run frame extraction + analysis asynchronously. Same path as `processRecordedVideo` in `useVideoAnalysis`. |
| 5 | Module boundary | PostRestOverlay accepts `recordingSlot?: ReactNode` (slot pattern) | Same pattern as `SetRow.videoIconSlot`. Session module stays unaware of video-analysis internals. Cross-module composition happens at the `app/` layer. |
| 6 | Set linking | Auto-link to `postRestState.nextSetNumber` | PostRestOverlay already knows the next set's number, weight, and reps. No picker needed — eliminates the ambiguity of the old header-level button. |
| 7 | Header-level button removal | Remove `VideoEntryButton` (icon variant) from session screen | Redundant since mobile-048 added per-set icons. Lacks set context. Confusing to have both header and per-set icons. |
| 8 | Feature flag | Reuse `videoAnalysis` flag | PostRestRecordButton self-gates on the same flag. No new flag needed. |

## Implementation Phases

### Phase 1 — PostRestOverlay slot + record button

- [ ] Add `recordingSlot?: ReactNode` prop to `PostRestOverlay` (`modules/session/ui/PostRestOverlay.tsx`)
- [ ] Render slot below context label, above button row (only when provided)
- [ ] Create `PostRestRecordButton` component in `modules/video-analysis/ui/`
  - Self-gates behind `videoAnalysis` feature flag
  - Props: `cameraAngle` (default `'side'`), `onRecorded: (videoUri: string) => void`, `onRecordingStateChange?: (isRecording: boolean) => void`
  - Renders a compact "Record" button; when tapped, mounts `RecordVideoSheet` as `absoluteFill` overlay (same approach as `video-analysis.tsx`)
  - After recording: shows "Recording saved" indicator, calls `onRecorded` with the video URI
  - If already recorded: shows indicator + "Re-record" option

### Phase 2 — Session screen wiring

- [ ] In `app/(tabs)/session/[sessionId].tsx`: compose `<PostRestRecordButton>` into PostRestOverlay's `recordingSlot`
- [ ] Track recorded video URI in `useSetCompletionFlow` or local state
- [ ] On `handleLiftComplete` / `handleLiftFailed`: if a video URI exists, call `processRecordedVideo` from `useVideoAnalysis` with full set context (`sessionId`, `lift`, `nextSetNumber`, `weightGrams`, `reps`)
- [ ] Clear recorded video URI after processing starts

### Phase 3 — Remove header-level entry point

- [ ] Remove `<VideoEntryButton sessionId={...} lift={...} />` from `[sessionId].tsx` line 797-800
- [ ] Keep `VideoEntryButton` component (still used on history detail with `variant="link"`)

### Phase 4 — Module exports

- [ ] Export `PostRestRecordButton` from `modules/video-analysis/index.ts`

## Dependencies

- [mobile-046-video-form-analysis.md](./mobile-046-video-form-analysis.md) — `RecordVideoSheet`, `useVideoAnalysis`, `processRecordedVideo`
- [mobile-048-set-level-video-linking.md](./mobile-048-set-level-video-linking.md) — set-level data model, `SetVideoIcon`
- PostRestOverlay in `modules/session/ui/PostRestOverlay.tsx`
- `useSetCompletionFlow` in `modules/session/hooks/useSetCompletionFlow.ts`
