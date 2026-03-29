/** Single landmark from MediaPipe Pose (normalized 0-1 coordinates) */
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** All 33 landmarks for one frame */
export type PoseFrame = PoseLandmark[];

/** MediaPipe landmark indices relevant to powerlifting */
export const LANDMARK = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
} as const;
