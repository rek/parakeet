# Spec: Flock Publish-on-Complete

**Status**: Implemented (10 Jun 2026)

**Domain**: UI / Data (orchestration)

> Phase 2 of 3. Depends on [spec-data-foundation.md](./spec-data-foundation.md).
>
> **As built:** pure deriver `modules/flock/utils/derive-headline.ts`
> (+ `__tests__/derive-headline.test.ts`, 9 cases); orchestration
> `modules/flock/application/publish-highlight.ts` exposing `publishFlockHighlight`
> (post-session) and `publishCurrentFlockHighlight` (toggle-on); fire-and-forget
> call wired into `app/(tabs)/session/complete.tsx` after `detectAchievements`.
> The toggle-on publish lives in the `useFlockSharing` mutation (Phase 3), not a
> separate hook file.

## What This Covers

The producer side: when a lifter completes a session and has sharing enabled, derive the
single best celebratory signal from data the app already computes (achievements, Wilks,
streak) and publish a sanitized `flock_highlights` row. Runs entirely on the producing
lifter's device against their own data — it never reads another lifter's tables and only
ever writes the sanitized projection. Best-effort / fire-and-forget: a publish failure must
never block or fail session completion.

## Tasks

**`apps/parakeet/src/modules/flock/application/publish-highlight.ts`:**

- [ ] `publishFlockHighlight(input: { userId; displayName; achievements; sessionId })` — orchestrates the publish:
  - Short-circuit if `getFlockConfig(userId).sharing_enabled` is false → if a stale row exists, delete it.
  - Fetch `getCurrentWilksSnapshot(userId)` from `@modules/wilks`; use **only** `wilks` (ignore `bodyweightKg`/`sex` — health-data exclusion, design #4).
  - Compute `wilks_delta` = new wilks − the `wilks` on the existing `flock_highlights` row (0 when first publish or no prior).
  - Build the headline via `deriveHeadline` (below) and upsert the row.
  - Wrap in try/catch + `captureException`; never rethrow.

**`apps/parakeet/src/modules/flock/utils/derive-headline.ts`** (pure, testable):

- [ ] `deriveHeadline(signals): { headline; headline_kind; latest_pr_lift?; latest_pr_weight_g?; latest_pr_reps? }`
  - Rank: `pr` > `wilks` (delta ≠ 0) > `streak` (milestone) > `trained` (fallback).
  - `pr`: pick the most impressive `earnedPRs` entry (prefer `estimated_1rm`); render "Squat PR — 142.5kg × 3". Populate `latest_pr_*` (weight in **grams**).
  - `wilks`: "Wilks 318 ▲ +4".
  - `streak`: "12-day streak" (only when a streak milestone was hit / `streakWeeks` present).
  - `trained`: "Trained today" / "Trained 4× this week" fallback.
  - Pure function — no I/O. All formatting (kg display, signs) lives here.
- [ ] Unit tests in `__tests__/derive-headline.test.ts`:
  - PR present → kind `pr`, correct grams + reps.
  - No PR but wilks delta +4 → kind `wilks`.
  - No PR, no delta, streak milestone → kind `streak`.
  - Nothing notable → kind `trained`.
  - Multiple signals → highest-ranked wins.

**`apps/parakeet/src/app/(tabs)/session/complete.tsx`:**

- [ ] After the existing `detectAchievements(...)` call (~line 383), add a fire-and-forget publish, mirroring the decision-replay side effect already in `session.service.ts`:
  - `import('@modules/flock').then(({ publishFlockHighlight }) => publishFlockHighlight({ userId, displayName, achievements, sessionId })).catch(captureException)`
  - Must not be `await`ed into the completion success path — completion already succeeded.

**`apps/parakeet/src/modules/flock/hooks/usePublishOnShareToggle.ts`** (or fold into the toggle mutation in Phase 3):

- [ ] When a lifter turns sharing **on**, publish immediately from their latest available signals (don't wait for the next session) so their card isn't blank. When turned **off**, call `deleteFlockHighlight`.

## Dependencies

- [spec-data-foundation.md](./spec-data-foundation.md) — tables, repository, config.
- `@modules/achievements` (`detectAchievements` result: `earnedPRs`, `streakWeeks`).
- `@modules/wilks` (`getCurrentWilksSnapshot`).
- `@modules/profile` (`display_name`).

## Notes

- Reuses already-computed achievement data from the complete screen — no extra detection pass.
- The only cross-module reads are the producer's **own** achievements/wilks. No friend data is read here.
