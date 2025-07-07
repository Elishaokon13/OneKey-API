import { createClient } from '@supabase/supabase-js';
import { config } from './environment';

let supabaseClient: any = null;

export const initializeSupabase = () => {
  if (!supabaseClient && config.supabase.url && config.supabase.serviceKey) {
    supabaseClient = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return supabaseClient;
};

export const getSupabase = () => {
  return supabaseClient;
};

export const isSupabaseConfigured = () => {
  return false; // Disable Supabase for tests
};

export const checkSupabaseHealth = async () => {
  if (!supabaseClient) {
    return false;
  }

  try {
    const { data, error } = await supabaseClient.from('users').select('count').single();
    return !error;
  } catch (error) {
    return false;
  }
};

export const closeSupabase = async () => {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
    supabaseClient = null;
  }
}; 