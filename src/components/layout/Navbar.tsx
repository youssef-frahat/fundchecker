// Navbar Component - White & Emerald Green FinTech Theme with Real Profile & Logout

'use client';

import React, { useEffect, useState } from 'react';
import {
  Bell,
  Shield,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  Database,
  Lock,
  LogOut,
} from 'lucide-react';
import { UserRole } from '@/lib/types';

interface NavbarProps {
  currentUser: {
    email: string;
    fullName: string;
    role: UserRole;
  };
  onLogout: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingReviewsCount: number;
  exceptionsCount: number;
}

export function Navbar({
  currentUser,
  onLogout,
  activeTab,
  onTabChange,
  pendingReviewsCount,
  exceptionsCount,
}: NavbarProps) {
  const [cairoTime, setCairoTime] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);

  // Update live clock in Africa/Cairo timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Cairo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      setCairoTime(formatter.format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalAlerts = pendingReviewsCount + exceptionsCount;

  return (
    <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-50 shadow-sm">
      {/* Persistent Alert Banner for Critical Operational Tasks */}
      {totalAlerts > 0 && (
        <div className="bg-emerald-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            <span>
              CRITICAL ATTENTION REQUIRED: {pendingReviewsCount} Pending Review(s) &amp; {exceptionsCount} Exception(s) awaiting action.
            </span>
          </div>
          <button
            onClick={() => onTabChange('reviews')}
            className="bg-white/20 hover:bg-white/30 px-2.5 py-0.5 rounded text-[11px] backdrop-blur-sm transition font-medium"
          >
            Resolve Now &rarr;
          </button>
        </div>
      )}

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <FileSpreadsheet className="w-6 h-6 font-bold" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-slate-900">
              INVESTMENT PLATFORM
            </h1>
            <p className="text-[10px] text-emerald-600 font-mono tracking-wide uppercase font-semibold">
              Trade Ingestion &amp; Netting Engine
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => onTabChange('orders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'orders' || activeTab === 'ingestion'
                ? 'bg-white text-emerald-700 font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Trade Orders
          </button>

          <button
            onClick={() => onTabChange('transfers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'transfers' || activeTab === 'netting'
                ? 'bg-white text-emerald-700 font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Cash Transfers
          </button>

          <button
            onClick={() => onTabChange('checklists')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'checklists'
                ? 'bg-white text-emerald-700 font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Checklists
          </button>

          <button
            onClick={() => onTabChange('exceptions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 relative ${
              activeTab === 'exceptions'
                ? 'bg-white text-rose-700 font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Exceptions
            {exceptionsCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {exceptionsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-white text-emerald-700 font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Audit Trail
          </button>

          {currentUser.role === 'SUPER_ADMIN' && (
            <button
              onClick={() => onTabChange('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-white text-emerald-700 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Reference Data
            </button>
          )}
        </nav>

        {/* Right Section: Cairo Time, Notifications, User Profile & Logout */}
        <div className="flex items-center gap-4">
          {/* Cairo Live Time */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>{cairoTime || 'Africa/Cairo'}</span>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 relative transition"
            >
              <Bell className="w-4 h-4" />
              {totalAlerts > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {totalAlerts}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50 text-slate-900">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-semibold text-xs text-slate-900">Notifications</span>
                  <span className="text-[10px] text-emerald-600 font-mono">Live DB Sync</span>
                </div>
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto text-xs">
                  {totalAlerts === 0 ? (
                    <p className="text-slate-500 text-center py-4">All operational checks cleared.</p>
                  ) : (
                    <>
                      {pendingReviewsCount > 0 && (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">{pendingReviewsCount} Review(s) Pending Approval</p>
                            <p className="text-[10px] text-amber-700 mt-0.5">Four-Eyes sign-off required.</p>
                          </div>
                        </div>
                      )}
                      {exceptionsCount > 0 && (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">{exceptionsCount} Exception(s) in Queue</p>
                            <p className="text-[10px] text-rose-700 mt-0.5">Unmapped symbols pending resolution.</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Authenticated User Badge & Logout */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 px-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                {currentUser.fullName.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight">{currentUser.fullName}</p>
                <span className="text-[10px] text-emerald-700 font-semibold uppercase">
                  {currentUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Ops User'}
                </span>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-rose-600 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
