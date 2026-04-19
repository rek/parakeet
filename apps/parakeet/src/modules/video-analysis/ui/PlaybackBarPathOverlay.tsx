import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { VideoAnalysisResult } from '@parakeet/shared-types';
import Svg, { Circle, G, Polyline, Text as SvgText } from 'react-native-svg';

import {
  buildRepPalette,
  findActiveRep,
  pickHeadDot,
  repColor,
} from '../lib/playback-overlay-math';
import type { VideoDisplayRect } from '../lib/video-display-rect';
import type { ColorScheme } from '../../../theme';

const HEAD_DOT_RADIUS = 6;
const HEAD_DOT_STROKE = 2;
const PATH_STROKE_WIDTH = 2;
const REP_LABEL_OFFSET = 8;
const REP_LABEL_FONT_SIZE = 10;

/**
 * Bar path overlay drawn on top of `<VideoView>` during playback.
 *
 * Renders one polyline per rep (in a per-rep colour) plus a head dot at the
 * bar position for the current playback frame. The dot only appears while
 * the playhead is inside a rep window — between reps there is no bar
 * movement to track.
 *
 * Positioned absolutely; the parent provides the display rect so the SVG
 * matches the video pixels rather than the container (important under
 * `contentFit="contain"` letterboxing).
 */
export function PlaybackBarPathOverlay({
  analysis,
  currentTime,
  displayRect,
  colors,
}: {
  analysis: VideoAnalysisResult;
  currentTime: number;
  displayRect: VideoDisplayRect;
  colors: ColorScheme;
}) {
  const palette = useMemo(() => buildRepPalette(colors), [colors]);
  const { width, height, offsetX, offsetY } = displayRect;
  if (width <= 0 || height <= 0) return null;
  if (analysis.reps.length === 0) return null;

  const currentFrame = currentTime * analysis.fps;
  const activeRep = findActiveRep({ reps: analysis.reps, currentFrame });
  const headDot = activeRep
    ? pickHeadDot({ barPath: activeRep.barPath, currentFrame })
    : null;
  const headColor = activeRep ? repColor(activeRep.repNumber, palette) : null;

  return (
    <Svg
      width={width}
      height={height}
      style={[
        styles.absolute,
        { left: offsetX, top: offsetY, width, height },
      ]}
      pointerEvents="none"
    >
      {analysis.reps.map((rep) => {
        if (rep.barPath.length === 0) return null;
        const color = repColor(rep.repNumber, palette);
        const polylinePoints = rep.barPath
          .map((p) => `${p.x * width},${p.y * height}`)
          .join(' ');
        const start = rep.barPath[0];
        return (
          <G key={rep.repNumber}>
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth={PATH_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
            <SvgText
              x={start.x * width + REP_LABEL_OFFSET}
              y={start.y * height - REP_LABEL_OFFSET}
              fontSize={REP_LABEL_FONT_SIZE}
              fontWeight="bold"
              fill={color}
              stroke={colors.bg}
              strokeWidth={0.5}
            >
              {`R${rep.repNumber}`}
            </SvgText>
          </G>
        );
      })}

      {headDot && headColor && (
        <Circle
          cx={headDot.x * width}
          cy={headDot.y * height}
          r={HEAD_DOT_RADIUS}
          fill={headColor}
          stroke={colors.text}
          strokeWidth={HEAD_DOT_STROKE}
        />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
  },
});
