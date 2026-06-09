// @spec docs/features/session/spec-completion.md
export interface SessionStats {
  isAuxOnly: boolean;
  totalSets: number;
  completedSets: number;
  completionPct: string;
}

export function computeSessionStats(
  actualSets: Array<{ is_completed: boolean }>,
  auxiliarySets: Array<{ is_completed: boolean; skipped?: boolean }>
): SessionStats {
  // Skipped aux sets are opted-out — drop them from both numerator and
  // denominator so a skipped set reads as resolved, not missed.
  const activeAux = auxiliarySets.filter((s) => !s.skipped);
  const isAuxOnly = actualSets.length === 0 && activeAux.length > 0;
  const totalSets = isAuxOnly ? activeAux.length : actualSets.length;
  const completedSets = isAuxOnly
    ? activeAux.filter((s) => s.is_completed).length
    : actualSets.filter((s) => s.is_completed).length;
  const completionPct =
    totalSets > 0 ? ((completedSets / totalSets) * 100).toFixed(0) : '0';
  return { isAuxOnly, totalSets, completedSets, completionPct };
}
