// Dashboard Overview Cards Component

'use client';

import React from 'react';
import {
  TrendingUp,
  FileCheck2,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { formatFinancialNumber } from '@/lib/netting-engine';

interface OverviewCardsProps {
  totalRowsProcessed: number;
  totalFilesCount: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  totalNetAmount: number;
  pendingReviewsCount: number;
  exceptionsCount: number;
  completedChecklistsCount: number;
  totalChecklistsCount: number;
}

export function OverviewCards({
  totalRowsProcessed,
  totalFilesCount,
  totalBuyAmount,
  totalSellAmount,
  totalNetAmount,
  pendingReviewsCount,
  exceptionsCount,
  completedChecklistsCount,
  totalChecklistsCount,
}: OverviewCardsProps) {
  const isEodComplete = completedChecklistsCount === totalChecklistsCount && exceptionsCount === 0;

  return (
    <div className="space-y-6">
      {/* End of Day Operational Status Banner */}
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg transition-all ${
          isEodComplete
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : 'bg-slate-900 border-slate-800 text-slate-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl ${
              isEodComplete ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isEodComplete ? <ShieldCheck className="w-7 h-7" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base tracking-wide">
                OPERATIONAL DAY STATUS:{' '}
                <span className={isEodComplete ? 'text-emerald-400' : 'text-amber-400'}>
                  {isEodComplete ? 'FULL COMPLIANCE (EOD COMPLETE)' : 'IN PROGRESS (OPEN CHECKS)'}
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Checklists: {completedChecklistsCount}/{totalChecklistsCount} Done | Unmapped Exceptions: {exceptionsCount} | Reviews Pending: {pendingReviewsCount}
            </p>
          </div>
        </div>

        <div className="text-right font-mono text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          <span>Timezone: </span>
          <span className="text-emerald-400 font-bold">Africa/Cairo (UTC+2)</span>
        </div>
      </div>

      {/* Grid Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Ingestion Volume */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Trade Volume Ingested
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
              {totalRowsProcessed.toLocaleString('en-US')}{' '}
              <span className="text-xs font-normal text-slate-400">Rows</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold">{totalFilesCount} Files</span> Ingested Today
            </p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition" />
        </div>

        {/* Card 2: Net Settlement Amount */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Net Transfer Settlement
            </span>
            <div
              className={`p-2 rounded-xl border ${
                totalNetAmount >= 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div
              className={`text-2xl font-extrabold font-mono tracking-tight ${
                totalNetAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              EGP {formatFinancialNumber(totalNetAmount)}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span className="flex items-center text-emerald-400 text-[11px]">
                <ArrowUpRight className="w-3 h-3" /> Buy: {totalBuyAmount.toLocaleString()}
              </span>
              <span className="flex items-center text-rose-400 text-[11px]">
                <ArrowDownRight className="w-3 h-3" /> Sell: {totalSellAmount.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-teal-500/5 rounded-full blur-xl group-hover:bg-teal-500/10 transition" />
        </div>

        {/* Card 3: Pending Reviews */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Maker-Checker Reviews
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
              {pendingReviewsCount}{' '}
              <span className="text-xs font-normal text-amber-400">Pending</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Four-Eyes Approval Enforced</p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition" />
        </div>

        {/* Card 4: Exception Queue */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Exception Queue
            </span>
            <div
              className={`p-2 rounded-xl border ${
                exceptionsCount > 0
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {exceptionsCount > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-4">
            <div
              className={`text-2xl font-extrabold font-mono tracking-tight ${
                exceptionsCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {exceptionsCount}{' '}
              <span className="text-xs font-normal text-slate-400">Unmapped</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {exceptionsCount === 0 ? 'Zero Data Anomalies' : 'Requires Manual Resolution'}
            </p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition" />
        </div>
      </div>
    </div>
  );
}
