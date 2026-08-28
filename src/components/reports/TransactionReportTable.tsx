// Generated Transaction Reports Component (White & Emerald Green Theme with Granular Per-Sheet Download)

'use client';

import React, { useState } from 'react';
import { Download, Layers, FileSpreadsheet } from 'lucide-react';
import { GeneratedTransactionRow } from '@/lib/types';
import { exportSingleFundTransactionSheet, exportTransactionSheetsPerProduct } from '@/lib/excel-engine';

interface TransactionReportTableProps {
  rows: GeneratedTransactionRow[];
}

export function TransactionReportTable({ rows }: TransactionReportTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleExportAllExcel = async () => {
    const blob = await exportTransactionSheetsPerProduct(rows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `All_Transaction_Reports_${new Date().toISOString().split('T')[0]}_v1.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportSingleFund = async (productName: string) => {
    const blob = await exportSingleFundTransactionSheet(rows, productName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = productName.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${safeName}_Transaction_Sheet_${new Date().toISOString().split('T')[0]}_v1.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Generated Fund Transaction Files
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Evaluated against dynamic T0/T1 settlement visibility matrices. Export full workbook or individual fund sheet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by ID or Client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-48"
          />

          {activeTab !== 'All' && (
            <button
              onClick={() => handleExportSingleFund(activeTab)}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Download "{activeTab.substring(0, 15)}..." Sheet
            </button>
          )}

          <button
            onClick={handleExportAllExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            Export All Alphabetical Sheets
          </button>
        </div>
      </div>

      {/* Alphabetical Product Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-100 scrollbar-none">
        <button
          onClick={() => setActiveTab('All')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'All'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'text-slate-600 hover:text-slate-900 bg-slate-100'
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
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100'
              }`}
            >
              <span>{prod}</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
                {prodCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* 11-Column Transaction Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
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
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500 font-sans">
                  No transaction records match the selected tab or search query.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
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
                    {row.transactionValue !== null ? (
                      row.transactionValue.toLocaleString('en-US', { minimumFractionDigits: 2 })
                    ) : (
                      <span className="text-slate-400 italic font-sans text-[11px]">EMPTY (T1 Rule)</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold text-slate-900">
                    {row.qty !== null ? (
                      row.qty.toLocaleString('en-US')
                    ) : (
                      <span className="text-slate-400 italic font-sans text-[11px]">EMPTY (T1 Rule)</span>
                    )}
                  </td>
                  <td className="p-3 text-center text-slate-600">{row.branchId}</td>
                  <td className="p-3 text-slate-600">{row.valueDate}</td>
                  <td className="p-3 text-right text-slate-800">
                    {row.icPrice.toLocaleString('en-US', { minimumFractionDigits: 4 })}
                  </td>
                  <td className="p-3 text-center text-slate-600">{row.fees}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
