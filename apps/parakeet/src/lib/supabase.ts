import type { SupabaseClient } from '@supabase/supabase-js';

import { typedSupabase } from '../network/supabase-client';

// Legacy compatibility shim while imports are migrated to `src/network` + `src/data`.
export const supabase = typedSupabase as unknown as SupabaseClient;
