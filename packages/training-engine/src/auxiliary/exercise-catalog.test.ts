import { describe, expect, it } from 'vitest';

import {
  CATALOG_BY_SLUG,
  computeAuxWeight,
  EXERCISE_CATALOG,
  getCatalogEntry,
  getDisplayNameForSlug,
  getWeightPct,
  prettifySlug,
  slugify,
} from './exercise-catalog';

describe('exercise slugs', () => {
  it('every catalog entry has a non-empty kebab-case slug', () => {
    for (const entry of EXERCISE_CATALOG) {
      expect(entry.slug, `entry ${entry.name} missing slug`).toBeTruthy();
      expect(entry.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('slugs are unique across the catalog', () => {
    const seen = new Set<string>();
    for (const entry of EXERCISE_CATALOG) {
      expect(seen.has(entry.slug), `duplicate slug: ${entry.slug}`).toBe(false);
      seen.add(entry.slug);
    }
    expect(CATALOG_BY_SLUG.size).toBe(EXERCISE_CATALOG.length);
  });

  it('slug matches slugify(name) for entries with simple names', () => {
    // Sanity: catch accidental drift between auto-generated and stored slug.
    // (Some entries may legitimately diverge if name has punctuation we
    // don't want in the slug — those are exceptions, not the rule.)
    for (const entry of EXERCISE_CATALOG) {
      const generated = slugify(entry.name);
      expect(entry.slug).toBe(generated);
    }
  });
});

describe('getCatalogEntry', () => {
  it('resolves by name', () => {
    expect(getCatalogEntry('Barbell Box Squat')?.slug).toBe(
      'barbell-box-squat'
    );
  });
  it('resolves by slug', () => {
    expect(getCatalogEntry('barbell-box-squat')?.name).toBe(
      'Barbell Box Squat'
    );
  });
  it('returns undefined for unknown input', () => {
    expect(getCatalogEntry('not-a-real-exercise')).toBeUndefined();
  });
});

describe('slug display helpers', () => {
  it('prettifySlug title-cases each part', () => {
    expect(prettifySlug('my-custom-hinge')).toBe('My Custom Hinge');
    expect(prettifySlug('one')).toBe('One');
  });

  it('getDisplayNameForSlug prefers catalog name', () => {
    expect(getDisplayNameForSlug('barbell-box-squat')).toBe(
      'Barbell Box Squat'
    );
  });

  it('getDisplayNameForSlug falls back to stored display, then prettify', () => {
    expect(getDisplayNameForSlug('user-custom-x', 'My Funky Hinge')).toBe(
      'My Funky Hinge'
    );
    expect(getDisplayNameForSlug('user-custom-x')).toBe('User Custom X');
  });
});

describe('clean variant weight ordering', () => {
  it('Power Clean >= Hang Clean > Clean and Jerk', () => {
    const powerClean = getWeightPct('Power Clean');
    const hangClean = getWeightPct('Barbell Hang Clean');
    const cleanAndJerk = getWeightPct('Clean and Jerk');

    expect(powerClean).toBeGreaterThanOrEqual(hangClean);
    expect(hangClean).toBeGreaterThan(cleanAndJerk);
  });

  it('computeAuxWeight reflects correct ordering for a 180kg deadlift 1RM', () => {
    const opts = { oneRmKg: 180, lift: 'deadlift' as const };
    const powerClean = computeAuxWeight({ exercise: 'Power Clean', ...opts });
    const hangClean = computeAuxWeight({
      exercise: 'Barbell Hang Clean',
      ...opts,
    });
    const cleanAndJerk = computeAuxWeight({
      exercise: 'Clean and Jerk',
      ...opts,
    });

    expect(powerClean).toBeGreaterThanOrEqual(hangClean);
    expect(hangClean).toBeGreaterThan(cleanAndJerk);

    // Sanity: all in a reasonable range (40-60% of DL 1RM)
    expect(powerClean).toBeCloseTo(180 * 0.55, 1);
    expect(hangClean).toBeCloseTo(180 * 0.5, 1);
    expect(cleanAndJerk).toBeCloseTo(180 * 0.45, 1);
  });

  describe('anchorKg override (GH#221)', () => {
    it('returns anchorKg directly when provided, ignoring formula', () => {
      const result = computeAuxWeight({
        exercise: 'Power Clean',
        oneRmKg: 180,
        lift: 'deadlift',
        anchorKg: 105,
      });
      expect(result).toBe(105);
    });

    it('ignores anchorKg = 0 (treats as absent)', () => {
      const result = computeAuxWeight({
        exercise: 'Power Clean',
        oneRmKg: 180,
        lift: 'deadlift',
        anchorKg: 0,
      });
      expect(result).toBeCloseTo(180 * 0.55, 1);
    });

    it('honors anchorKg for unstable (DB/KB) exercises too', () => {
      const result = computeAuxWeight({
        exercise: 'Dumbbell Curl',
        oneRmKg: 100,
        lift: 'bench',
        biologicalSex: 'male',
        anchorKg: 12.5,
      });
      expect(result).toBe(12.5);
    });
  });
});
