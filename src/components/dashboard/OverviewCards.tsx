// Dashboard Overview Cards Component (White & Emerald Green Theme)

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
        className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all ${
          isEodComplete
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl ${
              isEodComplete
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-amber-100 text-amber-700 border border-amber-200'
            }`}
          >
            {isEodComplete ? <ShieldCheck className="w-7 h-7" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base tracking-wide text-slate-900">
                OPERATIONAL DAY STATUS:{' '}
                <span className={isEodComplete ? 'text-emerald-700' : 'text-amber-700'}>
                  {isEodComplete ? 'FULL COMPLIANCE (EOD COMPLETE)' : 'IN PROGRESS (OPEN CHECKS)'}
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Checklists: {completedChecklistsCount}/{totalChecklistsCount} Done | Exceptions: {exceptionsCount} | Reviews Pending: {pendingReviewsCount}
            </p>
          </div>
        </div>

        <div className="text-right font-mono text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
          <span>Timezone: </span>
          <span className="text-emerald-700 font-bold">Africa/Cairo (UTC+2)</span>
        </div>
      </div>

      {/* Grid Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Ingestion Volume */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Trade Volume Ingested
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
              {totalRowsProcessed.toLocaleString('en-US')}{' '}
              <span className="text-xs font-normal text-slate-500">Rows</span>
            </div>
            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
              <span className="text-emerald-700 font-semibold">{totalFilesCount} Files</span> Ingested Today
            </p>
          </div>
        </div>

        {/* Card 2: Net Settlement Amount */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Net Transfer Settlement
            </span>
            <div
              className={`p-2 rounded-xl border ${
                totalNetAmount >= 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div
              className={`text-2xl font-extrabold font-mono tracking-tight ${
                totalNetAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              EGP {formatFinancialNumber(totalNetAmount)}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
              <span className="flex items-center text-emerald-700 text-[11px] font-medium">
                <ArrowUpRight className="w-3 h-3" /> Buy: {totalBuyAmount.toLocaleString()}
              </span>
              <span className="flex items-center text-rose-700 text-[11px] font-medium">
                <ArrowDownRight className="w-3 h-3" /> Sell: {totalSellAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Pending Reviews */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Maker-Checker Reviews
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
              {pendingReviewsCount}{' '}
              <span className="text-xs font-semibold text-amber-700">Pending</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">Four-Eyes Approval Enforced</p>
          </div>
        </div>

        {/* Card 4: Exception Queue */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Exception Queue
            </span>
            <div
              className={`p-2 rounded-xl border ${
                exceptionsCount > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
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
                exceptionsCount > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {exceptionsCount}{' '}
              <span className="text-xs font-normal text-slate-500">Unmapped</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {exceptionsCount === 0 ? 'Zero Data Anomalies' : 'Requires Resolution'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
