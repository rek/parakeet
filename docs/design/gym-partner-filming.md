# Gym Partner Filming

**Status:** Draft
**Date:** 30 Mar 2026

## Overview

Let gym partners film each other's lifts and have the video automatically land in the lifter's account with full analysis. Two users pair once via QR code, then the recorder can film for the lifter at any time — video, CV analysis, and session tagging all handled seamlessly.

## Problem

Lifters rarely film their own sets. Your gym partner films you on their phone. Today, that video stays on the partner's device — disconnected from the lifter's training data. Manual transfer (AirDrop, messaging) loses session context entirely. The lifter can't get form coaching because the video isn't linked to their session, weight, RPE, or block phase.

- No way to attribute a video to someone other than the person who recorded it
- Manual file transfer loses session/set context
- Partner-recorded videos can't be analyzed within the lifter's training context
- Zero multi-user concepts exist in the app today

## Solution

Persistent gym partner relationships. Pair once via QR code scan. When your partner is training, you see their active session on your Program screen. Tap "Film", pick the set, record. The video uploads directly to the lifter's Supabase storage, CV analysis runs on your phone, and the lifter gets the video + analysis in their session. They trigger LLM coaching later with their own training context.

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Link method | Persistent partner relationship | One-time setup, reusable across sessions. Partners train together regularly. |
| 2 | Pairing | QR code scan | Both users are in the gym together. QR is instant, no typing. Camera permission already granted for video recording. |
| 3 | Account required | Both users need Parakeet accounts | Simpler auth model — reuse Supabase auth. Partners are also lifters (bidirectional). |
| 4 | Relationship type | Mutual / bidirectional | One scan, both can film for each other. Matches gym reality — partners take turns. |
| 5 | Upload path | Direct to lifter's Supabase storage | No transfer step. Recorder never "owns" the video. Clean ownership model. |
| 6 | Session linking | Recorder picks from lifter's active session | Recorder sees lift name and active status. Set picker derives total sets from session's `planned_sets` JSONB — no `session_logs` access needed. |
| 7 | Analysis split | Recorder does CV only; lifter triggers coaching | CV is context-free (just video frames). Coaching needs training data. Clean privacy boundary — no training data leaves the lifter's account. |
| 8 | Data visibility | Lift name + active status only | Minimal exposure enforced at RLS level. Recorder sees partner's `sessions` rows (lift, status, planned_date) but NOT `session_logs` (which contain weights, RPE, actual sets). Set count derived from `planned_sets` on the session row. |
| 9 | Notifications | In-app badge | Badge on partner section when new videos arrive. No push notifications — you're in the gym, you'll see it. |
| 10 | Unlink behavior | Videos stay with lifter | Once uploaded, videos belong to the lifter permanently. Removing a partner only stops future filming. |
| 11 | Recorder copy | Fire and forget | Video uploaded to lifter's account, local temp file cleaned up. Recorder's phone is just a camera. |
| 12 | Entry point | Program page + Settings | Partner section below your program. Management also accessible from Settings. |
| 13 | Approval | In-app badge + approval screen | QR scan sends pairing request. Must be accepted. Prevents unwanted pairings if QR is shared publicly. |
| 14 | Multi-recorder | Lifter + partner (different angles) | Lifter self-records one angle while partner gets the other. Videos distinguished by `recorded_by` column — queries include it to prevent self/partner videos from shadowing each other. |
| 15 | Feature flag | `gymPartner`, default off, Advanced category | First social feature. Opt-in until stable. |
| 16 | Partner cap | Maximum 5 accepted partners | Prevents resource pressure from Realtime subscriptions and per-partner queries. Enforced as app-level guard in pairing service. |
| 17 | Display name required | Must have display_name before pairing | Partners need a name to show in the UI. Pairing service rejects if either user has null display_name. Fallback: "Partner" in edge cases where name was cleared after pairing. |

## User Flows

### Pairing (one-time setup)

1. User A opens Partner Management (Program screen header or Settings > Gym Partners)
2. Taps "Add Partner" -> QR code appears (expires in 5 minutes)
3. User B scans QR code
4. User A sees "1 pending" badge -> opens approval screen -> accepts
5. Both users now appear in each other's partner lists

### Filming for a partner

1. Recorder opens Program tab -> sees "Gym Partners" section below their own program
2. Partner card shows green dot: "Squat — Active" (realtime via Supabase sessions table)
3. Taps "Film" -> set picker shows planned sets from session -> picks camera angle (side/front) -> records
4. After recording: CV analysis runs on recorder's phone, video compresses, uploads to lifter's storage
5. Recorder sees "Uploaded" confirmation. Local file cleaned up.

### Receiving a partner video

1. Lifter sees badge on partner section: "1 new video"
2. Opens their session -> partner-recorded video appears alongside self-recorded videos
3. "Recorded by Jake" attribution label on the video
4. Taps to trigger LLM coaching -> coaching uses lifter's own training context (weight, RPE, block phase, soreness)

### Managing partners

- Program screen: tappable "Gym Partners" header -> management screen
- Settings > Gym Partners -> same management screen
- View all partners, pending requests, add new, remove existing

## Visual Design Notes

### Partner section on Program screen

```
[Your program content - week rows / unending card]

GYM PARTNERS                           [+]
├─────────────────────────────────────────┤
│ * Jake                                  │
│ Squat — Active               [Film]    │
├─────────────────────────────────────────┤
│ o Sarah                                 │
│ No active session                       │
└─────────────────────────────────────────┘
```

- Green dot = active session, dimmed = no session
- Film button enabled only when session is active
- Section always visible (for partner management access)
- "+" button in header for quick partner add

## User Benefits

**Seamless attribution**: Video goes directly to the lifter's account. No file transfers, no manual imports.

**Context-aware coaching**: Because the video is linked to the lifter's session, LLM coaching has full training context — weight, RPE, block phase, soreness, historical videos.

**Zero friction for the recorder**: Tap Film, pick the set, record. Analysis runs automatically. Fire and forget.

**Privacy-respecting**: Recorder sees minimal data (lift name + active status). Training details (weights, RPE, program) stay with the lifter — enforced at RLS level, not just query level.

## Open Questions

- [x] All questions resolved via grill-me design session (2026-03-30)

## References

- Design doc: [video-form-analysis.md](./video-form-analysis.md) — existing video analysis feature this builds on
- Spec: social-001 through social-005 — incremental implementation specs
