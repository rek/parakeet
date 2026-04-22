// @spec docs/features/session/spec-planned-set-display.md
import { capitalize } from '@shared/utils/string';

export function buildIntensityLabel(
  meta: {
    intensity_type: string | null;
    block_number: number | null;
  } | null
) {
  if (!meta?.intensity_type) return '';
  if (meta.block_number !== null) {
    return `Block ${meta.block_number} · ${capitalize(meta.intensity_type)}`;
  }
  return capitalize(meta.intensity_type);
}
