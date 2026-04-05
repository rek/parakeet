# social-004: Film-for-Partner Flow

**Status**: Done

**Design**: [gym-partner-filming.md](./design.md)

## What This Covers

The recorder's camera UI scoped to the lifter's session, CV analysis on the recorder's phone, direct upload to the lifter's Supabase storage, and session/set tagging. This is the core filming workflow.

## Tasks

### Partner set data fetching

**`apps/parakeet/src/modules/gym-partners/data/partner.repository.ts`:**

- [ ] `fetchPartnerSessionSets(sessionId: string): Promise<Array<{ lift: string; totalSets: number }>>`
  - Derives set count from `sessions.planned_sets` JSONB (already fetched via `fetchPartnerActiveSession` in social-003)
  - Does **NOT** query `session_logs` — no cross-user RLS on session_logs (Decision 8: minimal data visibility)
  - `planned_sets` contains structural info: `[{ weight_kg, reps, rpe_target, ... }]` — count array length for total sets
  - Alternatively, accept `plannedSets` directly from the already-fetched session data to avoid a redundant query

### Partner video insert + upload

**`apps/parakeet/src/modules/gym-partners/data/partner.repository.ts`:**

- [ ] `insertPartnerSessionVideo(params)` — like `video.repository.insertSessionVideo` but explicitly sets:
  - `user_id: targetUserId` (the lifter)
  - `recorded_by: auth.uid()` (the recorder)
  - Same fields: `session_id`, `lift`, `set_number`, `sagittal_confidence`, `local_uri`, `duration_sec`, `analysis`
  - Does NOT call `typedSupabase.auth.getUser()` for user_id — uses the passed `targetUserId`
  - RLS INSERT policy from social-001 validates: `auth.uid() = recorded_by AND user_id is an accepted partner`

**`apps/parakeet/src/modules/gym-partners/application/partner-upload.service.ts`:**

- [ ] `uploadPartnerVideo(params): Promise<string>` — uploads compressed video to Supabase Storage
  - Path: `{lifterUserId}/{videoId}.mp4` (lifter's folder, not recorder's)
  - Uses the partner storage policy from social-001 that allows partner uploads to lifter's folder
  - Returns the remote URI
  - Pattern: compress → upload to storage → update remote_uri on DB row

### Partner filming service

**`apps/parakeet/src/modules/gym-partners/application/partner-filming.service.ts`:**

- [ ] `filmForPartner(params)` — orchestrates the full pipeline:
  1. Extract pose frames via MediaPipe (`extractFramesFromVideo` from video-analysis module)
  2. Auto-detect camera angle (`detectCameraAngle` from video-analysis module)
  3. Analyze frames (`analyzeVideoFrames` from video-analysis module)
  4. Compress video (reuse `react-native-compressor` pipeline)
  5. Insert DB row via `insertPartnerSessionVideo` (with analysis JSONB)
  6. Upload to Supabase Storage via `uploadPartnerVideo` (background, best-effort)
  7. Clean up local temp file
  - Reuses pure functions from `@modules/video-analysis` — no duplication of analysis logic
  - Error handling: if DB insert succeeds but upload fails, the analysis results are persisted in the DB row's `analysis` JSONB. Show retry for upload only — analysis is not lost. The `remote_uri` stays null until upload succeeds (same pattern as self-recorded videos in `video-upload.ts`).
  - Offline edge case: if recorder has no network, DB insert fails. CV analysis results exist only in memory and are lost if the user navigates away. This is a known limitation for v1 — the recorder must have network connectivity. Document in the UI: "Requires internet connection."
  - Partnership-removed-during-filming: if the partnership status changes to `'removed'` while the pipeline is running, the RLS INSERT policy rejects the insert. Catch this error specifically and show "Partnership no longer active" instead of a generic error. Use `captureException` for all error paths (per project error handling convention).
  - All async error paths must call `captureException` + show `Alert` (per `feedback_error_handling_screens.md`)

### Partner filming hook

**`apps/parakeet/src/modules/gym-partners/hooks/usePartnerFilming.ts`:**

- [ ] `usePartnerFilming(partnerId, sessionId)` hook:
  - Accepts `plannedSets` from the already-fetched partner session data (avoids redundant query)
  - Manages filming state: `idle | recording | analyzing | uploading | done | error`
  - `startFilming(lift, setNumber)` — triggers camera (sagittalConfidence computed from landmarks)
  - `processVideo(videoUri, durationSec)` — runs analysis pipeline + upload
  - Returns: `{ sets, filmingState, startFilming, processVideo, error, retryUpload }`

### Set picker UI

**`apps/parakeet/src/modules/gym-partners/ui/PartnerSetPicker.tsx`:**

- [ ] Displays the lifter's session lifts + set numbers (derived from `planned_sets`)
  - Each lift row shows: lift name, "Set N of M" (next unrecorded set auto-selected)
  - Camera angle picker: side / front toggle
- [ ] Tapping a set + angle → proceeds to recording

### Partner filming sheet

**`apps/parakeet/src/modules/gym-partners/ui/PartnerFilmingSheet.tsx`:**

- [ ] Full-screen sheet / modal for the filming flow:
  1. Step 1: `PartnerSetPicker` — select lift, set number, angle
  2. Step 2: Recording — reuse `RecordVideoSheet` component from video-analysis module
  3. Step 3: Processing — progress indicator (analyzing → uploading)
  4. Step 4: Done — "Video uploaded to [partner name]" confirmation, auto-dismiss
- [ ] Error state: "Upload failed — Retry" button (retries storage upload only; DB row + analysis already saved)
- [ ] On complete: local temp video file cleaned up (fire and forget)

### Wire Film button

**`apps/parakeet/src/modules/gym-partners/ui/PartnerCard.tsx`:**

- [ ] "Film" button onPress → opens `PartnerFilmingSheet` with partnerId + sessionId + plannedSets

### Barrel exports

**`apps/parakeet/src/modules/gym-partners/index.ts`:**

- [ ] Export: `usePartnerFilming`, `PartnerFilmingSheet`
- [ ] Do NOT export `PartnerSetPicker` — internal UI detail of the filming sheet

## Dependencies

- [social-003-partner-session-visibility.md](./social-003-partner-session-visibility.md) — partner cards with active session, Film button
