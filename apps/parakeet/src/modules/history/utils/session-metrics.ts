// @spec docs/features/history/spec-history-screen.md
import { estimateOneRepMax_Epley } from '@parakeet/training-engine';
import { weightGramsToKg } from '@shared/utils/weight';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActualSet = { weight_grams?: number; reps_completed?: number };

// ── Functions ─────────────────────────────────────────────────────────────────

export function estimateBestOneRm(actualSets: unknown): number {
  if (!Array.isArray(actualSets) || actualSets.length === 0) return 0;
  let best = 0;
  for (const s of actualSets as ActualSet[]) {
    if (
      !s.weight_grams ||
      !s.reps_completed ||
      s.reps_completed <= 0 ||
      s.reps_completed > 20
    )
      continue;
    const est = estimateOneRepMax_Epley(
      weightGramsToKg(s.weight_grams),
      s.reps_completed
    );
    if (est > best) best = est;
  }
  return best;
}

export function computeSessionVolume(actualSets: unknown): number {
  if (!Array.isArray(actualSets) || actualSets.length === 0) return 0;
  let total = 0;
  for (const s of actualSets as ActualSet[]) {
    if (!s.weight_grams || !s.reps_completed || s.reps_completed <= 0) continue;
    total += weightGramsToKg(s.weight_grams) * s.reps_completed;
  }
  return total;
}

export function computeHeaviestLift(actualSets: unknown): number {
  if (!Array.isArray(actualSets) || actualSets.length === 0) return 0;
  let heaviest = 0;
  for (const s of actualSets as ActualSet[]) {
    if (!s.weight_grams) continue;
    const kg = weightGramsToKg(s.weight_grams);
    if (kg > heaviest) heaviest = kg;
  }
  return heaviest;
}

export function getSessionJoin(
  sessions: unknown
): { intensity_type?: string } | null {
  if (!sessions) return null;
  return (Array.isArray(sessions) ? sessions[0] : sessions) as {
    intensity_type?: string;
  } | null;
}
