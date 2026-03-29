import { StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import type { LiveLandmark } from '../hooks/useLivePoseOverlay';
import { SKELETON_CONNECTIONS } from '../hooks/useLivePoseOverlay';

const LANDMARK_RADIUS = 3;
const MIN_VISIBILITY = 0.5;

/**
 * Draws a skeleton overlay on top of the camera preview.
 * Positioned absolutely over the camera view. Landmarks are in
 * normalized [0,1] coordinates from MediaPipe.
 */
export function LiveSkeletonOverlay({
  landmarks,
  width,
  height,
}: {
  landmarks: LiveLandmark[];
  width: number;
  height: number;
}) {
  if (width === 0 || height === 0) return null;

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {/* Skeleton lines */}
      {SKELETON_CONNECTIONS.map(([a, b], i) => {
        const la = landmarks[a];
        const lb = landmarks[b];
        if (
          !la || !lb ||
          la.visibility < MIN_VISIBILITY ||
          lb.visibility < MIN_VISIBILITY
        ) {
          return null;
        }
        return (
          <Line
            key={i}
            x1={la.x * width}
            y1={la.y * height}
            x2={lb.x * width}
            y2={lb.y * height}
            stroke="#14B8A6"
            strokeWidth={2}
            opacity={0.8}
          />
        );
      })}

      {/* Landmark dots — only key joints */}
      {landmarks.map((lm, i) => {
        if (lm.visibility < MIN_VISIBILITY) return null;
        return (
          <Circle
            key={i}
            cx={lm.x * width}
            cy={lm.y * height}
            r={LANDMARK_RADIUS}
            fill="#14B8A6"
            opacity={0.9}
          />
        );
      })}
    </Svg>
  );
}
