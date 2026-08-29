// Universal Database Client Resolver — Cookie-forwarding on Server, Singleton on Client

import { createSupabaseServerClient } from './supabase-server';
import { supabase as browserSupabase } from './supabase';

export async function getDbClient() {
  if (typeof window === 'undefined') {
    try {
      return await createSupabaseServerClient();
    } catch {
      return browserSupabase;
    }
  }
  return browserSupabase;
}
