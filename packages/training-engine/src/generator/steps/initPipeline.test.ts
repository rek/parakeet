import { describe, expect, it } from 'vitest';

import { baseInput } from '../../__test-helpers__/fixtures';
import { initPipeline } from './initPipeline';

describe('initPipeline rationale', () => {
  it('heavy day pushes a rationale line describing the session type', () => {
    const ctx = initPipeline(baseInput({ intensityType: 'heavy', blockNumber: 1 }));
    expect(ctx.rationale).toHaveLength(1);
    expect(ctx.rationale[0]).toMatch(/^Heavy day \(Block 1\): maximal strength/);
  });

  it('explosive day pushes speed-strength description', () => {
    const ctx = initPipeline(baseInput({ intensityType: 'explosive', blockNumber: 2 }));
    expect(ctx.rationale[0]).toMatch(/^Explosive day \(Block 2\): speed-strength/);
  });

  it('rep day includes rep range when present', () => {
    const ctx = initPipeline(
      baseInput({ intensityType: 'rep', blockNumber: 3, primaryLift: 'bench' })
    );
    expect(ctx.rationale[0]).toMatch(/^Rep day \(Block 3\): work capacity/);
    expect(ctx.rationale[0]).toContain('3–5 reps');
  });

  it('deload does not push a rationale entry', () => {
    const ctx = initPipeline(baseInput({ intensityType: 'deload', blockNumber: 1 }));
    expect(ctx.rationale).toHaveLength(0);
  });

  it('block number cycles — blockNumber 4 shows Block 1 in label', () => {
    const ctx = initPipeline(baseInput({ intensityType: 'heavy', blockNumber: 4 }));
    expect(ctx.rationale[0]).toMatch(/^Heavy day \(Block 1\)/);
  });

  it('block number cycles — blockNumber 6 shows Block 3', () => {
    const ctx = initPipeline(baseInput({ intensityType: 'rep', blockNumber: 6, primaryLift: 'bench' }));
    expect(ctx.rationale[0]).toMatch(/^Rep day \(Block 3\)/);
  });
});
