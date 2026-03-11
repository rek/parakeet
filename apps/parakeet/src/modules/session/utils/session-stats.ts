export interface SessionStats {
  isAuxOnly: boolean;
  totalSets: number;
  completedSets: number;
  completionPct: string;
}

export function computeSessionStats(
  actualSets: Array<{ is_completed: boolean }>,
  auxiliarySets: Array<{ is_completed: boolean }>
): SessionStats {
  const isAuxOnly = actualSets.length === 0 && auxiliarySets.length > 0;
  const totalSets = isAuxOnly ? auxiliarySets.length : actualSets.length;
  const completedSets = isAuxOnly
    ? auxiliarySets.filter((s) => s.is_completed).length
    : actualSets.filter((s) => s.is_completed).length;
  const completionPct =
    totalSets > 0 ? ((completedSets / totalSets) * 100).toFixed(0) : '0';
  return { isAuxOnly, totalSets, completedSets, completionPct };
}
