// Supabase Client Initialization

import { createClient } from '@supabase/supabase-js';
import { getValidatedEnv } from './env';

const { supabaseUrl, supabaseAnonKey } = getValidatedEnv();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

