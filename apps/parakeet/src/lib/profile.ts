import { supabase } from './supabase';

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export async function getProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, created_at')
    .eq('id', user.id)
    .single();

  return data;
}

export async function updateProfile(update: { display_name?: string }): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) throw error;
}
