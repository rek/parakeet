// @spec docs/features/session/spec-planned-set-display.md
export function buildBlockWeekLabel(
  meta: {
    primary_lift: string | null;
    block_number: number | null;
    week_number: number;
  } | null
) {
  if (!meta || !meta.primary_lift) return '';
  if (meta.block_number !== null) {
    return `Block ${meta.block_number} · Week ${meta.week_number}`;
  }
  return `Week ${meta.week_number}`;
}
