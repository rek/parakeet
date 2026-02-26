import type { Database as SupabaseDatabase } from '../../../../supabase/types';

// Hard-fail typecheck when generated Supabase DB types are missing/empty.
type HasNonEmptyPublicTables<DB> = DB extends { public: { Tables: infer Tables } }
  ? keyof Tables extends never
    ? false
    : true
  : false;
type AssertTrue<T extends true> = T;
type __SupabaseTypesMustBeGenerated = AssertTrue<HasNonEmptyPublicTables<SupabaseDatabase>>;
void (0 as unknown as __SupabaseTypesMustBeGenerated);

export type Database = SupabaseDatabase;
export type DbTable = keyof Database['public']['Tables'];
export type DbRow<TTable extends DbTable> = Database['public']['Tables'][TTable]['Row'];
export type DbInsert<TTable extends DbTable> = Database['public']['Tables'][TTable]['Insert'];
export type DbUpdate<TTable extends DbTable> = Database['public']['Tables'][TTable]['Update'];
