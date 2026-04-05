# Set-Level Video Linking

**Status**: Phase 1 Implemented
**Date**: 29 Mar 2026

## Overview

Link form analysis videos to specific working sets (e.g. "Set 3 @ 140kg") instead of the current session+lift granularity. This unlocks per-set coaching, intra-session fatigue comparison, and competition readiness scoring that knows the exact weight, RPE, and rep count for every analyzed rep.

## Problem Statement

Today a video is associated with a session and a lift. That is too coarse:

- **No weight/RPE context per video.** The coaching assembler extracts the heaviest weight from the whole session, but the lifter may have filmed set 2 at 120kg while the heaviest set was 145kg.
- **Cannot compare sets within one session.** Fatigue-induced form degradation from set 1 to set 5 is invisible because only one video slot exists per lift.
- **Competition readiness scoring is imprecise.** The planned competition-grading feature (mobile-047) needs to know exactly which weight and RPE produced a given bar path.
- **Multi-video sessions are unsupported.** Lifters commonly film 2-3 key sets (opener, top set, back-off). The current model forces them to pick one.

## User Experience

### Primary Flow — record before the set (PostRestOverlay, mobile-051)

1. Rest timer expires. PostRestOverlay appears: "Set 3 — 140kg × 3" / "Go lift!"
2. Lifter taps "Record" on PostRestOverlay. Camera opens as full-screen overlay.
3. Lifter positions phone, starts recording, performs the set, stops recording.
4. Returns to PostRestOverlay with "Recording saved" indicator.
5. Lifter taps "Complete" (or "Failed").
6. Video is saved with full set context (set 3, 140kg, 3 reps) and analysis runs in the background.
7. LLM coaching receives exact weight, reps, and RPE for this set.

### Secondary Flow — import from camera roll after completing a set

1. Lifter completes Set 3 and taps the check mark.
2. A small camera icon appears on the completed set row.
3. Lifter taps the camera icon on Set 3 specifically.
4. The video analysis screen opens with set context pre-populated: set 3, 140kg, 3 reps, RPE 8.
5. Lifter picks a video from camera roll. Analysis runs.
6. The analysis screen header reads "Squat — Set 3 @ 140kg x 3 (RPE 8)".

### Tertiary Flow — retrospective add from history

1. After the session, lifter opens the history detail screen.
2. Taps "Add Video / View Analysis" link.
3. Video analysis screen opens with session + lift context.
4. Lifter picks a video from camera roll or records.

### Browse all videos for a session

1. On the analysis screen, a "Videos" section lists thumbnails grouped by set number.
2. Tapping any thumbnail opens its analysis. Quick comparison between sets.

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Set number column | Nullable integer on session_videos | Null = "whole lift" (backward compat), non-null = 1-indexed set |
| 2 | Snapshot set context | Store weight_grams, reps, RPE on the video row | Session data could be edited later; snapshot at recording time ensures coaching context is always correct |
| 3 | Entry point | PostRestOverlay record button (pre-set, primary) + SetVideoIcon on completed SetRow (post-set import) + history link (retrospective). Header icon removed (mobile-051). | PostRestOverlay has full set context and natural timing. SetVideoIcon for camera roll import. Header icon was redundant and lacked set context. |
| 4 | Multiple videos per set | Allowed (side + front already supported via camera_angle) | No artificial limit |
| 5 | Auxiliary exercises | Defer to future | Main lifts first; aux video adds complexity for lower value |

## User Benefits

**Precise coaching context**: "Set 3 @ 140kg RPE 9: bar drifted 6cm forward, depth borderline" vs "your squat video: bar drifted 6cm."

**Intra-session fatigue tracking**: Overlay bar paths from set 1, 3, and 5 to see form degradation.

**Competition readiness per attempt**: Score each set independently — opener vs third attempt.

**Multi-video flexibility**: Film as many sets as you want.

## Open Questions

- [ ] Camera icon on auxiliary exercise rows?
- [ ] Comparison view: new screen or expandable section?
- [x] ~~Prompt "Which set?" when using header-level entry point?~~ — No longer relevant. Header-level entry point removed (mobile-051).

## References

- Spec: [mobile-048](../specs/09-mobile/mobile-048-set-level-video-linking.md)
- Supersedes Decision 6 in [video-form-analysis.md](./video-form-analysis.md) ("Not per-set — too much friction")
- Enables: [mobile-047 competition readiness](../specs/09-mobile/mobile-047-competition-readiness.md)
