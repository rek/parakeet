import { useCallback, useState } from 'react';

import {
  Delegate,
  KnownPoseLandmarks,
  RunningMode,
  usePoseDetection,
} from 'react-native-mediapipe';
import type { PoseDetectionResultBundle } from 'react-native-mediapipe';

/** MediaPipe pose landmarker model bundled in android assets. */
const POSE_MODEL = 'pose_landmarker_lite.task';

/** Landmarks to draw as skeleton lines (pairs of landmark indices). */
export const SKELETON_CONNECTIONS = [
  // Torso
  [KnownPoseLandmarks.leftShoulder, KnownPoseLandmarks.rightShoulder],
  [KnownPoseLandmarks.leftShoulder, KnownPoseLandmarks.leftHip],
  [KnownPoseLandmarks.rightShoulder, KnownPoseLandmarks.rightHip],
  [KnownPoseLandmarks.leftHip, KnownPoseLandmarks.rightHip],
  // Left arm
  [KnownPoseLandmarks.leftShoulder, KnownPoseLandmarks.leftElbow],
  [KnownPoseLandmarks.leftElbow, KnownPoseLandmarks.leftWrist],
  // Right arm
  [KnownPoseLandmarks.rightShoulder, KnownPoseLandmarks.rightElbow],
  [KnownPoseLandmarks.rightElbow, KnownPoseLandmarks.rightWrist],
  // Left leg
  [KnownPoseLandmarks.leftHip, KnownPoseLandmarks.leftKnee],
  [KnownPoseLandmarks.leftKnee, KnownPoseLandmarks.leftAnkle],
  // Right leg
  [KnownPoseLandmarks.rightHip, KnownPoseLandmarks.rightKnee],
  [KnownPoseLandmarks.rightKnee, KnownPoseLandmarks.rightAnkle],
] as const;

export interface LiveLandmark {
  x: number;
  y: number;
  visibility: number;
}

/**
 * Hook for real-time pose estimation during video recording.
 *
 * Uses react-native-mediapipe's usePoseDetection with LIVE_STREAM mode
 * and a vision-camera frame processor. Returns the latest landmarks
 * and the frame processor to attach to a Camera component.
 *
 * The landmarks update at ~15fps (controlled by fpsMode) to balance
 * accuracy with GPU thermal management during recording.
 */
export function useLivePoseOverlay() {
  const [landmarks, setLandmarks] = useState<LiveLandmark[] | null>(null);

  const onResults = useCallback((result: PoseDetectionResultBundle) => {
    const poseLandmarks = result.results[0]?.landmarks[0];
    if (poseLandmarks && poseLandmarks.length >= 33) {
      setLandmarks(
        poseLandmarks.map((lm) => ({
          x: lm.x,
          y: lm.y,
          visibility: lm.visibility ?? 0,
        }))
      );
    }
  }, []);

  const onError = useCallback(() => {
    // Silently handle detection errors during live preview —
    // a dropped frame is not worth surfacing to the user.
    setLandmarks(null);
  }, []);

  // Use CPU delegate — GPU delegate causes native SIGSEGV crashes in
  // MediaPipe's GL runner thread on some devices (null pointer dereference
  // in mediapipe_gl_ru). CPU is slightly slower but stable.
  // extractFramesFromVideo also uses CPU-only for the same reason.
  const solution = usePoseDetection(
    { onResults, onError },
    RunningMode.LIVE_STREAM,
    POSE_MODEL,
    {
      delegate: Delegate.CPU,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      fpsMode: 15,
    }
  );

  return {
    landmarks,
    frameProcessor: solution.frameProcessor,
    cameraViewLayoutChangeHandler: solution.cameraViewLayoutChangeHandler,
    cameraDeviceChangeHandler: solution.cameraDeviceChangeHandler,
    cameraOrientationChangedHandler: solution.cameraOrientationChangedHandler,
  };
}
