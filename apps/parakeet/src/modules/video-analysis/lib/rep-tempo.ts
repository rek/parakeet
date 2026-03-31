import type { BarPathPoint } from '@parakeet/shared-types';

/**
 * Compute eccentric and concentric phase durations for a rep.
 *
 * Eccentric = bar moving downward (Y increasing in MediaPipe coords)
 * Concentric = bar moving upward (Y decreasing)
 *
 * The bottom of the rep (max Y) splits the rep into eccentric (before)
 * and concentric (after) phases.
 *
 * Tempo ratio = eccentric / concentric. A ratio of 2.0 means the descent
 * takes twice as long as the ascent (typical for controlled squats).
 * Fatigued reps show decreasing tempo ratio as the concentric slows down.
 */
export function computeRepTempo({
  repPath,
  fps,
}: {
  repPath: BarPathPoint[];
  fps: number;
}) {
  if (repPath.length < 3 || fps <= 0) return null;

  // Find the bottom of the rep (max Y = lowest body position)
  let bottomIdx = 0;
  let bottomY = repPath[0].y;
  for (let i = 1; i < repPath.length; i++) {
    if (repPath[i].y > bottomY) {
      bottomY = repPath[i].y;
      bottomIdx = i;
    }
  }

  const eccentricFrames = bottomIdx;
  const concentricFrames = repPath.length - 1 - bottomIdx;

  if (eccentricFrames < 1 || concentricFrames < 1) return null;

  const eccentricDurationSec = eccentricFrames / fps;
  const concentricDurationSec = concentricFrames / fps;
  const tempoRatio = eccentricDurationSec / concentricDurationSec;

  return {
    eccentricDurationSec: Math.round(eccentricDurationSec * 100) / 100,
    concentricDurationSec: Math.round(concentricDurationSec * 100) / 100,
    tempoRatio: Math.round(tempoRatio * 100) / 100,
  };
}
