---
feature: video-analysis
status: phases-1-and-2-shipped
owner: Adam
last_updated: 2026-04-19
---
# Design — Local-Only Video Storage

**Roadmap status**

- **Phase 0 (hardening)** — shipped 2026-04-18. 0-byte upload bug fixed via `arrayBuffer()` conversion; guard + Sentry breadcrumb in place.
- **Phase 1 (stop new uploads)** — shipped 2026-04-19. `uploadVideoToStorage` + `uploadPartnerVideo` call sites and service files deleted. `remote_uri` is no longer written on new rows. Audit confirmed no consumer reads `remote_uri` for playback — partner-video cross-device display was broken before this change, not broken by it. Legacy rows retain their URIs for eventual cleanup.
- **Phase 2 (UI for local-only state)** — shipped 2026-04-19. `VideoPlayerCard` probes `File.exists` and shows a "Video recorded on another device" placeholder when the local file is absent (e.g. partner-recorded videos arriving on the lifter's phone). Overlays gate off the same flag so no SVG paints over a blank wrapper.
- **Phase 3 (legacy row cleanup)** — not yet scheduled. Deferred per the original plan: a backfill clearing ghost `remote_uri` values on 0-byte Storage rows, with a 6-month soak before dropping the column + bucket.

Move away from uploading raw video bytes to Supabase Storage. Keep videos on the phone; cloud only persists the analysis results (metrics, pose landmarks, coaching output) which are small, structured, and already reliable.

## Context

**Trigger incident (2026-04-17):** A deadlift recorded in prod landed in `session_videos` with `remote_uri` populated — but the Storage object was 0 bytes. Investigation found expo-file-system's `File` class declares `implements Blob` but its JS shim doesn't expose Blob body/size, so `supabase.storage.upload(path, file, …)` silently uploaded zero bytes every time. Patched by reading to `ArrayBuffer` first (`application/video-upload.ts`, `modules/gym-partners/application/partner-upload.service.ts`), but the episode exposed that the upload path is fragile and the value it delivers is low.

**Costs:** Storage quota, per-MB egress, privacy surface (body-on-video in a third-party system), PII exposure beyond what is necessary for the product.

**Value delivered by uploads today:** access from a second device (rare), durability if phone lost (accepted risk per CLAUDE memory `feedback_pii_accepted.md` scope — we accept the tradeoff). Neither is load-bearing for the strength-training product loop.

## What's Actually Needed In The Cloud

For the product to work across sessions, across lifts, and across time, the cloud needs:

1. **`session_videos` row** — identity, lift, set linkage, timestamps.
2. **`analysis` JSONB** — rep count, per-rep metrics, faults, verdicts.
3. **`coaching_response` JSONB** — LLM coaching output.
4. **`debug_landmarks` JSONB** (dev builds) — PoseFrame[] for calibration replay.
5. **`sagittal_confidence`** + **`set_weight_grams`/`set_reps`/`set_rpe`** — set context.

All of this is small structured JSON. None of it is the video bytes.

## What Does NOT Need The Cloud

- The raw `.mp4` file. If the user wants to watch the video, they tap the row on the device that recorded it. If the phone is gone, the form analysis *results* are still there and still useful (metrics, coaching, trend).

## Proposed State

1. **Delete `uploadVideoToStorage` call site.** Keep `local_uri` in `session_videos`; stop writing `remote_uri` for new rows.
2. **Drop the `session-videos` bucket** after migration period (6 months).
3. **Landmarks replay stays cloud-resident.** `debug_landmarks` JSONB is how calibration scripts (`scripts/pull-device-analysis.ts`) feed the test harness — that workflow keeps working without the video file.
4. **If the user ever needs the raw video off-device** (e.g. laptop review), they AirDrop / USB / manual transfer. Rare workflow, not product-critical.
5. **Gym-partner flow:** see open question below — this is the one real use case that needs cloud transfer.

## Migration Plan (Phased)

### Phase 0 — Short-term hardening (done)
- [x] Fix 0-byte upload via `arrayBuffer()` conversion (2026-04-18).
- [x] Guard against empty local file with Sentry breadcrumb.

### Phase 1 — Stop new uploads (1 PR)
- Remove `uploadVideoToStorage` call from `useVideoAnalysis.ts:166`.
- Remove `uploadPartnerVideo` call from partner video save flow (pending gym-partner resolution).
- Keep `remote_uri` column nullable; stop writing to it.
- Delete `application/video-upload.ts` and `modules/gym-partners/application/partner-upload.service.ts` if no remaining callers.
- Feature flag opt-out so we can flip back quickly if the gym-partner story forces it.

### Phase 2 — Surface local-only state in UI (1 PR)
- Video player shows local file only; if `local_uri` missing (app reinstall, different device), show "Video recorded on another device" with a retry-record CTA.
- Backlog UI polish for "recorded elsewhere" state.

### Phase 3 — Clean up legacy Storage rows (1 PR)
- Backfill script: for rows with `remote_uri != null` AND Storage object > 0 bytes, leave alone (legacy viewable).
- For rows with `remote_uri != null` AND Storage object = 0 bytes (the broken rows), clear `remote_uri`. These are the ghost-uploads from the bug.
- DB-only change, no UI impact.

### Phase 4 — Delete bucket (after 6-month soak)
- Confirm no reader code references `remote_uri`.
- `DROP TABLE session_videos` column `remote_uri` in a migration.
- Delete the `session-videos` bucket in Supabase dashboard.

## Gym Partner Flow (Open Question)

This is the only real use case for cloud video transfer: partner records on their phone, lifter wants to see it on their phone.

Options:
- **A — Keep Storage only for partner uploads.** Carve out: lifter's own videos are local; partner videos go through Storage as today. Preserves cross-device path where it's load-bearing. Low complexity, retains the upload code in one place.
- **B — Peer-to-peer transfer.** AirDrop / local Wi-Fi / React Native Bluetooth → zero cloud. Adds native complexity, worse UX when partners aren't colocated.
- **C — Analysis-only sharing.** Partner's device runs MediaPipe + analysis locally, only the `analysis` JSONB flows to the lifter's row via a normal row insert. Lifter never sees the raw video; they see metrics + coaching from the partner's footage. Arguably this is the correct design — partners are there to give the lifter feedback, not watch each other's squat form.

**Recommend Option C long-term, Option A short-term.** Option C aligns with "what actually needs to be in the cloud" principle above and removes the last reason to ship video bytes over the network.

## Risks

- **Device loss = video loss.** Accepted. Analysis results, coaching, and metrics survive because they're in Postgres.
- **App reinstall wipes `document`.** Accepted. Same mitigation — analysis survives. Optionally warn user before reinstall if unsent data detected.
- **"Show me that deadlift from 6 months ago" across devices.** Won't work without manual transfer. Accepted given how rarely this happens in practice.
- **Gym partner regression.** If we ship Phase 1 without a partner story, received-video feature breaks. Gate Phase 1 on Option A or C landing first.

## Non-Goals

- Real-time streaming to cloud during recording.
- Video sharing / social features.
- Multi-device mirroring.

## Related

- `feedback_pii_accepted.md` (memory) — PII risks are accepted, but principle of minimal cloud footprint still applies.
- `design-form-analysis.md` — the analysis pipeline this plan preserves.
- `spec-set-linking.md` — set-level linkage stays unchanged.
- `spec-pipeline.md` — update to reflect local-only once Phase 1 ships.

## Status Log

- **2026-04-18** — Plan drafted after 0-byte upload bug discovery. Not implemented. Hardened current upload path as stopgap.
- **2026-04-19** — Phase 1 + Phase 2 shipped (backlog #17). Audit showed `remote_uri` was write-only in the current codebase — nothing ever read it for playback. Rip was a pure simplification. Phase 2's missing-file placeholder also fixes the silent black-frame bug that partner-recorded videos were already hitting on the lifter's phone.
