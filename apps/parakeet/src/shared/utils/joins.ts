/**
 * Supabase embedded one-to-one joins arrive as a single row, a single-element
 * array, or null depending on how PostgREST infers the relationship. Collapse
 * any of those shapes to the related row (or null).
 *
 * Replaces the `Array.isArray(x) ? x[0] : x` snippet that was hand-inlined at
 * every join site across the repositories.
 */
export function firstFromJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
