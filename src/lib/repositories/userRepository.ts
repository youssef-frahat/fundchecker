// User Repository - Database Access for System Users & Roles

import { getDbClient } from '../db-client';
import { User, UserRole } from '../types';

export async function fetchUsersFromDb(): Promise<User[]> {
  try {
    const client = await getDbClient();
    const { data, error } = await client
      .from('users')
      .select('*, roles(name)')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((u: Record<string, unknown>) => {
      const roleObj = u.roles as { name?: string } | undefined;
      const roleName = roleObj?.name === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'OPERATIONS_USER';
      return {
        id: String(u.id),
        email: String(u.email),
        fullName: String(u.full_name),
        role: roleName as UserRole,
        status: (u.status as User['status']) || 'ACTIVE',
        lastLoginAt: u.last_login_at ? String(u.last_login_at) : undefined,
        createdAt: String(u.created_at || new Date().toISOString()),
      };
    });
  } catch (err) {
    console.warn('User repository fetch notice:', err);
    return [];
  }
}

export async function updateUserStatusInDb(
  userId: string,
  status: 'ACTIVE' | 'INACTIVE'
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getDbClient();
    const { error } = await client
      .from('users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database update error';
    return { success: false, error: msg };
  }
}

export async function updateUserRoleInDb(
  userId: string,
  roleName: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getDbClient();
    // 1. Resolve role ID from public.roles
    const { data: roleData, error: roleError } = await client
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (roleError || !roleData) {
      return { success: false, error: `Role ${roleName} not found in database.` };
    }

    // 2. Update user's role_id
    const { error: updateError } = await client
      .from('users')
      .update({ role_id: roleData.id, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database update error';
    return { success: false, error: msg };
  }
}

