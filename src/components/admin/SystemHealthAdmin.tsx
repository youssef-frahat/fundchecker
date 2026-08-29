// System Health Monitor — Real Supabase Latency & Connection Check
// PRODUCTION MODE: No random number simulation. All metrics are real.

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Database, HardDrive, ShieldCheck, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface HealthState {
  dbLatencyMs: number | null;
  supabaseStatus: 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE';
  lastCheckedAt: string;
  activeConnections: number | null;
  errorMessage?: string;
}

export function SystemHealthAdmin() {
  const [health, setHealth] = useState<HealthState>({
    dbLatencyMs: null,
    supabaseStatus: 'UNREACHABLE',
    lastCheckedAt: '',
    activeConnections: null,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pingHealth = useCallback(async () => {
    setIsRefreshing(true);
    const start = performance.now();
    try {
      // Real round-trip to Supabase: query a lightweight table
      const { error } = await supabase.from('roles').select('id').limit(1);
      const latency = Math.round(performance.now() - start);

      if (error) {
        setHealth({
          dbLatencyMs: latency,
          supabaseStatus: 'DEGRADED',
          lastCheckedAt: new Date().toISOString(),
          activeConnections: null,
          errorMessage: error.message,
        });
      } else {
        setHealth({
          dbLatencyMs: latency,
          supabaseStatus: latency < 500 ? 'HEALTHY' : 'DEGRADED',
          lastCheckedAt: new Date().toISOString(),
          activeConnections: null, // requires service_role key — not available client-side
        });
      }
    } catch (err) {
      setHealth({
        dbLatencyMs: null,
        supabaseStatus: 'UNREACHABLE',
        lastCheckedAt: new Date().toISOString(),
        activeConnections: null,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      pingHealth();
    }, 0);
    const interval = setInterval(pingHealth, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [pingHealth]);

  const statusColor =
    health.supabaseStatus === 'HEALTHY'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : health.supabaseStatus === 'DEGRADED'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-rose-700 bg-rose-50 border-rose-200';

  const StatusIcon = health.supabaseStatus === 'HEALTHY' ? CheckCircle2 : XCircle;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              System Health Monitor
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Real Supabase round-trip latency. Refreshes every 30 seconds.
          </p>
        </div>

        <button
          onClick={pingHealth}
          disabled={isRefreshing}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-300"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
          Ping Now
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* DB Latency — REAL */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Database Latency</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-700">
            {health.dbLatencyMs !== null ? (
              <>{health.dbLatencyMs} <span className="text-xs font-normal text-slate-500">ms (real)</span></>
            ) : (
              <span className="text-rose-600 text-sm">—</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Supabase round-trip</p>
        </div>

        {/* Status — REAL */}
        <div className={`p-4 rounded-xl border space-y-1 ${statusColor}`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span>Connection Status</span>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div className="text-lg font-extrabold font-mono">
            {health.supabaseStatus}
          </div>
          <p className="text-[11px]">
            {health.errorMessage ? health.errorMessage : 'Live check via roles table'}
          </p>
        </div>

        {/* Last Checked — REAL */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Last Checked</span>
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xs font-bold font-mono text-slate-900 truncate mt-2">
            {health.lastCheckedAt
              ? new Date(health.lastCheckedAt).toLocaleString('en-GB', { timeZone: 'Africa/Cairo' })
              : '—'}
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Auto-refreshes every 30s
          </p>
        </div>
      </div>

      {/* Active connections note */}
      <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
        Active connection count requires a Supabase service-role key and is not exposed client-side.
        Use the Supabase Dashboard → Reports → Database to view connection pool metrics.
      </p>
    </div>
  );
}
