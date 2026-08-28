// Super Admin User Management Admin Component (White & Emerald Green Theme)

'use client';

import React, { useState } from 'react';
import { Users, UserPlus, Shield, User, Search, CheckCircle2 } from 'lucide-react';
import { User as UserType, UserRole } from '@/lib/types';

interface UserManagementAdminProps {
  users: UserType[];
  onAddUser: (user: Omit<UserType, 'id' | 'createdAt'>) => void;
  onToggleUserStatus: (id: string) => void;
}

export function UserManagementAdmin({
  users,
  onAddUser,
  onToggleUserStatus,
}: UserManagementAdminProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('OPERATIONS_USER');

  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = () => {
    if (!newFullName.trim() || !newEmail.trim()) return;
    onAddUser({
      email: newEmail.trim(),
      fullName: newFullName.trim(),
      role: newRole,
      status: 'ACTIVE',
    });
    setShowAddModal(false);
    setNewFullName('');
    setNewEmail('');
    setNewRole('OPERATIONS_USER');
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

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-300 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-64"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <UserPlus className="w-4 h-4" />
            Add System User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">User Name</th>
              <th className="p-3">Email Address</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-sans font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                    {user.fullName.charAt(0)}
                  </div>
                  {user.fullName}
                </td>
                <td className="p-3 text-slate-700">{user.email}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${
                      user.role === 'SUPER_ADMIN'
                        ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {user.role === 'SUPER_ADMIN' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Ops User'}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      user.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => onToggleUserStatus(user.id)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition shadow-sm ${
                      user.status === 'ACTIVE'
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <UserPlus className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Add New System User</h4>
                <p className="text-xs text-slate-600">Assign Credentials &amp; RBAC Access</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name (اسم المستخدم)</label>
                <input
                  type="text"
                  placeholder="e.g. احمد سيد / يوسف فرحات"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="name@investment.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Role Permission</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="OPERATIONS_USER">Operations User</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
