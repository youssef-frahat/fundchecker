// Transfer Netting Sheet Component - Exact Match to Screenshot 1 Layout

'use client';

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
  ArrowRightLeft,
  DollarSign,
} from 'lucide-react';
import { NettingRow, UserRole } from '@/lib/types';
import { exportNettingSheet } from '@/lib/excel-engine';
import { formatFinancialNumber } from '@/lib/netting-engine';

interface TransferSheetViewProps {
  nettingRows: NettingRow[];
  totalBuy: number;
  totalSell: number;
  totalNet: number;
  currentRole: UserRole;
  reviewStatus: 'DRAFT' | 'GENERATED' | 'UNDER_REVIEW' | 'APPROVED';
  makerName?: string;
  checkerName?: string;
  onMakerSubmit: () => void;
  onCheckerApprove: () => void;
}

export function TransferSheetView({
  nettingRows,
  totalBuy,
  totalSell,
  totalNet,
  currentRole,
  reviewStatus,
  makerName,
  checkerName,
  onMakerSubmit,
  onCheckerApprove,
}: TransferSheetViewProps) {
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'EGP' | 'USD'>('ALL');
  const [groupBy, setGroupBy] = useState<'symbol' | 'actual_symbol'>('symbol');

  const filteredRows = nettingRows.filter((r) => {
    if (currencyFilter === 'ALL') return true;
    return r.currency === currencyFilter;
  });

  const handleExportNettingExcel = async () => {
    const blob = await exportNettingSheet(filteredRows, totalBuy, totalSell, totalNet);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transfer_Netting_Sheet_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg text-slate-100">
              Transfer Instructions &amp; Netting Sheet
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Calculated as <span className="text-emerald-400 font-mono">NET = Sell - Buy</span> across registered fund symbols.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Currency Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setCurrencyFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition ${
                currencyFilter === 'ALL' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400'
              }`}
            >
              All Currencies
            </button>
            <button
              onClick={() => setCurrencyFilter('EGP')}
              className={`px-2.5 py-1 rounded-lg transition ${
                currencyFilter === 'EGP' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400'
              }`}
            >
              EGP
            </button>
            <button
              onClick={() => setCurrencyFilter('USD')}
              className={`px-2.5 py-1 rounded-lg transition ${
                currencyFilter === 'USD' ? 'bg-amber-600 text-white font-semibold' : 'text-slate-400'
              }`}
            >
              USD (تحويلات دولار)
            </button>
          </div>

          <button
            onClick={handleExportNettingExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            Download Netting Sheet
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400">Total Symbols</span>
          <div className="text-xl font-bold font-mono text-white mt-1">{filteredRows.length}</div>
        </div>
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400">Total Buy Value</span>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {totalBuy.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400">Total Sell Value</span>
          <div className="text-xl font-bold font-mono text-rose-400 mt-1">
            {totalSell.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400">Total Net Transfer</span>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatFinancialNumber(totalNet)}
          </div>
        </div>
      </div>

      {/* Maker-Checker Workflow Bar */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
              reviewStatus === 'APPROVED'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : reviewStatus === 'UNDER_REVIEW'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">Maker-Checker Approval Status:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                  reviewStatus === 'APPROVED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : reviewStatus === 'UNDER_REVIEW'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {reviewStatus.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Maker: <span className="text-slate-200">{makerName || 'Pending'}</span> | Checker:{' '}
              <span className="text-slate-200">{checkerName || 'Pending 4-Eyes Sign-off'}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {reviewStatus === 'DRAFT' || reviewStatus === 'GENERATED' ? (
            <button
              onClick={onMakerSubmit}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              Submit Netting Sheet for Review
            </button>
          ) : reviewStatus === 'UNDER_REVIEW' ? (
            <button
              onClick={onCheckerApprove}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
            >
              <ShieldCheck className="w-4 h-4" />
              Checker Approve &amp; Lock Transfer
            </button>
          ) : (
            <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              Transfer Sheet Approved &amp; Locked
            </div>
          )}
        </div>
      </div>

      {/* Netting Table matching Screenshot 1 */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs font-mono text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3">Symbol Code</th>
              <th className="p-3">Symbol Name</th>
              <th className="p-3">Actual Symbol</th>
              <th className="p-3 text-right">Buy (EGP/USD)</th>
              <th className="p-3 text-right">Sell (EGP/USD)</th>
              <th className="p-3 text-right">NET (Sell - Buy)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredRows.map((row, idx) => {
              const formattedNet = formatFinancialNumber(row.netAmount);
              return (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-semibold text-slate-200">{row.symbolCode}</td>
                  <td className="p-3 font-sans text-slate-300">{row.symbolName}</td>
                  <td className="p-3 text-slate-400">{row.actualSymbol}</td>
                  <td className="p-3 text-right font-semibold text-slate-300">
                    {row.buyTotal > 0
                      ? row.buyTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })
                      : '-'}
                  </td>
                  <td className="p-3 text-right font-semibold text-slate-300">
                    {row.sellTotal > 0
                      ? row.sellTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })
                      : '-'}
                  </td>
                  <td className="p-3 text-right font-bold">
                    <span
                      className={
                        row.status === 'POSITIVE'
                          ? 'text-emerald-400'
                          : row.status === 'NEGATIVE'
                          ? 'text-rose-400'
                          : 'text-slate-500'
                      }
                    >
                      {formattedNet}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-950 font-bold border-t border-slate-800">
            <tr>
              <td colSpan={3} className="p-3 text-slate-200">
                TOTAL SUMMARY
              </td>
              <td className="p-3 text-right text-emerald-400">
                {totalBuy.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
              <td className="p-3 text-right text-rose-400">
                {totalSell.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
              <td
                className={`p-3 text-right font-extrabold ${
                  totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatFinancialNumber(totalNet)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
