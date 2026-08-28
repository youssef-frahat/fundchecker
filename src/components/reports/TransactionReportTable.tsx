// Generated Transaction Reports Component - Alphabetical Product Tabs & Export

'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, Layers, Filter, CheckCircle2 } from 'lucide-react';
import { GeneratedTransactionRow } from '@/lib/types';
import { exportTransactionSheetsPerProduct } from '@/lib/excel-engine';

interface TransactionReportTableProps {
  rows: GeneratedTransactionRow[];
}

export function TransactionReportTable({ rows }: TransactionReportTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique product names and sort alphabetically
  const products = Array.from(new Set(rows.map((r) => r.productName))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const [activeTab, setActiveTab] = useState<string>(products[0] || 'All');

  const filteredRows = rows.filter((r) => {
    const matchesTab = activeTab === 'All' || r.productName === activeTab;
    const matchesSearch =
      r.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.externalCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleExportExcel = async () => {
    const blob = await exportTransactionSheetsPerProduct(rows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transaction_Reports_${new Date().toISOString().split('T')[0]}_v1.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg text-slate-100">
              Generated Fund Transaction Files
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Evaluated against dynamic T0/T1 settlement visibility matrices. Export matches VBA macro structure.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by ID or Client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 w-48"
          />

          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            Export Alphabetical Excel Sheets
          </button>
        </div>
      </div>

      {/* Alphabetical Product Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800/80 scrollbar-none">
        <button
          onClick={() => setActiveTab('All')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'All'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white bg-slate-950'
          }`}
        >
          All Products ({rows.length})
        </button>

        {products.map((prod) => {
          const prodCount = rows.filter((r) => r.productName === prod).length;
          return (
            <button
              key={prod}
              onClick={() => setActiveTab(prod)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                activeTab === prod
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-slate-400 hover:text-white bg-slate-950/60'
              }`}
            >
              <span>{prod}</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full">
                {prodCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* 11-Column Transaction Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs font-mono text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500 font-sans">
                  No transaction records match the selected tab or search query.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-semibold text-emerald-400">{row.transactionId}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        row.transactionType === 'buy'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {row.transactionType}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">{row.transactionDate}</td>
                  <td className="p-3 text-slate-300">{row.externalCode}</td>
                  <td className="p-3 font-sans text-slate-200 max-w-xs truncate">{row.name}</td>
                  <td className="p-3 text-right font-semibold">
                    {row.transactionValue !== null ? (
                      row.transactionValue.toLocaleString('en-US', { minimumFractionDigits: 2 })
                    ) : (
                      <span className="text-slate-600 italic">EMPTY (T1 Rule)</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {row.qty !== null ? (
                      row.qty.toLocaleString('en-US')
                    ) : (
                      <span className="text-slate-600 italic">EMPTY (T1 Rule)</span>
                    )}
                  </td>
                  <td className="p-3 text-center text-slate-400">{row.branchId}</td>
                  <td className="p-3 text-slate-400">{row.valueDate}</td>
                  <td className="p-3 text-right text-slate-300">
                    {row.icPrice.toLocaleString('en-US', { minimumFractionDigits: 4 })}
                  </td>
                  <td className="p-3 text-center text-slate-400">{row.fees}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
