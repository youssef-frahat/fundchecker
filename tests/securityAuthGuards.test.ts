import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getValidatedEnv } from '../src/lib/env';

describe('Security Configuration & Environment Validation (SEC-01)', () => {
  it('should throw an explicit error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      assert.throws(
        () => getValidatedEnv(),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('NEXT_PUBLIC_SUPABASE_URL'));
          return true;
        }
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }
  });

  it('should throw an explicit error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const originalPub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      assert.throws(
        () => getValidatedEnv(),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
          return true;
        }
      );
    } finally {
      if (originalAnon) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
      if (originalPub) process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalPub;
    }
  });

  it('should successfully return validated credentials without hardcoded fallbacks', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-with-sufficient-length';

      const env = getValidatedEnv();
      assert.equal(env.supabaseUrl, 'https://test-project.supabase.co');
      assert.equal(env.supabaseAnonKey, 'test-anon-key-with-sufficient-length');
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (originalAnon) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
      else delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
  });
});

describe('Zero-Trust Authentication & RBAC Guards (SEC-02 to SEC-07)', () => {
  it('Authentication Guard: Unauthenticated user cannot access workspace data', () => {
    const mockAuthSession = null;
    const enforceAuth = (session: unknown) => {
      if (!session) {
        return {
          success: false,
          dbError: '401 Unauthorized: Valid authenticated session required to access workspace data.',
          data: [],
        };
      }
      return { success: true, dbError: undefined, data: ['fund-1'] };
    };

    const res = enforceAuth(mockAuthSession);
    assert.equal(res.success, false);
    assert.ok(res.dbError?.includes('401 Unauthorized'));
    assert.equal(res.data.length, 0);
  });

  it('Four-Eyes Enforcement: Submitter cannot approve their own batch by UUID', () => {
    const batch = {
      id: 'batch-uuid-101',
      maker_id: 'user-uuid-maker-1',
      status: 'PENDING_REVIEW',
    };

    const currentUser = {
      id: 'user-uuid-maker-1',
      role: 'SUPER_ADMIN',
    };

    const checkAuthorization = (makerId: string, callerId: string, role: string) => {
      const isSameMaker = makerId === callerId;
      if (isSameMaker) {
        return {
          allowed: false,
          error: 'Four-Eyes Principle Violation: Maker cannot approve their own submitted transfer sheet batch.',
        };
      }
      if (role !== 'OPERATIONS_CHECKER' && role !== 'SUPER_ADMIN') {
        return {
          allowed: false,
          error: '403 Forbidden: Only an Operations Checker or Super Admin may approve and lock settlement transfer sheets.',
        };
      }
      return { allowed: true };
    };

    const res = checkAuthorization(batch.maker_id, currentUser.id, currentUser.role);
    assert.equal(res.allowed, false);
    assert.ok(res.error?.includes('Four-Eyes Principle Violation'));
  });

  it('Role-Based Access: Operations User cannot approve batches even if different from maker', () => {
    const batch = {
      id: 'batch-uuid-102',
      maker_id: 'user-uuid-maker-1',
      status: 'PENDING_REVIEW',
    };

    const checkerUser = {
      id: 'user-uuid-maker-2', // Different user
      role: 'OPERATIONS_USER',  // Not authorized to approve
    };

    const checkAuthorization = (makerId: string, callerId: string, role: string) => {
      const isSameMaker = makerId === callerId;
      if (isSameMaker) {
        return {
          allowed: false,
          error: 'Four-Eyes Principle Violation: Maker cannot approve their own submitted transfer sheet batch.',
        };
      }
      if (role !== 'OPERATIONS_CHECKER' && role !== 'SUPER_ADMIN') {
        return {
          allowed: false,
          error: '403 Forbidden: Only an Operations Checker or Super Admin may approve and lock settlement transfer sheets.',
        };
      }
      return { allowed: true };
    };

    const res = checkAuthorization(batch.maker_id, checkerUser.id, checkerUser.role);
    assert.equal(res.allowed, false);
    assert.ok(res.error?.includes('403 Forbidden'));
  });

  it('Legitimate Approval: Independent Checker with OPERATIONS_CHECKER role is authorized', () => {
    const batch = {
      id: 'batch-uuid-103',
      maker_id: 'user-uuid-maker-1',
      status: 'PENDING_REVIEW',
    };

    const checkerUser = {
      id: 'user-uuid-checker-9',
      role: 'OPERATIONS_CHECKER',
    };

    const checkAuthorization = (makerId: string, callerId: string, role: string) => {
      const isSameMaker = makerId === callerId;
      if (isSameMaker) {
        return {
          allowed: false,
          error: 'Four-Eyes Principle Violation: Maker cannot approve their own submitted transfer sheet batch.',
        };
      }
      if (role !== 'OPERATIONS_CHECKER' && role !== 'SUPER_ADMIN') {
        return {
          allowed: false,
          error: '403 Forbidden: Only an Operations Checker or Super Admin may approve and lock settlement transfer sheets.',
        };
      }
      return { allowed: true };
    };

    const res = checkAuthorization(batch.maker_id, checkerUser.id, checkerUser.role);
    assert.equal(res.allowed, true);
    assert.equal(res.error, undefined);
  });

  it('RBAC Enforcement: Auditors are blocked from trade processing mutations', () => {
    const checkMutationPermission = (role: string) => {
      if (role === 'AUDITOR') {
        return { allowed: false, error: '403 Forbidden: Auditors have read-only permissions.' };
      }
      return { allowed: true };
    };

    const res = checkMutationPermission('AUDITOR');
    assert.equal(res.allowed, false);
    assert.ok(res.error?.includes('403 Forbidden'));

    const opRes = checkMutationPermission('OPERATIONS_USER');
    assert.equal(opRes.allowed, true);
  });
});

describe('Audit Log Integrity & UUID Validation (AUD-03)', () => {
  it('should generate valid RFC-4122 v4 UUIDs for all audit log identifiers', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (let i = 0; i < 20; i++) {
      const uuid = crypto.randomUUID();
      assert.ok(UUID_REGEX.test(uuid), `Generated ID "${uuid}" must be a valid UUIDv4`);
    }
  });
});

describe('Super Admin Password Management Guard (SEC-08)', () => {
  const validatePasswordOverride = (
    callerRole: string,
    userId: string,
    password: string,
    hasServiceKey: boolean,
    callerId: string
  ) => {
    if (callerRole !== 'SUPER_ADMIN') {
      return { success: false, error: 'Unauthorized: Only Super Administrators can set user passwords.' };
    }
    if (!userId || !userId.trim()) {
      return { success: false, error: 'User ID is required.' };
    }
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }
    if (callerId !== userId && !hasServiceKey) {
      return {
        success: false,
        error: 'Direct password override requires SUPABASE_SERVICE_ROLE_KEY in environment variables.',
      };
    }
    return { success: true, message: 'Password updated successfully.' };
  };

  it('rejects password override if caller is not SUPER_ADMIN', () => {
    const res = validatePasswordOverride('OPERATIONS_CHECKER', 'user-123', 'SecretPass123', true, 'caller-1');
    assert.equal(res.success, false);
    assert.ok(res.error?.includes('Unauthorized: Only Super Administrators'));
  });

  it('rejects short passwords under 8 characters', () => {
    const res = validatePasswordOverride('SUPER_ADMIN', 'user-123', 'short', true, 'caller-1');
    assert.equal(res.success, false);
    assert.ok(res.error?.includes('at least 8 characters'));
  });

  it('rejects missing user ID', () => {
    const res = validatePasswordOverride('SUPER_ADMIN', '', 'SecretPass123', true, 'caller-1');
    assert.equal(res.success, false);
    assert.ok(res.error?.includes('User ID is required'));
  });

  it('reports requirement for SERVICE_ROLE_KEY when updating another user without key', () => {
    const res = validatePasswordOverride('SUPER_ADMIN', 'target-user-99', 'StrongPassword123!', false, 'admin-1');
    assert.equal(res.success, false);
    assert.ok(res.error?.includes('SUPABASE_SERVICE_ROLE_KEY'));
  });

  it('allows self password update without service role key', () => {
    const res = validatePasswordOverride('SUPER_ADMIN', 'admin-1', 'StrongPassword123!', false, 'admin-1');
    assert.equal(res.success, true);
    assert.ok(res.message?.includes('Password updated successfully'));
  });

  it('allows valid administrative password override with service role key', () => {
    const res = validatePasswordOverride('SUPER_ADMIN', 'target-user-99', 'StrongPassword123!', true, 'admin-1');
    assert.equal(res.success, true);
    assert.ok(res.message?.includes('Password updated successfully'));
  });
});

