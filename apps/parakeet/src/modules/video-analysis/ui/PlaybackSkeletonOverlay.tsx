// @spec docs/features/video-analysis/spec-playback-overlay.md
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import Svg, { Circle, Line } from 'react-native-svg';

import type { ColorScheme } from '../../../theme';
import type { PoseFrame } from '../lib/pose-types';
import { SKELETON_CONNECTIONS } from '../lib/skeleton-connections';
import { lerpPoseFrame } from '../lib/skeleton-lerp';
import type { VideoDisplayRect } from '../lib/video-display-rect';

const LANDMARK_RADIUS = 3;
const BONE_STROKE_WIDTH = 2;
const MIN_VISIBILITY = 0.5;

/**
 * Draws the lifter's skeleton on top of `<VideoView>` during playback.
 *
 * Landmarks are stored at the analysis fps (3–4 fps) but video plays at
 * 30 fps, so we lerp between the two nearest stored frames on every tick
 * of `currentTime`. Visibility is NOT lerped — a partially-occluded joint
 * would otherwise flicker in and out mid-rep.
 *
 * Positioned absolutely at the parent-provided `displayRect` so it lines
 * up with the actual video pixels, not the container (important under
 * `contentFit="contain"` letterboxing — same constraint as the bar path
 * overlay).
 */
export function PlaybackSkeletonOverlay({
  frames,
  fps,
  currentTime,
  displayRect,
  colors,
}: {
  frames: PoseFrame[];
  fps: number;
  currentTime: number;
  displayRect: VideoDisplayRect;
  colors: ColorScheme;
}) {
  const pose = useMemo(
    () => lerpPoseFrame({ frames, fps, currentTime }),
    [frames, fps, currentTime]
  );

  const { width, height, offsetX, offsetY } = displayRect;
  if (width <= 0 || height <= 0) return null;
  if (!pose) return null;

  return (
    <Svg
      width={width}
      height={height}
      style={[styles.absolute, { left: offsetX, top: offsetY, width, height }]}
      pointerEvents="none"
    >
      {SKELETON_CONNECTIONS.map(([a, b], i) => {
        const la = pose[a];
        const lb = pose[b];
        if (
          !la ||
          !lb ||
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
            stroke={colors.info}
            strokeWidth={BONE_STROKE_WIDTH}
            opacity={0.8}
          />
        );
      })}

      {pose.map((lm, i) => {
        if (lm.visibility < MIN_VISIBILITY) return null;
        return (
          <Circle
            key={i}
            cx={lm.x * width}
            cy={lm.y * height}
            r={LANDMARK_RADIUS}
            fill={colors.info}
            opacity={0.9}
          />
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
  },
});
