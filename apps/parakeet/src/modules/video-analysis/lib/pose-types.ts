import { z } from '@parakeet/shared-types';

/** Single landmark from MediaPipe Pose (normalized 0-1 coordinates) */
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** All 33 landmarks for one frame */
export type PoseFrame = PoseLandmark[];

/**
 * Zod schema for a pose landmark. Shared with `shared-types` to stay on the
 * same zod version as the rest of the runtime — see `coaching-cache.ts` for
 * the v3/v4 split story.
 */
export const PoseLandmarkSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  visibility: z.number(),
});

export const PoseFrameSchema = z.array(PoseLandmarkSchema);

/**
 * Stored shape for `session_videos.debug_landmarks`. Persisted once per
 * video at insert time so the playback skeleton overlay can be drawn
 * without re-running MediaPipe.
 */
export const DebugLandmarksSchema = z.object({
  frames: z.array(PoseFrameSchema),
  fps: z.number().positive(),
  extractedAt: z.string(),
});

export type DebugLandmarks = z.infer<typeof DebugLandmarksSchema>;

/** MediaPipe landmark indices relevant to powerlifting */
export const LANDMARK = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/**
 * Approximate cm per normalized MediaPipe coordinate unit.
 * Assumes ~170cm person filling 70% of frame height: 170 / 0.7 ≈ 243.
 * Phase 1 approximation — sufficient for form coaching thresholds.
 */
export const CM_PER_UNIT = 243;
