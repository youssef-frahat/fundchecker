// Transfer Netting Sheet Component (Enterprise Commercial White & Emerald Green Theme)

'use client';

import React, { useState } from 'react';
import {
  Download,
  CheckCircle2,
  ShieldCheck,
  ArrowRightLeft,
  FileCheck,
  Check,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { NettingRow, UserRole } from '@/lib/types';
import { exportNettingSheet, exportSingleFundTransactionSheet } from '@/lib/excel-engine';
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
  onReviewSingleFund?: (symbolCode: string, newStatus: 'UNDER_REVIEW' | 'APPROVED') => void;
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
  onReviewSingleFund,
}: TransferSheetViewProps) {
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'EGP' | 'USD'>('ALL');
  const [declarationModal, setDeclarationModal] = useState<{
    actionType: 'SUBMIT_ALL' | 'APPROVE_ALL' | 'SUBMIT_SINGLE' | 'APPROVE_SINGLE';
    symbolCode?: string;
  } | null>(null);
  const [declarationChecked, setDeclarationChecked] = useState(false);

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

  const handleConfirmDeclaration = () => {
    if (!declarationModal || !declarationChecked) return;

    if (declarationModal.actionType === 'SUBMIT_ALL') {
      onMakerSubmit();
    } else if (declarationModal.actionType === 'APPROVE_ALL') {
      onCheckerApprove();
    } else if (declarationModal.actionType === 'SUBMIT_SINGLE' && declarationModal.symbolCode && onReviewSingleFund) {
      onReviewSingleFund(declarationModal.symbolCode, 'UNDER_REVIEW');
    } else if (declarationModal.actionType === 'APPROVE_SINGLE' && declarationModal.symbolCode && onReviewSingleFund) {
      onReviewSingleFund(declarationModal.symbolCode, 'APPROVED');
    }

    setDeclarationModal(null);
    setDeclarationChecked(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Transfer Instructions &amp; Netting Sheet
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Calculated as <span className="text-emerald-700 font-mono font-bold">NET = Sell - Buy</span> across registered fund symbols. Review or download individually per fund.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Currency Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setCurrencyFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition ${
                currencyFilter === 'ALL' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600'
              }`}
            >
              All Currencies
            </button>
            <button
              onClick={() => setCurrencyFilter('EGP')}
              className={`px-2.5 py-1 rounded-lg transition ${
                currencyFilter === 'EGP' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600'
              }`}
            >
              EGP
            </button>
            <button
              onClick={() => setCurrencyFilter('USD')}
              className={`px-2.5 py-1 rounded-lg transition ${
                currencyFilter === 'USD' ? 'bg-amber-600 text-white font-bold shadow-sm' : 'text-slate-600'
              }`}
            >
              USD (تحويلات دولار)
            </button>
          </div>

          <button
            onClick={handleExportNettingExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            Download Full Netting Sheet
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500">Total Symbols</span>
          <div className="text-xl font-extrabold font-mono text-slate-900 mt-1">{filteredRows.length}</div>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500">Total Buy Value</span>
          <div className="text-xl font-extrabold font-mono text-emerald-700 mt-1">
            {totalBuy.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500">Total Sell Value</span>
          <div className="text-xl font-extrabold font-mono text-rose-700 mt-1">
            {totalSell.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500">Total Net Transfer</span>
          <div
            className={`text-xl font-extrabold font-mono mt-1 ${
              totalNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatFinancialNumber(totalNet)}
          </div>
        </div>
      </div>

      {/* Global Batch Approval Bar */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
              reviewStatus === 'APPROVED'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : reviewStatus === 'UNDER_REVIEW'
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Batch Netting Review Status:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                  reviewStatus === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : reviewStatus === 'UNDER_REVIEW'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {reviewStatus.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Maker: <span className="text-slate-900 font-semibold">{makerName || 'Pending'}</span> | Checker:{' '}
              <span className="text-slate-900 font-semibold">{checkerName || 'Pending 4-Eyes Sign-off'}</span>
            </p>
          </div>
        </div>

        {/* Global Batch Action Buttons */}
        <div className="flex items-center gap-3">
          {reviewStatus === 'DRAFT' || reviewStatus === 'GENERATED' ? (
            <button
              onClick={() => setDeclarationModal({ actionType: 'SUBMIT_ALL' })}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              Submit All Funds for Review
            </button>
          ) : reviewStatus === 'UNDER_REVIEW' ? (
            <button
              onClick={() => setDeclarationModal({ actionType: 'APPROVE_ALL' })}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <ShieldCheck className="w-4 h-4" />
              Checker Approve &amp; Lock All
            </button>
          ) : (
            <div className="flex items-center gap-1 text-emerald-800 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Batch Approved &amp; Locked
            </div>
          )}
        </div>
      </div>

      {/* Netting Table with Granular Per-Fund Review & Download Actions */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">Symbol Code</th>
              <th className="p-3">Symbol Name</th>
              <th className="p-3">Actual Symbol</th>
              <th className="p-3 text-right">Buy (EGP/USD)</th>
              <th className="p-3 text-right">Sell (EGP/USD)</th>
              <th className="p-3 text-right">NET (Sell - Buy)</th>
              <th className="p-3 text-center">Fund Status</th>
              <th className="p-3 text-center">Per-Fund Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row, idx) => {
              const formattedNet = formatFinancialNumber(row.netAmount);
              return (
                <tr key={idx} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-semibold text-slate-900">{row.symbolCode}</td>
                  <td className="p-3 font-sans text-slate-800">{row.symbolName}</td>
                  <td className="p-3 text-slate-600">{row.actualSymbol}</td>
                  <td className="p-3 text-right font-semibold text-slate-800">
                    {row.buyTotal > 0
                      ? row.buyTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })
                      : '-'}
                  </td>
                  <td className="p-3 text-right font-semibold text-slate-800">
                    {row.sellTotal > 0
                      ? row.sellTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })
                      : '-'}
                  </td>
                  <td className="p-3 text-right font-bold">
                    <span
                      className={
                        row.status === 'POSITIVE'
                          ? 'text-emerald-700'
                          : row.status === 'NEGATIVE'
                          ? 'text-rose-700'
                          : 'text-slate-500'
                      }
                    >
                      {formattedNet}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        row.reviewStatus === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : row.reviewStatus === 'UNDER_REVIEW'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {row.reviewStatus}
                    </span>
                  </td>
                  <td className="p-3 text-center flex items-center justify-center gap-1.5">
                    {row.reviewStatus === 'DRAFT' && onReviewSingleFund && (
                      <button
                        onClick={() =>
                          setDeclarationModal({ actionType: 'SUBMIT_SINGLE', symbolCode: row.symbolCode })
                        }
                        title="Submit this specific fund for review"
                        className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3 text-amber-600" />
                        Submit Fund
                      </button>
                    )}

                    {row.reviewStatus === 'UNDER_REVIEW' && onReviewSingleFund && (
                      <button
                        onClick={() =>
                          setDeclarationModal({ actionType: 'APPROVE_SINGLE', symbolCode: row.symbolCode })
                        }
                        title="Approve & Lock this specific fund"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Approve Fund
                      </button>
                    )}

                    {row.reviewStatus === 'APPROVED' && (
                      <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" /> Approved
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
            <tr>
              <td colSpan={3} className="p-3 text-slate-900 font-sans">
                TOTAL SUMMARY
              </td>
              <td className="p-3 text-right text-emerald-700">
                {totalBuy.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
              <td className="p-3 text-right text-rose-700">
                {totalSell.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
              <td
                className={`p-3 text-right font-extrabold ${
                  totalNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatFinancialNumber(totalNet)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Enterprise Digital Compliance Declaration Modal */}
      {declarationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-700 border-b border-slate-100 pb-3">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <FileCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  Four-Eyes Digital Audit Declaration
                </h4>
                <p className="text-xs text-slate-600">Enterprise Compliance Sign-off</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans space-y-2">
              <p className="font-bold text-slate-900">Digital Confirmation Statement:</p>
              <p className="italic">
                "I hereby confirm under penalty of audit compliance that I have independently verified all trade execution records, order values, and net settlement calculations against authoritative source files without discrepancy."
              </p>
            </div>

            <label className="flex items-start gap-2.5 p-2 cursor-pointer">
              <input
                type="checkbox"
                checked={declarationChecked}
                onChange={(e) => setDeclarationChecked(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span className="text-xs text-slate-800 font-medium">
                I solemnly agree and execute this digital signature with immutable audit logging.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setDeclarationModal(null);
                  setDeclarationChecked(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={!declarationChecked}
                onClick={handleConfirmDeclaration}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 shadow-md shadow-emerald-600/20"
              >
                Confirm &amp; Log Audit Sign-off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
