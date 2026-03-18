import {
  parseJsonArray,
  parseNullableJsonArray,
  parseWithParser,
  safeParseJsonArray,
  safeParseNullableJsonArray,
  safeParseWithParser,
} from './db';

describe('db', () => {
  it('parseWithParser delegates parsing', () => {
    const parser = (value: unknown) => Number(value);
    expect(parseWithParser('12', parser)).toBe(12);
  });

  it('parseJsonArray parses each item', () => {
    const parser = (value: unknown) => Number(value);
    expect(parseJsonArray(['1', '2'], 'items', parser)).toEqual([1, 2]);
  });

  it('parseNullableJsonArray returns null for missing values', () => {
    const parser = (value: unknown) => Number(value);
    expect(parseNullableJsonArray(null, 'items', parser)).toBeNull();
  });

  it('parseJsonArray throws for non-array values', () => {
    const parser = (value: unknown) => Number(value);
    expect(() => parseJsonArray('x', 'items', parser)).toThrow(
      'items must be an array'
    );
  });

  // ── Safe variants ──────────────────────────────────────────────────────────

  it('safeParseJsonArray returns [] for non-array', () => {
    const parser = (value: unknown) => Number(value);
    expect(safeParseJsonArray('x', 'items', parser)).toEqual([]);
  });

  it('safeParseJsonArray returns [] when parser throws', () => {
    const parser = () => {
      throw new Error('bad');
    };
    expect(safeParseJsonArray([1], 'items', parser)).toEqual([]);
  });

  it('safeParseJsonArray calls onError on failure', () => {
    const onError = vi.fn();
    safeParseJsonArray('x', 'items', Number, onError);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('safeParseJsonArray passes through on success', () => {
    expect(safeParseJsonArray(['1', '2'], 'items', Number)).toEqual([1, 2]);
  });

  it('safeParseNullableJsonArray returns null for null', () => {
    expect(safeParseNullableJsonArray(null, 'items', Number)).toBeNull();
  });

  it('safeParseNullableJsonArray returns null on error', () => {
    const parser = () => {
      throw new Error('bad');
    };
    expect(safeParseNullableJsonArray([1], 'items', parser)).toBeNull();
  });

  it('safeParseWithParser returns fallback on error', () => {
    const parser = () => {
      throw new Error('bad');
    };
    expect(safeParseWithParser('x', parser, 42)).toBe(42);
  });

  it('safeParseWithParser passes through on success', () => {
    expect(safeParseWithParser('12', Number, 0)).toBe(12);
  });
});
