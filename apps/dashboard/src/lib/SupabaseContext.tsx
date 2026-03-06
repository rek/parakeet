import { createContext, useContext, useState, ReactNode } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { clients, isEnvAvailable, SupabaseEnv } from './supabase';

interface SupabaseContextValue {
  env: SupabaseEnv;
  setEnv: (env: SupabaseEnv) => void;
  supabase: SupabaseClient;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const defaultEnv: SupabaseEnv = isEnvAvailable('local') ? 'local' : 'prod';
  const [env, setEnv] = useState<SupabaseEnv>(defaultEnv);

  const client = clients[env] ?? clients['local'] ?? clients['prod'];
  if (!client) {
    throw new Error('No Supabase client configured. Check .env.local.');
  }

  return (
    <SupabaseContext.Provider value={{ env, setEnv, supabase: client }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase(): SupabaseContextValue {
  const ctx = useContext(SupabaseContext);
  if (!ctx) throw new Error('useSupabase must be used inside SupabaseProvider');
  return ctx;
}
