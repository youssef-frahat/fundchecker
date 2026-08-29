// Super Admin User Management Admin Component (White & Emerald Green Theme)

'use client';

import React, { useState } from 'react';
import { Users, UserPlus, Shield, User, Search, KeyRound, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { User as UserType, UserRole } from '@/lib/types';

interface UserManagementAdminProps {
  users: UserType[];
  onAddUser: (user: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
  }) => Promise<{ success: boolean; error?: string }>;
  onToggleUserStatus: (id: string, newStatus: 'ACTIVE' | 'INACTIVE') => Promise<{ success: boolean; error?: string }>;
  onResetPassword?: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}

export function UserManagementAdmin({
  users,
  onAddUser,
  onToggleUserStatus,
  onResetPassword,
}: UserManagementAdminProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('OPERATIONS_USER');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = async () => {
    setModalError(null);
    if (!newFullName.trim() || !newEmail.trim()) {
      setModalError('Full name and email are required.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setModalError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onAddUser({
        email: newEmail.trim(),
        password: newPassword,
        fullName: newFullName.trim(),
        role: newRole,
      });

      if (!res.success) {
        setModalError(res.error || 'Failed to create user in database.');
        setIsSubmitting(false);
        return;
      }

      setBannerNotice({
        type: 'success',
        message: `User ${newFullName.trim()} successfully provisioned with role ${newRole}.`,
      });
      setShowAddModal(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('OPERATIONS_USER');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'User creation error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusToggle = async (user: UserType) => {
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setActionLoadingId(user.id);
    setBannerNotice(null);

    try {
      const res = await onToggleUserStatus(user.id, newStatus);
      if (!res.success) {
        setBannerNotice({ type: 'error', message: res.error || 'Failed to update user status.' });
      } else {
        setBannerNotice({
          type: 'success',
          message: `User ${user.fullName} is now ${newStatus}. ${
            newStatus === 'INACTIVE' ? 'Login is now blocked.' : 'Login access is restored.'
          }`,
        });
      }
    } catch (err) {
      setBannerNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Status update error',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePasswordReset = async (email: string) => {
    if (!onResetPassword) return;
    setActionLoadingId(email);
    setBannerNotice(null);

    try {
      const res = await onResetPassword(email);
      if (!res.success) {
        setBannerNotice({ type: 'error', message: res.error || 'Password reset request failed.' });
      } else {
        setBannerNotice({
          type: 'success',
          message: res.message || `Password reset instructions dispatched to ${email}.`,
        });
      }
    } catch (err) {
      setBannerNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Password reset execution error',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              User &amp; Access Control Management (Super Admin)
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Manage system users, assign Super Admin or Operations roles, and toggle access permissions.
          </p>
        </div>

        <button
          onClick={() => {
            setModalError(null);
            setShowAddModal(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      {/* Global Status Banner */}
      {bannerNotice && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            bannerNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{bannerNotice.message}</span>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-slate-400 hover:text-slate-600 text-xs px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
        />
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-sans text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">User Profile</th>
              <th className="p-3">Email Address</th>
              <th className="p-3">Assigned Role</th>
              <th className="p-3 text-center">Account Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                  No users found in the database. Create users using the &quot;Add New User&quot; button above.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-xs border border-emerald-200 shadow-sm">
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{user.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-slate-600">{user.email}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        user.role === 'SUPER_ADMIN'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {user.role}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        user.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleStatusToggle(user)}
                        disabled={actionLoadingId === user.id}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition shadow-sm flex items-center gap-1 ${
                          user.status === 'ACTIVE'
                            ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                      >
                        {actionLoadingId === user.id && <Loader2 className="w-3 h-3 animate-spin" />}
                        {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>

                      {onResetPassword && (
                        <button
                          onClick={() => handlePasswordReset(user.email)}
                          disabled={actionLoadingId === user.email}
                          title="Trigger Supabase Auth Password Reset Email"
                          className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1"
                        >
                          {actionLoadingId === user.email ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <KeyRound className="w-3 h-3 text-slate-500" />
                          )}
                          Reset Password
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-700 border-b border-slate-100 pb-3">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
                <UserPlus className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900">Add New System User</h4>
                <p className="text-xs text-slate-500">Creates Supabase Auth Identity &amp; DB Profile</p>
              </div>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahmed Hassan / Youssef Farahat"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Corporate Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="user@investment.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Temporary Password (كلمة المرور) *</label>
                <input
                  type="password"
                  required
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Must be at least 8 characters. Persisted securely in Supabase Auth.</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assigned Role (الدور الوظيفي) *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-white border-2 border-emerald-600 rounded-xl p-2.5 text-emerald-950 font-bold focus:outline-none"
                >
                  <option value="OPERATIONS_USER">Operations User (Maker/Checker)</option>
                  <option value="SUPER_ADMIN">Super Administrator (Full System Control)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                disabled={isSubmitting}
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleCreateUser}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSubmitting ? 'Creating User...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
