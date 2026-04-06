# social-005: Received Video Integration

**Status**: Done

**Design**: [gym-partner-filming.md](./design.md)

## What This Covers

In-app badge for new partner-recorded videos, attribution label on video display, and verification that LLM coaching works seamlessly on partner-recorded videos. The lifter's experience of receiving and using partner-recorded videos.

## Tasks

### Partner video badge tracking

**`apps/parakeet/src/modules/gym-partners/lib/partner-video-tracking.ts`:**

- [x] `getLastSeenPartnerVideoTimestamp(): Promise<string | null>` — reads from AsyncStorage
- [x] `setLastSeenPartnerVideoTimestamp(timestamp: string): Promise<void>` — writes to AsyncStorage
  - Key: `LAST_SEEN_PARTNER_VIDEO_KEY` constant (value: `@parakeet/lastSeenPartnerVideo`) — extract to named constant, not magic string
  - Timestamp is ISO string of the most recent partner video `created_at` the user has seen
- [ ] Unit tests with AsyncStorage mock

### Partner video count query

**`apps/parakeet/src/modules/gym-partners/data/partner.repository.ts`:**

- [x] `fetchUnseenPartnerVideoCount(sinceTimestamp: string | null): Promise<number>`
  - Queries `session_videos` where `user_id = auth.uid()` AND `recorded_by IS NOT NULL` AND `created_at > sinceTimestamp`
  - If `sinceTimestamp` is null, counts all partner-recorded videos
  - This query lives in the gym-partners module (not video-analysis) because it's gym-partner-specific badge logic

### Partner video badge hook

**`apps/parakeet/src/modules/gym-partners/hooks/usePartnerVideoBadge.ts`:**

- [x] `usePartnerVideoBadge()` hook:
  - Reads `lastSeenTimestamp` from AsyncStorage on mount
  - Calls `fetchUnseenPartnerVideoCount(lastSeenTimestamp)` via `useQuery`
  - Returns `{ count: number, markAsSeen: () => void }`
  - `markAsSeen()` updates AsyncStorage with current timestamp, invalidates the count query
  - Realtime subscription on `session_videos` INSERTs where `user_id = auth.uid()` and `recorded_by IS NOT NULL` — invalidates count query on new inserts to update badge count live
  - Note: `session_videos` needs to be in the Realtime publication. Add to social-001 migration if not already:
    ```sql
    alter publication supabase_realtime add table session_videos;
    ```

### Badge rendering on partner section

**`apps/parakeet/src/modules/gym-partners/ui/PartnerSection.tsx`:**

- [x] Show badge count from `usePartnerVideoBadge()` on the section header
  - Red dot with count (e.g., "2") if count > 0
  - No badge if count = 0
- [x] Navigating to a session detail should call `markAsSeen()` (or mark seen per-session if more granular tracking is desired later)

### Attribution on video display

**`apps/parakeet/src/modules/video-analysis/model/types.ts`:**

- [x] Add to `SessionVideo` interface:
  - `recordedBy: string | null` — profile ID of the recorder
  - `recordedByName: string | null` — display_name of the recorder (from joined profiles); fallback to `'Partner'` when null

**`apps/parakeet/src/modules/video-analysis/data/video.repository.ts`:**

- [x] Update all `session_videos` queries to left join `profiles` on `recorded_by`:
  - `select('*, recorded_by_profile:profiles!session_videos_recorded_by_fkey(display_name)')` or equivalent
  - Handle the join result in `toSessionVideo` mapper
- [x] Update `toSessionVideo` to populate `recordedBy` and `recordedByName` from the joined profile
  - `recordedBy: row.recorded_by ?? null`
  - `recordedByName: row.recorded_by ? (row.recorded_by_profile?.display_name ?? 'Partner') : null`

**`apps/parakeet/src/modules/video-analysis/ui/VideoPlayerCard.tsx`:**

- [x] When `recordedByName` is set, show attribution label below the video:
  - "Recorded by Jake" in secondary/muted text (13px, theme.colors.textSecondary)
  - Only shown when `recordedByName` is not null

### Multi-recorder video query handling

**`apps/parakeet/src/modules/video-analysis/data/video.repository.ts`:**

- [x] Update `getVideoForSessionLift` to handle multi-recorder case:
  - Current: `LIMIT 1` returns only the most recent video for a session/lift/set — this would shadow one of two videos when both lifter and partner record the same set
  - Change: return all videos for the session/lift/set (remove `LIMIT 1`, remove `maybeSingle()`, return array)
  - Alternatively: add a new query `getVideosForSessionLiftSet` that returns all videos, and update callers to handle multiple
  - UI should show both videos with "Recorded by" attribution (self-recorded shows no label, partner-recorded shows partner name)
- [x] Update `getVideosForLift` — already returns arrays, no change needed. Partner videos are included via `user_id` filter (lifter's ID).

### Coaching verification

No code changes needed — verify the following work correctly:

- [x] `useFormCoaching` generates coaching for partner-recorded videos
  - Partner-recorded videos have `user_id = lifter`, so `assembleCoachingContext` fetches the lifter's session data (weight, RPE, block, soreness)
  - The `recorded_by` field is irrelevant to coaching
- [x] `usePreviousVideos` includes partner-recorded videos in longitudinal comparison
  - Queries by `lift` — partner videos have the lifter's `user_id`, so they appear normally
- [x] Personal baseline computation (`computePersonalBaseline`) includes partner-recorded videos
  - Same reason — baselines query by user_id + lift, partner videos are included

### Barrel exports

**`apps/parakeet/src/modules/gym-partners/index.ts`:**

- [x] Export: `usePartnerVideoBadge`

## Dependencies

- [social-004-film-for-partner.md](./social-004-film-for-partner.md) — partner-recorded videos exist in the database
