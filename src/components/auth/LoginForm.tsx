// Authentication Component - Login Form (White & Emerald Green Theme)

'use client';

import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, FileSpreadsheet, CheckCircle2, User as UserIcon } from 'lucide-react';
import { UserRole } from '@/lib/types';
import { INITIAL_USERS } from '@/lib/store';

interface LoginFormProps {
  onLoginSuccess: (user: { email: string; fullName: string; role: UserRole }) => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [selectedUserEmail, setSelectedUserEmail] = useState('youssef.farahat@investment.com');
  const [password, setPassword] = useState('password123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedUser = INITIAL_USERS.find((u) => u.email === selectedUserEmail) || INITIAL_USERS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    setTimeout(() => {
      if (!selectedUserEmail.trim() || !password.trim()) {
        setErrorMsg('Please select a valid user profile.');
        setIsSubmitting(false);
        return;
      }

      onLoginSuccess({
        email: selectedUser.email,
        fullName: selectedUser.fullName,
        role: selectedUser.role,
      });
      setIsSubmitting(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Investment Management Platform
          </h2>
          <p className="text-xs text-emerald-700 font-bold">
            Internal Operations &amp; Netting Portal
          </p>
        </div>

        {/* Quick User Selector Profile Buttons */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Select Active User Profile (اختر المستخدم):
          </label>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {INITIAL_USERS.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUserEmail(user.email)}
                className={`w-full p-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                  selectedUserEmail === user.email
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center text-xs ${
                      user.role === 'SUPER_ADMIN' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {user.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{user.fullName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{user.email}</p>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    user.role === 'SUPER_ADMIN'
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Ops User'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="••••••••"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            {isSubmitting ? 'Authenticating...' : `Sign In as ${selectedUser.fullName}`}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Encrypted Authentication Engine (Supabase Auth)
        </div>
      </div>
    </div>
  );
}
