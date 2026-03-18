export type UnknownParser<T> = (value: unknown) => T;

export function parseWithParser<T>(
  value: unknown,
  parser: UnknownParser<T>
): T {
  return parser(value);
}

export function parseJsonArray<T>(
  value: unknown,
  fieldName: string,
  itemParser: UnknownParser<T>
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value.map((item) => itemParser(item));
}

export function parseNullableJsonArray<T>(
  value: unknown,
  fieldName: string,
  itemParser: UnknownParser<T>
): T[] | null {
  if (value === null || value === undefined) return null;
  return parseJsonArray(value, fieldName, itemParser);
}

// ── Safe variants — return fallback instead of throwing ──────────────────────

export function safeParseJsonArray<T>(
  value: unknown,
  fieldName: string,
  itemParser: UnknownParser<T>,
  onError?: (err: unknown) => void
): T[] {
  try {
    return parseJsonArray(value, fieldName, itemParser);
  } catch (err) {
    onError?.(err);
    return [];
  }
}

export function safeParseNullableJsonArray<T>(
  value: unknown,
  fieldName: string,
  itemParser: UnknownParser<T>,
  onError?: (err: unknown) => void
): T[] | null {
  try {
    return parseNullableJsonArray(value, fieldName, itemParser);
  } catch (err) {
    onError?.(err);
    return null;
  }
}

export function safeParseWithParser<T>(
  value: unknown,
  parser: UnknownParser<T>,
  fallback: T,
  onError?: (err: unknown) => void
): T {
  try {
    return parseWithParser(value, parser);
  } catch (err) {
    onError?.(err);
    return fallback;
  }
}
