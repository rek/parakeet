import { describe, expect, it } from 'vitest';

import { shouldShowAnchorNote } from './aux-anchor-note.helpers';

type Anchor = NonNullable<
  Parameters<typeof shouldShowAnchorNote>[0]['anchor']
>;

function anchor(overrides: Partial<Anchor>): Anchor {
  return {
    source: 'history',
    confidence: 'medium',
    formulaWeightKg: 75,
    anchorBaseKg: 75,
    sessionsUsed: 3,
    rationale: 'test',
    ...overrides,
  };
}

describe('shouldShowAnchorNote', () => {
  it('hides when source is formula', () => {
    expect(
      shouldShowAnchorNote({
        anchor: anchor({ source: 'formula', anchorBaseKg: 100 }),
        weightIncrementKg: 2.5,
      })
    ).toBe(false);
  });

  it('hides when formula weight is zero (bodyweight)', () => {
    expect(
      shouldShowAnchorNote({
        anchor: anchor({ formulaWeightKg: 0, anchorBaseKg: 0 }),
        weightIncrementKg: 2.5,
      })
    ).toBe(false);
  });

  it('hides when divergence is within 20%', () => {
    // anchorBase 80 vs formula 75 → divergence ≈ 6.7%
    expect(
      shouldShowAnchorNote({
        anchor: anchor({ formulaWeightKg: 75, anchorBaseKg: 80 }),
        weightIncrementKg: 2.5,
      })
    ).toBe(false);
  });

  it('shows when divergence > 20% with source history', () => {
    // anchorBase 95 vs formula 75 → divergence ≈ 26.7%
    expect(
      shouldShowAnchorNote({
        anchor: anchor({
          source: 'history',
          formulaWeightKg: 75,
          anchorBaseKg: 95,
        }),
        weightIncrementKg: 2.5,
      })
    ).toBe(true);
  });

  it('shows when divergence > 20% with source snap', () => {
    expect(
      shouldShowAnchorNote({
        anchor: anchor({
          source: 'snap',
          formulaWeightKg: 75,
          anchorBaseKg: 95,
        }),
        weightIncrementKg: 2.5,
      })
    ).toBe(true);
  });

  it('shows for source blend when divergence > 20%', () => {
    expect(
      shouldShowAnchorNote({
        anchor: anchor({
          source: 'blend',
          formulaWeightKg: 100,
          anchorBaseKg: 130,
        }),
        weightIncrementKg: 2.5,
      })
    ).toBe(true);
  });

  it('hides under rounding hysteresis (both round to same plate)', () => {
    // anchorBase 11 vs formula 9 → 22% divergence, but rounded to nearest
    // 5kg both become 10. Note should hide.
    expect(
      shouldShowAnchorNote({
        anchor: anchor({ formulaWeightKg: 9, anchorBaseKg: 11 }),
        weightIncrementKg: 5,
      })
    ).toBe(false);
  });

  it('shows when divergence is large and plate rounding still resolves to different values', () => {
    // anchorBase 70 vs formula 50 → 40% divergence; both round distinctly at 2.5kg.
    expect(
      shouldShowAnchorNote({
        anchor: anchor({ formulaWeightKg: 50, anchorBaseKg: 70 }),
        weightIncrementKg: 2.5,
      })
    ).toBe(true);
  });

  it('falls back to 2.5kg increment when input is zero or negative', () => {
    expect(
      shouldShowAnchorNote({
        anchor: anchor({ formulaWeightKg: 50, anchorBaseKg: 70 }),
        weightIncrementKg: 0,
      })
    ).toBe(true);
  });

  it('compares anchor BASE not prescribed (modifier-shrinkage guard)', () => {
    // Lifter's recent sessions: 100kg. Formula: 100kg. Anchor base: 100kg.
    // Today is heavy + sore → prescribed (post-modifier) is 70kg.
    // Divergence between anchor base and formula is 0% → note must NOT show.
    // If we accidentally compared prescribed (70) to formula (100), we'd
    // show the note attributing the 30% reduction to recent history.
    expect(
      shouldShowAnchorNote({
        anchor: anchor({ formulaWeightKg: 100, anchorBaseKg: 100 }),
        weightIncrementKg: 2.5,
      })
    ).toBe(false);
  });

  // GH#223: LLM anchor override stays visible via the same predicate
  it('shows for an LLM override that diverges from formula', () => {
    // Engine anchor 80, LLM override 60, formula 98 → carrier records the LLM's
    // 60 as anchorBaseKg with source='snap' + fromLLMOverride=true. Divergence
    // vs formula (98 vs 60 ≈ 39%) > threshold → note must show.
    expect(
      shouldShowAnchorNote({
        anchor: anchor({
          source: 'snap',
          formulaWeightKg: 98,
          anchorBaseKg: 60,
          fromLLMOverride: true,
          engineAnchorKg: 80,
        }),
        weightIncrementKg: 2.5,
      })
    ).toBe(true);
  });
});
