import { createClient, SupabaseClient } from '@supabase/supabase-js';

const localUrl = import.meta.env.VITE_SUPABASE_URL as string;
const localKey = import.meta.env.VITE_SUPABASE_KEY as string;
const prodUrl = import.meta.env.VITE_SUPABASE_PROD_URL as string;
const prodKey = import.meta.env.VITE_SUPABASE_PROD_KEY as string;

export type SupabaseEnv = 'local' | 'prod';

export const clients: Record<SupabaseEnv, SupabaseClient | null> = {
  local: localUrl && localKey ? createClient(localUrl, localKey) : null,
  prod: prodUrl && prodKey ? createClient(prodUrl, prodKey) : null,
};

export function isEnvAvailable(env: SupabaseEnv): boolean {
  return clients[env] !== null;
}
