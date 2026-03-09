import type { Database as SupabaseDatabase, Json } from '../../../../../supabase/types';

// Hard-fail typecheck when generated Supabase DB types are missing/empty.
type HasNonEmptyPublicTables<DB> = DB extends { public: { Tables: infer Tables } }
  ? keyof Tables extends never
    ? false
    : true
  : false;
type AssertTrue<T extends true> = T;
type __SupabaseTypesMustBeGenerated = AssertTrue<HasNonEmptyPublicTables<SupabaseDatabase>>;
void (0 as unknown as __SupabaseTypesMustBeGenerated);

export type { Json };
export type Database = SupabaseDatabase;
export type DbTable = keyof Database['public']['Tables'];
export type DbRow<TTable extends DbTable> = Database['public']['Tables'][TTable]['Row'];
export type DbInsert<TTable extends DbTable> = Database['public']['Tables'][TTable]['Insert'];
export type DbUpdate<TTable extends DbTable> = Database['public']['Tables'][TTable]['Update'];

/** Cast a Supabase Json column value to a known domain type.
 *  Use when reading JSON columns whose shape is guaranteed by application invariants. */
export function fromJson<T>(value: Json | null): T {
  return value as unknown as T;
}

/** Cast a domain object to the Supabase Json type for inserts/updates. */
export function toJson(value: unknown): Json {
  return value as Json;
}
