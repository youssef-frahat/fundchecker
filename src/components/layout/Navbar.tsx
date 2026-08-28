// Navbar Component - FinTech Navigation, Cairo Time, Role Switcher, & Real-time Alerts

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
  Activity,
  Layers,
  Database,
  Lock,
} from 'lucide-react';
import { UserRole } from '@/lib/types';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingReviewsCount: number;
  exceptionsCount: number;
}

export function Navbar({
  currentRole,
  onRoleChange,
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
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50 shadow-xl">
      {/* Persistent Alert Banner for Critical Operational Tasks */}
      {totalAlerts > 0 && (
        <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between shadow-inner animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            <span>
              CRITICAL ATTENTION REQUIRED: {pendingReviewsCount} Pending Review(s) &amp; {exceptionsCount} Exception(s) awaiting action.
            </span>
          </div>
          <button
            onClick={() => onTabChange('reviews')}
            className="bg-white/20 hover:bg-white/30 px-2.5 py-0.5 rounded text-[11px] backdrop-blur-sm transition"
          >
            Resolve Now &rarr;
          </button>
        </div>
      )}

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <FileSpreadsheet className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              INVESTMENT PLATFORM
            </h1>
            <p className="text-[10px] text-emerald-400 font-mono tracking-wide uppercase font-semibold">
              Enterprise Trade Ingestion &amp; Netting Engine
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Dashboard
          </button>

          <button
            onClick={() => onTabChange('ingestion')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'ingestion'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Trade Files
          </button>

          <button
            onClick={() => onTabChange('netting')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'netting'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Netting Sheets
          </button>

          <button
            onClick={() => onTabChange('checklists')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 relative ${
              activeTab === 'checklists'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Checklists
          </button>

          <button
            onClick={() => onTabChange('exceptions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 relative ${
              activeTab === 'exceptions'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
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
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Audit Trail
          </button>

          {currentRole === 'SUPER_ADMIN' && (
            <button
              onClick={() => onTabChange('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Reference Data
            </button>
          )}
        </nav>

        {/* Right Section: Cairo Time, Notification Bell, Role Toggle */}
        <div className="flex items-center gap-4">
          {/* Cairo Live Time */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{cairoTime || 'Africa/Cairo'}</span>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 relative transition"
            >
              <Bell className="w-4 h-4" />
              {totalAlerts > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {totalAlerts}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 z-50 text-slate-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-semibold text-xs text-slate-300">Notifications &amp; Reminders</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Live Sync</span>
                </div>
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto text-xs">
                  {totalAlerts === 0 ? (
                    <p className="text-slate-500 text-center py-4">All tasks &amp; reviews completed!</p>
                  ) : (
                    <>
                      {pendingReviewsCount > 0 && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">{pendingReviewsCount} Review(s) Pending Checker Approval</p>
                            <p className="text-[10px] text-amber-400/80 mt-0.5">Four-Eyes Principle requires separate user approval.</p>
                          </div>
                        </div>
                      )}
                      {exceptionsCount > 0 && (
                        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">{exceptionsCount} Unmapped Exception(s) in Queue</p>
                            <p className="text-[10px] text-rose-400/80 mt-0.5">Resolve missing symbols before batch export.</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Role Switcher (Simulates RBAC matrix) */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onRoleChange('OPERATIONS_USER')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                currentRole === 'OPERATIONS_USER'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3 h-3" />
              Ops User
            </button>
            <button
              onClick={() => onRoleChange('SUPER_ADMIN')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                currentRole === 'SUPER_ADMIN'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3 h-3" />
              Admin
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
