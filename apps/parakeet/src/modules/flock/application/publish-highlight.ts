// @spec docs/features/flock/spec-publish.md
import { getStreakData, type AchievementResult } from '@modules/achievements';
import { getProfile } from '@modules/profile';
import { getCurrentWilksSnapshot } from '@modules/wilks';
import { captureException } from '@platform/utils/captureException';

import {
  deleteFlockHighlight,
  getFlockSharing,
  getPublishedWilks,
  upsertFlockHighlight,
} from '../data/flock.repository';
import type { FlockHighlightInput } from '../model/flock.types';
import { deriveHeadline, type HeadlinePR } from '../utils/derive-headline';

/**
 * Build the sanitized highlight payload from the producer's OWN data only
 * (profile name + Wilks + streak + this session's PRs). Reads no friend data.
 * Returns null when there's no display name to attach to a card.
 */
async function buildInput(
  userId: string,
  earnedPRs: HeadlinePR[],
  streakWeeks: number | null
): Promise<FlockHighlightInput | null> {
  const profile = await getProfile();
  const displayName = profile?.display_name;
  if (!displayName) return null;

  const [snapshot, previousWilks] = await Promise.all([
    getCurrentWilksSnapshot(userId),
    getPublishedWilks(userId),
  ]);

  const wilks = snapshot?.wilks ?? null;
  const wilksDelta =
    wilks !== null && previousWilks !== null ? wilks - previousWilks : null;

  const headline = deriveHeadline({
    earnedPRs,
    wilks,
    wilksDelta,
    streakWeeks,
  });

  return {
    displayName,
    headline: headline.headline,
    headlineKind: headline.headlineKind,
    latestPrLift: headline.latestPrLift,
    latestPrWeightG: headline.latestPrWeightG,
    latestPrReps: headline.latestPrReps,
    wilks,
    wilksDelta,
    streakWeeks,
  };
}

/** Publish when sharing is on; otherwise clear any stale card. Best-effort. */
async function publishIfSharing(
  userId: string,
  build: () => Promise<FlockHighlightInput | null>
): Promise<void> {
  try {
    if (!(await getFlockSharing(userId))) {
      await deleteFlockHighlight(userId);
      return;
    }
    const input = await build();
    if (!input) return;
    await upsertFlockHighlight(userId, input, new Date().toISOString());
  } catch (err) {
    captureException(err);
  }
}

/**
 * Publish a highlight after a completed session, reusing the already-computed
 * achievement result. Fire-and-forget — never throws, never blocks completion.
 */
export async function publishFlockHighlight(params: {
  userId: string;
  achievements: AchievementResult;
}): Promise<void> {
  const prs: HeadlinePR[] = params.achievements.earnedPRs.map((p) => ({
    type: p.type,
    lift: p.lift,
    value: p.value,
    weightKg: p.weightKg,
  }));
  await publishIfSharing(params.userId, () =>
    buildInput(params.userId, prs, params.achievements.streakWeeks)
  );
}

/**
 * Publish from current standing signals (no session PRs) — used when a lifter
 * turns sharing on so their card isn't blank until the next session.
 */
export async function publishCurrentFlockHighlight(
  userId: string
): Promise<void> {
  const streak = await getStreakData(userId);
  await publishIfSharing(userId, () =>
    buildInput(
      userId,
      [],
      streak.currentStreak > 0 ? streak.currentStreak : null
    )
  );
}
