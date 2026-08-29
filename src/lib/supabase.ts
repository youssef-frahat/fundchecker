// Supabase Client Initialization

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xclvydhlmxmzcwwprwfk.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_Q7EvjsDluhNdvsdyTavCXA_uzBQL_mZ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
