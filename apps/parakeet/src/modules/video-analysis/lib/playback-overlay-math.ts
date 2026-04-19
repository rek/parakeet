import type { BarPathPoint, RepAnalysis } from '@parakeet/shared-types';

import type { ColorScheme } from '../../../theme';

/**
 * Build the per-rep colour palette from theme tokens. Six semantic hues so
 * each rep in a typical set gets a distinct colour without wrap-around for
 * 1-6 reps. Avoids pure danger/success at adjacent indices to stay readable
 * against arbitrary video backgrounds.
 */
export function buildRepPalette(colors: ColorScheme): readonly string[] {
  return [
    colors.primary, // lime
    colors.secondary, // orange
    colors.info, // teal
    colors.warning, // amber
    colors.success, // green
    colors.danger, // red
  ] as const;
}

export function repColor(repNumber: number, palette: readonly string[]): string {
  // Rep numbers are 1-indexed in source data
  const idx = Math.max(0, repNumber - 1) % palette.length;
  return palette[idx];
}

/**
 * Find the rep whose [startFrame, endFrame] window contains the given frame.
 * Returns null when the playhead is between reps or outside any rep window.
 */
export function findActiveRep({
  reps,
  currentFrame,
}: {
  reps: RepAnalysis[];
  currentFrame: number;
}): RepAnalysis | null {
  for (const rep of reps) {
    if (currentFrame >= rep.startFrame && currentFrame <= rep.endFrame) {
      return rep;
    }
  }
  return null;
}

/**
 * Pick the bar path point closest to the given frame. Returns null if the
 * path is empty. Bar paths are typically subsampled at the analysis FPS, so
 * the closest stored frame is "good enough" — no interpolation needed for
 * the head-dot indicator.
 */
export function pickHeadDot({
  barPath,
  currentFrame,
}: {
  barPath: BarPathPoint[];
  currentFrame: number;
}): BarPathPoint | null {
  if (barPath.length === 0) return null;
  let best = barPath[0];
  let bestDist = Math.abs(best.frame - currentFrame);
  for (let i = 1; i < barPath.length; i++) {
    const dist = Math.abs(barPath[i].frame - currentFrame);
    if (dist < bestDist) {
      best = barPath[i];
      bestDist = dist;
    }
  }
  return best;
}
