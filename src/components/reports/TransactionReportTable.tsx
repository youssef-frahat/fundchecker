// Generated Transaction Reports Component (Egyptian Market Fund Settlement Architecture)

'use client';

import React, { useState } from 'react';
import { Download, Layers, FileSpreadsheet, Archive, Check } from 'lucide-react';
import { GeneratedTransactionRow } from '@/lib/types';
import {
  exportSingleFundTransactionSheet,
  exportTransactionSheetsPerProduct,
  exportAllFundsAsZip,
} from '@/lib/excel-engine';

interface TransactionReportTableProps {
  rows: GeneratedTransactionRow[];
}

export function TransactionReportTable({ rows }: TransactionReportTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFund, setActiveFund] = useState<string>('All');
  const [showCompleteData, setShowCompleteData] = useState<boolean>(false);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);

  // Extract unique sorted funds
  const products = Array.from(new Set(rows.map((r) => r.productName))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  // Helper to determine if a row belongs to T0 (both Value & Qty visible under standard rules)
  const isT0Row = (row: GeneratedTransactionRow): boolean => {
    return row.transactionValue !== null && row.qty !== null;
  };

  // Filter rows by selected fund
  const fundFilteredRows =
    activeFund === 'All' ? rows : rows.filter((r) => r.productName === activeFund);

  // Filter rows by search query
  const displayedRows = fundFilteredRows.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.transactionId.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.externalCode.toLowerCase().includes(q) ||
      r.productName.toLowerCase().includes(q)
    );
  });

  // Calculate Fund KPIs for selected view
  const activeBuyTotal = displayedRows
    .filter((r) => r.transactionType?.toLowerCase() === 'buy')
    .reduce((acc, r) => {
      const val = r.transactionValue !== null ? r.transactionValue : (showCompleteData && r.qty && r.icPrice ? r.qty * r.icPrice : 0);
      return acc + val;
    }, 0);

  const activeSellTotal = displayedRows
    .filter((r) => r.transactionType?.toLowerCase() === 'sell')
    .reduce((acc, r) => {
      const val = r.transactionValue !== null ? r.transactionValue : (showCompleteData && r.qty && r.icPrice ? r.qty * r.icPrice : 0);
      return acc + val;
    }, 0);

  const activeNetBalance = activeSellTotal - activeBuyTotal;

  // Export handlers
  const handleExportAllExcel = async () => {
    const blob = await exportTransactionSheetsPerProduct(rows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `All_Funds_Workbook_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportSingleFund = async (fundName: string) => {
    const blob = await exportSingleFundTransactionSheet(rows, fundName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = fundName.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
    a.download = `${safeName}_Transaction_Sheet_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportZip = async () => {
    try {
      setIsExportingZip(true);
      const blob = await exportAllFundsAsZip(rows, showCompleteData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `All_Funds_Individual_Sheets_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Generated Fund Transaction Worksheets
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Enterprise Command Bar: Select from {products.length} operational funds. Yellow-header Excel exports with T0 full transparency and individual ZIP bundling.
          </p>
        </div>

        {/* Global Export Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Download Individual Excel for currently selected fund */}
          {activeFund !== 'All' && (
            <button
              onClick={() => handleExportSingleFund(activeFund)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm"
              title={`Download standalone Excel file for ${activeFund}`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Download &quot;{activeFund.substring(0, 16)}...&quot; (.xlsx)
            </button>
          )}

          {/* Download Multi-Tab Workbook (.xlsx) */}
          <button
            onClick={handleExportAllExcel}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-200"
            title="Export all funds into a single Excel file with multiple tabs"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Multi-Tab Workbook (.xlsx)
          </button>

          {/* User Requested: Download All Funds as ZIP file with separate Excel file for each fund */}
          <button
            onClick={handleExportZip}
            disabled={isExportingZip || rows.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-emerald-600/20"
            title="Download a ZIP archive containing individual Excel files for each fund"
          >
            <Archive className="w-4 h-4 text-amber-300" />
            {isExportingZip ? 'Packaging ZIP...' : `Download All Funds as ZIP (${products.length} files)`}
          </button>
        </div>
      </div>

      {/* Interactive Command Bar: Fund Selector, Search & Complete Data Toggle */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Fund Selector Dropdown */}
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Filter by Fund:</label>
            <select
              value={activeFund}
              onChange={(e) => setActiveFund(e.target.value)}
              className="bg-white border-2 border-emerald-600 text-emerald-950 font-bold px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 max-w-md w-full shadow-sm"
            >
              <option value="All">All Operations ({rows.length} total orders)</option>
              {products.map((prod) => {
                const count = rows.filter((r) => r.productName === prod).length;
                return (
                  <option key={prod} value={prod}>
                    {prod} — ({count} orders)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by ID, Name, Symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-56 shadow-2xs"
            />

            {/* Complete Data Toggle (بيانات كاملة) */}
            <button
              onClick={() => setShowCompleteData(!showCompleteData)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                showCompleteData
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
              }`}
              title="Toggle between Egyptian Market Settlement Rules and Full Complete Data"
            >
              <Check className={`w-3.5 h-3.5 ${showCompleteData ? 'text-white' : 'text-slate-400'}`} />
              <span>{showCompleteData ? 'Full Data (بيانات كاملة)' : 'Standard Rules (T0/T1)'}</span>
            </button>
          </div>
        </div>

        {/* Live Financial Snapshot for Active View */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span>Showing: <strong className="text-slate-900">{displayedRows.length}</strong> orders</span>
            <span>•</span>
            <span className="text-slate-500">
              {showCompleteData
                ? 'Full Value & Qty displayed for all orders (بيانات كاملة)'
                : 'T0 Funds show complete data (Value & Qty). T1 Funds follow Egyptian settlement rules.'}
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <div className="bg-white border border-slate-200 px-3 py-1 rounded-lg">
              <span className="text-slate-500 mr-1.5">BUY:</span>
              <strong className="text-emerald-700">
                EGP {activeBuyTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div className="bg-white border border-slate-200 px-3 py-1 rounded-lg">
              <span className="text-slate-500 mr-1.5">SELL:</span>
              <strong className="text-rose-700">
                EGP {activeSellTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div className={`px-3 py-1 rounded-lg font-bold border ${
              activeNetBalance >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <span className="mr-1.5">NET:</span>
              <span>
                EGP {activeNetBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 11-Column Yellow Header Styled Transaction Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono text-slate-800">
          <thead className="bg-amber-100/90 text-slate-900 font-bold uppercase text-[10px] tracking-wider border-b border-amber-300">
            <tr>
              <th className="p-3">Transaction ID</th>
              <th className="p-3">Type</th>
              <th className="p-3">Transaction Date</th>
              <th className="p-3">External Code</th>
              <th className="p-3">Customer Name</th>
              <th className="p-3 text-right">Transaction Value</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-center">Branch ID</th>
              <th className="p-3">Value Date</th>
              <th className="p-3 text-right">IC Price</th>
              <th className="p-3 text-center">Fees</th>
              <th className="p-3">Fund Name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-500 font-sans">
                  No transaction records match the selected fund or search query.
                </td>
              </tr>
            ) : (
              displayedRows.map((row, idx) => {
                const isT0 = isT0Row(row);
                // For T0 funds OR if complete data mode is active, display full values
                const displayValue =
                  row.transactionValue !== null
                    ? row.transactionValue
                    : showCompleteData && row.qty && row.icPrice
                    ? row.qty * row.icPrice
                    : null;

                const displayQty =
                  row.qty !== null
                    ? row.qty
                    : showCompleteData && row.transactionValue && row.icPrice
                    ? row.transactionValue / row.icPrice
                    : null;

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-semibold text-emerald-700">{row.transactionId}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.transactionType === 'buy'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {row.transactionType}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{row.transactionDate}</td>
                    <td className="p-3 text-slate-700">{row.externalCode}</td>
                    <td className="p-3 font-sans text-slate-900 max-w-xs truncate">{row.name}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">
                      {displayValue !== null ? (
                        displayValue.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-900">
                      {displayQty !== null ? (
                        displayQty.toLocaleString('en-US')
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center text-slate-600">{row.branchId}</td>
                    <td className="p-3 text-slate-600">{row.valueDate}</td>
                    <td className="p-3 text-right text-slate-700">
                      {row.icPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    <td className="p-3 text-center text-slate-600">{row.fees}</td>
                    <td className="p-3 font-sans text-slate-600 max-w-[160px] truncate text-[11px]">
                      {row.productName}
                      {isT0 && (
                        <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                          T0
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
