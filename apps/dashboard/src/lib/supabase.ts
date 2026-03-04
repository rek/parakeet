import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_KEY as string;

if (!url || !key) {
  console.error(
    '[dashboard] Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY.\n' +
      'Create apps/dashboard/.env.local with:\n' +
      '  VITE_SUPABASE_URL=http://localhost:54321\n' +
      '  VITE_SUPABASE_KEY=<service_role_key from supabase start>'
  );
}

export const supabase = createClient(url ?? '', key ?? '');
