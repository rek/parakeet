// @spec docs/features/video-analysis/spec-reanalyze.md
import type { VideoAnalysisResult } from '@parakeet/shared-types';

import {
  checkLiftMismatch,
  type LiftMismatch,
} from '../lib/check-lift-mismatch';
import type { PoseFrame } from '../lib/pose-types';
import {
  isSupportedLift,
  SUPPORTED_LIFTS,
  type SupportedLift,
} from '../lib/supported-lifts';
import type { SessionVideo } from '../model/types';

// Re-export so existing callers that import these from `application/reanalyze`
// keep working. `lib/supported-lifts.ts` is the single source of truth.
export { SUPPORTED_LIFTS, isSupportedLift };
export type { SupportedLift };

export interface ReanalyzeDeps {
  fileExists: (uri: string) => boolean;
  getVideoDurationSec: (uri: string) => Promise<number | null>;
  extractFrames: (args: {
    videoUri: string;
    durationSec: number;
    onProgress?: (pct: number) => void;
  }) => Promise<{ frames: PoseFrame[]; fps: number }>;
  analyze: (args: {
    frames: PoseFrame[];
    fps: number;
    lift: SupportedLift;
  }) => VideoAnalysisResult;
  update: (args: {
    id: string;
    analysis: VideoAnalysisResult;
  }) => Promise<SessionVideo>;
  saveDebugLandmarks?: (args: {
    id: string;
    frames: PoseFrame[];
    fps: number;
  }) => Promise<void> | void;
  onProgress?: (pct: number) => void;
  onBreadcrumb?: (step: string, data?: Record<string, unknown>) => void;
  /**
   * Fired when the pose classifier is confident the video shows a different
   * lift than the one the user declared. Non-blocking — analysis continues
   * either way. Callers typically wire this to a user-facing Alert.
   */
  onLiftMismatch?: (mismatch: LiftMismatch) => void;
}

/**
 * Re-run pose extraction and analysis against an existing session_videos row
 * and persist the refreshed analysis to the database.
 *
 * Pure orchestration — no React, no native modules. All side effects are
 * injected via `deps`. Makes the flow trivially testable against a real
 * Supabase instance (see reanalyze.test.ts) without a device in the loop.
 *
 * Throws with a specific message at every branch so the caller can surface
 * a useful error; returns the updated SessionVideo on success.
 */
export async function reanalyzeSessionVideo({
  result,
  lift,
  deps,
}: {
  result: SessionVideo;
  lift: string;
  deps: ReanalyzeDeps;
}): Promise<SessionVideo> {
  const bc = deps.onBreadcrumb ?? (() => undefined);

  if (!isSupportedLift(lift)) {
    throw new Error(`Re-analyze not supported for lift "${lift}"`);
  }

  if (!deps.fileExists(result.localUri)) {
    throw new Error(`Local video file missing (${result.localUri})`);
  }

  let durationSec = result.durationSec;
  try {
    const probed = await deps.getVideoDurationSec(result.localUri);
    if (probed != null && probed > 0) durationSec = probed;
  } catch (err) {
    bc('duration-probe-failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  if (durationSec <= 0) {
    throw new Error(`Invalid video duration: ${durationSec}s`);
  }
  bc('extract-start', { durationSec, lift });

  deps.onProgress?.(0.05);
  const { frames, fps } = await deps.extractFrames({
    videoUri: result.localUri,
    durationSec,
    onProgress: (p) => deps.onProgress?.(0.05 + p * 0.8),
  });
  bc('extract-done', { frameCount: frames.length, fps });

  if (frames.length === 0) {
    throw new Error('Pose extraction produced 0 frames');
  }

  if (deps.onLiftMismatch) {
    const mismatch = checkLiftMismatch({ frames, declared: lift });
    // Telemetry for the mismatch is emitted by the caller (via the
    // onLiftMismatch callback) so both processVideo and reanalyze flows
    // surface the same `lift-label-mismatch` / `detected` breadcrumb in
    // Sentry. Keeping it out of the orchestrator avoids double-counting.
    if (mismatch) deps.onLiftMismatch(mismatch);
  }

  const analysis = deps.analyze({ frames, fps, lift });
  bc('analyze-done', {
    reps: analysis.reps.length,
    version: analysis.analysisVersion,
  });

  const updated = await deps.update({ id: result.id, analysis });
  bc('db-update-ok', {
    id: updated.id,
    repsReturned: updated.analysis?.reps.length ?? 0,
  });

  if (deps.saveDebugLandmarks) {
    try {
      await deps.saveDebugLandmarks({ id: result.id, frames, fps });
    } catch (err) {
      bc('debug-landmarks-save-failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  deps.onProgress?.(1);
  return updated;
}
