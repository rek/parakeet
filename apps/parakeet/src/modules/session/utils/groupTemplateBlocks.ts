import type { AuxiliaryActualSet } from '../store/sessionStore';

/**
 * Group template-inserted aux entries by their `template_instance_id`,
 * preserving the round-by-round insertion order. AuxTemplateBlock renders
 * each block as a single interleaved card so HIIT-style circuits read
 * correctly.
 *
 * Entries without a `template_instance_id` are intentionally skipped — they
 * render via the per-exercise aux list, not as a template block.
 */
export function groupTemplateBlocks(auxiliarySets: AuxiliaryActualSet[]) {
  const blocks = new Map<string, AuxiliaryActualSet[]>();
  for (const entry of auxiliarySets) {
    const id = entry.template_instance_id;
    if (id == null) continue;
    const existing = blocks.get(id) ?? [];
    existing.push(entry);
    blocks.set(id, existing);
  }
  return Array.from(blocks.entries()).map(([id, entries]) => ({
    id,
    entries,
  }));
}
