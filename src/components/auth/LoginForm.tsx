// Production Authentication Component - Real Password Login Form

'use client';

import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { UserRole } from '@/lib/types';
import { loginUserAction } from '@/app/actions/authActions';

interface LoginFormProps {
  onLoginSuccess: (user: { email: string; fullName: string; role: UserRole }) => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both your corporate email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await loginUserAction(email, password);

      if (!result.success || !result.user) {
        let msg = result.error || 'Invalid credentials. Please verify your email and password.';
        if (msg.toLowerCase().includes('email not confirmed')) {
          msg = 'Email not confirmed: تم إنشاء كود تفعيل تلقائي (04_fix_auth_and_permissions.sql) في Supabase، أو قم بإيقاف Confirm email من إعدادات Supabase Auth.';
        }
        setErrorMsg(msg);
        setIsSubmitting(false);
        return;
      }

      onLoginSuccess({
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
      });
    } catch (err: unknown) {
      setErrorMsg('Authentication error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
            Investment Operations Platform
          </h2>
          <p className="text-xs text-emerald-700 font-bold">
            Production Enterprise Sign-In
          </p>
        </div>

        {/* Secure Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Corporate Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="name@investment.com"
              />
            </div>
          </div>

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
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {isSubmitting ? 'Authenticating Credentials...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Production Auth Engine (Supabase Auth &amp; Server Cookies)
        </div>
      </div>
    </div>
  );
}
