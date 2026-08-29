// Authentication Server Actions - Production-Grade Supabase Auth & Role Resolution

'use server';

import { createSupabaseServerClient, getAuthenticatedServerUser, AuthenticatedServerUser } from '@/lib/supabase-server';

export async function loginUserAction(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: AuthenticatedServerUser; error?: string }> {
  try {
    if (!email || !email.trim() || !pass || !pass.trim()) {
      return { success: false, error: 'Email and password are required.' };
    }

    const supabase = await createSupabaseServerClient();

    // 1. Execute Supabase Auth Authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });

    if (error || !data.user) {
      return { success: false, error: error?.message || 'Authentication failed: Invalid credentials.' };
    }

    // 2. Resolve User Role strictly from Database (public.users & public.roles)
    const authUser = await getAuthenticatedServerUser();

    if (!authUser) {
      // Clear cookie session if user is inactive or lacks active profile
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Authentication rejected: Your account is deactivated or unassigned. Contact your system administrator.',
      };
    }

    return {
      success: true,
      user: authUser,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login execution error';
    return { success: false, error: msg };
  }
}

export async function logoutUserAction(): Promise<{ success: boolean }> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return { success: true };
  } catch (err) {
    console.warn('Sign out notice:', err);
    return { success: true };
  }
}

export async function getCurrentSessionUserAction(): Promise<{ user: AuthenticatedServerUser | null }> {
  const user = await getAuthenticatedServerUser();
  return { user };
}
