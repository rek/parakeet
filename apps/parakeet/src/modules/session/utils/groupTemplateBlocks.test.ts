import { describe, expect, it } from 'vitest';

import type { AuxiliaryActualSet } from '../store/sessionStore';
import { groupTemplateBlocks } from './groupTemplateBlocks';

function makeSet(
  overrides: Partial<AuxiliaryActualSet> & {
    exercise: string;
    set_number: number;
  }
): AuxiliaryActualSet {
  return {
    weight_grams: 0,
    reps_completed: 5,
    is_completed: false,
    ...overrides,
  };
}

describe('groupTemplateBlocks', () => {
  it('returns empty array when there are no template-tagged sets', () => {
    const sets: AuxiliaryActualSet[] = [
      makeSet({ exercise: 'curl', set_number: 1 }),
      makeSet({ exercise: 'curl', set_number: 2 }),
    ];
    expect(groupTemplateBlocks(sets)).toEqual([]);
  });

  it('groups entries by template_instance_id preserving insertion order', () => {
    const sets: AuxiliaryActualSet[] = [
      makeSet({ exercise: 'bike', set_number: 1, template_instance_id: 'a' }),
      makeSet({ exercise: 'row', set_number: 1, template_instance_id: 'a' }),
      makeSet({ exercise: 'bike', set_number: 2, template_instance_id: 'a' }),
      makeSet({ exercise: 'pushup', set_number: 1, template_instance_id: 'b' }),
    ];
    const blocks = groupTemplateBlocks(sets);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].id).toBe('a');
    expect(blocks[0].entries.map((e) => e.exercise)).toEqual([
      'bike',
      'row',
      'bike',
    ]);
    expect(blocks[1].id).toBe('b');
    expect(blocks[1].entries.map((e) => e.exercise)).toEqual(['pushup']);
  });

  it('skips entries without a template_instance_id', () => {
    const sets: AuxiliaryActualSet[] = [
      makeSet({ exercise: 'curl', set_number: 1 }),
      makeSet({ exercise: 'bike', set_number: 1, template_instance_id: 'a' }),
      makeSet({ exercise: 'curl', set_number: 2 }),
    ];
    const blocks = groupTemplateBlocks(sets);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('a');
    expect(blocks[0].entries).toHaveLength(1);
  });
});
