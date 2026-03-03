import {
  parseJsonArray,
  parseNullableJsonArray,
  parseWithParser,
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
    expect(() => parseJsonArray('x', 'items', parser)).toThrow('items must be an array');
  });
});
