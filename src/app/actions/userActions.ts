// User Management Server Actions - Real Backend-Driven Persistence & Auth Integration

'use server';

import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedServerUser } from '@/lib/supabase-server';
import { updateUserStatusInDb, updateUserRoleInDb, fetchUsersFromDb } from '@/lib/repositories/userRepository';
import { insertAuditLog } from '@/lib/repositories/auditRepository';
import { User, UserRole } from '@/lib/types';
import { getDbClient } from '@/lib/db-client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xclvydhlmxmzcwwprwfk.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_Q7EvjsDluhNdvsdyTavCXA_uzBQL_mZ';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Creates a new user with real Supabase Auth credentials, synchronizes profile in public.users,
 * assigns role in public.roles, and writes an immutable audit record.
 */
export async function createUserAction(formData: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Unauthorized: Only Super Administrators can provision new users.' };
    }

    const { email, password, fullName, role } = formData;
    if (!email || !email.trim()) return { success: false, error: 'Valid email address is required.' };
    if (!password || password.length < 8) return { success: false, error: 'Password must be at least 8 characters.' };
    if (!fullName || !fullName.trim()) return { success: false, error: 'Full name is required.' };

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();

    let newAuthUserId: string | null = null;

    // 1. Create Auth user
    if (SERVICE_ROLE_KEY) {
      // If service role key is available, create and auto-confirm user
      const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: adminData, error: adminErr } = await adminClient.auth.admin.createUser({
        email: trimmedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: trimmedName, role },
      });
      if (adminErr) {
        return { success: false, error: `Authentication service error: ${adminErr.message}` };
      }
      newAuthUserId = adminData.user.id;
    } else {
      // Standalone client to create user without disrupting admin cookie session
      const standaloneClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData, error: authErr } = await standaloneClient.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            role,
          },
        },
      });
      if (authErr) {
        return { success: false, error: `Authentication service error: ${authErr.message}` };
      }
      if (!authData.user) {
        return { success: false, error: 'Failed to create user in authentication provider.' };
      }
      newAuthUserId = authData.user.id;
    }

    // 2. Ensure public.users profile is persisted
    const dbClient = await getDbClient();
    const { data: roleRow } = await dbClient
      .from('roles')
      .select('id')
      .eq('name', role)
      .maybeSingle();

    if (roleRow?.id && newAuthUserId) {
      await dbClient.from('users').upsert({
        id: newAuthUserId,
        email: trimmedEmail,
        full_name: trimmedName,
        role_id: roleRow.id,
        status: 'ACTIVE',
      });
    }

    // 3. Write Immutable Audit Record
    await insertAuditLog({
      id: `audit-${Date.now()}`,
      userId: caller.id,
      userName: caller.fullName,
      action: 'CREATE_USER',
      entityName: 'USER',
      entityId: newAuthUserId || undefined,
      newValues: { email: trimmedEmail, fullName: trimmedName, role },
      ipAddress: '127.0.0.1',
      timestampUtc: new Date().toISOString(),
    });

    const createdUser: User = {
      id: newAuthUserId || `user-${Date.now()}`,
      email: trimmedEmail,
      fullName: trimmedName,
      role,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    return { success: true, user: createdUser };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'User creation error';
    return { success: false, error: msg };
  }
}

/**
 * Toggles a user's active status in the database and records an audit log.
 * Inactive users are immediately blocked from logging in or using existing sessions.
 */
export async function toggleUserStatusAction(
  userId: string,
  newStatus: 'ACTIVE' | 'INACTIVE'
): Promise<{ success: boolean; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Unauthorized: Only Super Administrators can alter user status.' };
    }

    if (caller.id === userId && newStatus === 'INACTIVE') {
      return { success: false, error: 'Operation rejected: You cannot deactivate your own active account.' };
    }

    const updateRes = await updateUserStatusInDb(userId, newStatus);
    if (!updateRes.success) {
      return { success: false, error: updateRes.error || 'Failed to update user status in database.' };
    }

    // Write Immutable Audit Record
    await insertAuditLog({
      id: `audit-${Date.now()}`,
      userId: caller.id,
      userName: caller.fullName,
      action: 'TOGGLE_USER_STATUS',
      entityName: 'USER',
      entityId: userId,
      oldValues: { status: newStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
      newValues: { status: newStatus },
      ipAddress: '127.0.0.1',
      timestampUtc: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Status update execution error';
    return { success: false, error: msg };
  }
}

/**
 * Initiates a native Supabase Auth password reset flow.
 */
export async function resetUserPasswordAction(
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Unauthorized: Only Super Administrators can trigger password resets.' };
    }

    if (!email || !email.trim()) {
      return { success: false, error: 'Email address is required.' };
    }

    const standaloneClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: resetErr } = await standaloneClient.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (resetErr) {
      return { success: false, error: `Password reset service error: ${resetErr.message}` };
    }

    // Write Immutable Audit Record
    await insertAuditLog({
      id: `audit-${Date.now()}`,
      userId: caller.id,
      userName: caller.fullName,
      action: 'REQUEST_PASSWORD_RESET',
      entityName: 'USER',
      newValues: { email: email.trim().toLowerCase() },
      ipAddress: '127.0.0.1',
      timestampUtc: new Date().toISOString(),
    });

    return { success: true, message: `Password reset instructions dispatched to ${email.trim()}.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Password reset execution error';
    return { success: false, error: msg };
  }
}

/**
 * Updates a user's role in the database.
 */
export async function updateUserRoleAction(
  userId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    const caller = await getAuthenticatedServerUser();
    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Unauthorized: Only Super Administrators can reassign user roles.' };
    }

    const res = await updateUserRoleInDb(userId, newRole);
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to update user role.' };
    }

    // Write Immutable Audit Record
    await insertAuditLog({
      id: `audit-${Date.now()}`,
      userId: caller.id,
      userName: caller.fullName,
      action: 'UPDATE_USER_ROLE',
      entityName: 'USER',
      entityId: userId,
      newValues: { role: newRole },
      ipAddress: '127.0.0.1',
      timestampUtc: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Role update execution error';
    return { success: false, error: msg };
  }
}
