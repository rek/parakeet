import { useEffect, useState } from 'react';

import type { PostgrestError } from '@supabase/supabase-js';

import { useSupabase } from './SupabaseContext';

type Builder<T> = {
  then: (
    onfulfilled: (result: { data: T[] | null; error: PostgrestError | null }) => void
  ) => unknown;
};

/**
 * Shared hook for the dashboard's "fetch a list of rows" pages.
 * Handles loading, error, and unmount cancellation. Re-runs when the
 * Supabase env (local/prod) changes.
 *
 * Usage:
 *
 *   const { rows, loading, error } = useSupabaseRows<MyRow>(
 *     (s) => s.from('my_table').select('*').limit(50),
 *   );
 */
export function useSupabaseRows<T>(
  build: (supabase: ReturnType<typeof useSupabase>['supabase']) => Builder<T>
): { rows: T[]; loading: boolean; error: string | null } {
  const { supabase, env } = useSupabase();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    build(supabase).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) {
        // eslint-disable-next-line no-console
        console.error('useSupabaseRows error:', err);
        setError(err.message);
        setRows([]);
      } else {
        setRows(data ?? []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // `build` is treated as a stable callback — pages declare it inline but
    // re-run on env switches. If a page needs reactive params, it can pass
    // them through a wrapping useCallback; trivial pages don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, env]);

  return { rows, loading, error };
}
