/**
 * Display rect of a video inside a container under `contentFit="contain"`.
 * Origin (0, 0) is the container's top-left.
 */
export interface VideoDisplayRect {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Compute where the video pixels actually land inside its container when the
 * player uses `contentFit="contain"`. The video is letterboxed (top/bottom
 * bars) or pillarboxed (left/right bars) depending on aspect-ratio mismatch.
 *
 * Overlays drawn in normalised 0..1 video coordinates must scale to the
 * returned `width × height` and translate by `offsetX / offsetY`, otherwise
 * landmarks drift off the body into the letterbox bars.
 *
 * Falls back to the container rect when video dimensions are unknown — the
 * caller should surface a sub-label warning that overlay alignment may be off.
 */
export function computeDisplayRect({
  containerWidth,
  containerHeight,
  videoWidthPx,
  videoHeightPx,
}: {
  containerWidth: number;
  containerHeight: number;
  videoWidthPx: number | null;
  videoHeightPx: number | null;
}): VideoDisplayRect {
  if (
    videoWidthPx == null ||
    videoHeightPx == null ||
    videoWidthPx <= 0 ||
    videoHeightPx <= 0 ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    return {
      width: containerWidth,
      height: containerHeight,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const videoAspect = videoWidthPx / videoHeightPx;
  const containerAspect = containerWidth / containerHeight;

  if (videoAspect > containerAspect) {
    // Video is wider than container — letterbox top/bottom
    const width = containerWidth;
    const height = containerWidth / videoAspect;
    return {
      width,
      height,
      offsetX: 0,
      offsetY: (containerHeight - height) / 2,
    };
  }

  // Video is taller (or equal) — pillarbox left/right
  const height = containerHeight;
  const width = containerHeight * videoAspect;
  return {
    width,
    height,
    offsetX: (containerWidth - width) / 2,
    offsetY: 0,
  };
}
