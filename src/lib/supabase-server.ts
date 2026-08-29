// Supabase Server Client Initialization with Cookie Session Context

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { UserRole } from './types';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xclvydhlmxmzcwwprwfk.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      'sb_publishable_Q7EvjsDluhNdvsdyTavCXA_uzBQL_mZ',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component context where cookies cannot be mutated
          }
        },
      },
    }
  );
}

export interface AuthenticatedServerUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

/**
 * Server-Side Session & Identity Guard
 * Extracts current user from Supabase Auth session and resolves database role from public.users & public.roles.
 * Enforces account active status check (inactive users cannot authenticate).
 */
export async function getAuthenticatedServerUser(): Promise<AuthenticatedServerUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Server-Side Role & Status Resolution from Database
    const { data: dbUser, error: roleError } = await supabase
      .from('users')
      .select('*, roles(name)')
      .eq('id', user.id)
      .maybeSingle();

    if (roleError) {
      console.warn('Database user resolution warning:', roleError.message);
    }

    // Enforce Active Status: Block deactivated or archived accounts immediately
    if (dbUser && dbUser.status && dbUser.status !== 'ACTIVE') {
      console.warn(`Session rejected: User account ${user.email} is ${dbUser.status}`);
      return null;
    }

    let resolvedRole: UserRole = 'OPERATIONS_USER';
    let fullName = (user.user_metadata?.full_name as string) || user.email || 'Operations User';

    if (dbUser) {
      const roleObj = dbUser.roles as { name?: string } | undefined;
      if (roleObj?.name === 'SUPER_ADMIN') {
        resolvedRole = 'SUPER_ADMIN';
      }
      fullName = String(dbUser.full_name || fullName);
    }

    return {
      id: user.id,
      email: user.email || '',
      fullName,
      role: resolvedRole,
      status: (dbUser?.status as 'ACTIVE') || 'ACTIVE',
    };
  } catch (err) {
    console.warn('Authenticated server user resolution error:', err);
    return null;
  }
}
