// Super Admin Reference Data & Fund Lifecycle Admin Component (White & Emerald Theme)

'use client';

import React, { useState } from 'react';
import { Database, Plus, Search, Edit3, Archive, CheckCircle2, Shield, AlertTriangle, ArrowRight } from 'lucide-react';
import { ReferenceData, SettlementType } from '@/lib/types';

interface ReferenceDataAdminProps {
  referenceDataList: ReferenceData[];
  onAddReferenceData: (item: Omit<ReferenceData, 'id'>) => void;
  onUpdateReferenceData?: (item: ReferenceData) => void;
  onArchiveReferenceData?: (id: string, status: 'ACTIVE' | 'ARCHIVED') => void;
}

export function ReferenceDataAdmin({
  referenceDataList,
  onAddReferenceData,
  onUpdateReferenceData,
  onArchiveReferenceData,
}: ReferenceDataAdminProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'T0' | 'T1'>('ALL');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFund, setEditingFund] = useState<ReferenceData | null>(null);

  // Add Form State
  const [newSymbolCode, setNewSymbolCode] = useState('');
  const [newSymbolName, setNewSymbolName] = useState('');
  const [newActualSymbol, setNewActualSymbol] = useState('');
  const [newEmailContact, setNewEmailContact] = useState('');
  const [newFundType, setNewFundType] = useState<SettlementType>('T0');
  const [newScheduleFrequency, setNewScheduleFrequency] = useState('DAILY');
  const [newExecutionInstruction, setNewExecutionInstruction] = useState('');

  // Filtered List
  const filteredData = referenceDataList.filter((r) => {
    const matchesSearch =
      r.symbolCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.symbolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.actualSymbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || r.fundType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleCreateNew = () => {
    if (!newSymbolCode.trim() || !newSymbolName.trim() || !newActualSymbol.trim()) return;
    onAddReferenceData({
      symbolCode: newSymbolCode.trim(),
      symbolName: newSymbolName.trim(),
      actualSymbol: newActualSymbol.trim(),
      emailContact: newEmailContact.trim(),
      navUnitPrice: 0,
      fundType: newFundType,
      status: 'ACTIVE',
      scheduleFrequency: newScheduleFrequency,
      executionInstruction: newExecutionInstruction.trim(),
    });
    setShowAddModal(false);
    setNewSymbolCode('');
    setNewSymbolName('');
    setNewActualSymbol('');
    setNewEmailContact('');
    setNewFundType('T0');
    setNewScheduleFrequency('DAILY');
    setNewExecutionInstruction('');
  };

  const handleSaveEdit = () => {
    if (!editingFund || !onUpdateReferenceData) return;
    onUpdateReferenceData(editingFund);
    setEditingFund(null);
  };

  const handleToggleArchive = (fund: ReferenceData) => {
    if (!onArchiveReferenceData) return;
    const nextStatus = fund.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    onArchiveReferenceData(fund.id, nextStatus);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Top Header & Operational Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Fund Master &amp; Settlement Rule Management
            </h3>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
              Super Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Configure fund settlement rules (T0 vs T1), dynamic visibility matrices, schedules, and lifecycle status (Active / Archived).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            Create New Fund
          </button>
        </div>
      </div>

      {/* Filter & Command Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
            {(['ACTIVE', 'ARCHIVED', 'ALL'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md transition ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ACTIVE' ? 'Active Funds' : st === 'ARCHIVED' ? 'Archived Funds' : 'All Funds'}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
            {(['ALL', 'T0', 'T1'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-md transition ${
                  typeFilter === t
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'ALL' ? 'All Types' : `${t} Rules`}
              </button>
            ))}
          </div>
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search code or fund name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white border border-slate-300 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-64 shadow-2xs"
          />
        </div>
      </div>

      {/* Fund Master Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">Fund Code</th>
              <th className="p-3">Fund Name</th>
              <th className="p-3">Actual Symbol</th>
              <th className="p-3 text-center">Settlement Type</th>
              <th className="p-3">Assigned Rule Set</th>
              <th className="p-3">Execution Schedule</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                  No funds found in the database. Run <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-700 font-mono">supabase/01_core_schema.sql</code> in the Supabase SQL editor to seed reference data, or click &quot;Create New Fund&quot; above.
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr key={row.id} className={`hover:bg-slate-50 transition ${row.status === 'ARCHIVED' || row.status === 'CLOSED' ? 'opacity-60 bg-slate-50/50' : ''}`}>
                  <td className="p-3 font-semibold font-mono text-emerald-700">{row.symbolCode}</td>
                  <td className="p-3 font-bold text-slate-900">{row.symbolName}</td>
                  <td className="p-3 text-slate-600 font-mono">{row.actualSymbol}</td>
                  <td className="p-3 text-center">

                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] font-mono border ${
                    row.fundType === 'T1'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {row.fundType || 'T0'}
                  </span>
                </td>
                <td className="p-3 text-xs text-slate-600">
                  {row.fundType === 'T1' ? (
                    <span className="text-[11px] text-blue-800 font-medium">
                      T1: Buy Value Visible (Qty Blank) | Sell Qty Visible
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-800 font-medium">
                      T0: Full Value &amp; Quantity Visible (Both Sides)
                    </span>
                  )}
                </td>
                <td className="p-3 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-slate-800 text-[11px]">
                      {row.executionInstruction || (row.fundType === 'T1' ? 'T+1' : 'T+0')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Cycle: {row.scheduleFrequency || 'DAILY'}
                    </span>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    row.status === 'ARCHIVED'
                      ? 'bg-slate-100 text-slate-600 border-slate-300'
                      : row.status === 'CLOSED'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}>
                    {row.status || 'ACTIVE'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => setEditingFund(row)}
                      title="Edit Fund & Settlement Type"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 p-1.5 rounded-lg text-xs font-semibold transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleArchive(row)}
                      title={row.status === 'ACTIVE' ? 'Archive Fund' : 'Restore Fund'}
                      className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                        row.status === 'ACTIVE'
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>

        </table>
      </div>

      {/* CREATE FUND MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-700 border-b border-slate-100 pb-3">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
                <Plus className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900">Create New Fund Master</h4>
                <p className="text-xs text-slate-500">Assign Settlement Rules and Operational Parameters</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fund Symbol Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1025 or GOLD AZ"
                    value={newSymbolCode}
                    onChange={(e) => setNewSymbolCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Actual Symbol *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sabayek or AFAC"
                    value={newActualSymbol}
                    onChange={(e) => setNewActualSymbol(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fund Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wethaq Investment Fund"
                  value={newSymbolName}
                  onChange={(e) => setNewSymbolName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Settlement Type *</label>
                  <select
                    value={newFundType}
                    onChange={(e) => setNewFundType(e.target.value as SettlementType)}
                    className="w-full bg-white border-2 border-emerald-600 rounded-xl p-2.5 text-emerald-950 font-bold focus:outline-none"
                  >
                    <option value="T0">T0 — Money Market / Cash</option>
                    <option value="T1">T1 — Equity / Stocks</option>
                    <option value="T2">T2 — Extended Settlement</option>
                    <option value="DVP">DVP — Delivery Versus Payment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Custodian Contact Email</label>
                  <input
                    type="email"
                    placeholder="custodian.fund@bank.com"
                    value={newEmailContact}
                    onChange={(e) => setNewEmailContact(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Execution Cycle (Frequency)</label>
                  <select
                    value={newScheduleFrequency}
                    onChange={(e) => setNewScheduleFrequency(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
                  >
                    <option value="DAILY">DAILY — Every Business Day</option>
                    <option value="WEEKLY">WEEKLY — Weekly Notice &amp; Execution</option>
                    <option value="BIWEEKLY">BIWEEKLY — 2nd &amp; 4th Week</option>
                    <option value="MONTHLY">MONTHLY — Monthly (Day 18 / 1st Mon)</option>
                    <option value="CUSTOM">CUSTOM — Tailored Instructions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Execution Schedule / Rule</label>
                  <input
                    type="text"
                    placeholder="e.g. Weekly notice Thursday, execution Sunday"
                    value={newExecutionInstruction}
                    onChange={(e) => setNewExecutionInstruction(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNew}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
              >
                Create Fund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT FUND LIFECYCLE MODAL */}
      {editingFund && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-700 border-b border-slate-100 pb-3">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
                <Edit3 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900">Edit Fund Master &amp; Settlement Type</h4>
                <p className="text-xs text-slate-500">Changes apply immediately to daily ingestion and transaction matrices</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fund Symbol Code</label>
                  <input
                    type="text"
                    value={editingFund.symbolCode}
                    onChange={(e) => setEditingFund({ ...editingFund, symbolCode: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Actual Symbol</label>
                  <input
                    type="text"
                    value={editingFund.actualSymbol}
                    onChange={(e) => setEditingFund({ ...editingFund, actualSymbol: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fund Name</label>
                <input
                  type="text"
                  value={editingFund.symbolName}
                  onChange={(e) => setEditingFund({ ...editingFund, symbolName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Settlement Type</label>
                  <select
                    value={editingFund.fundType || 'T0'}
                    onChange={(e) => setEditingFund({ ...editingFund, fundType: e.target.value as SettlementType })}
                    className="w-full bg-white border-2 border-emerald-600 rounded-xl p-2.5 text-emerald-950 font-bold focus:outline-none"
                  >
                    <option value="T0">T0 — Money Market / Cash</option>
                    <option value="T1">T1 — Equity / Stocks</option>
                    <option value="T2">T2 — Extended Settlement</option>
                    <option value="DVP">DVP — Delivery Versus Payment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Lifecycle Status</label>
                  <select
                    value={editingFund.status || 'ACTIVE'}
                    onChange={(e) => setEditingFund({ ...editingFund, status: e.target.value as any })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE (Operational)</option>
                    <option value="ARCHIVED">ARCHIVED (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Execution Cycle (Frequency)</label>
                  <select
                    value={editingFund.scheduleFrequency || 'DAILY'}
                    onChange={(e) => setEditingFund({ ...editingFund, scheduleFrequency: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
                  >
                    <option value="DAILY">DAILY — Every Business Day</option>
                    <option value="WEEKLY">WEEKLY — Weekly Notice &amp; Execution</option>
                    <option value="BIWEEKLY">BIWEEKLY — 2nd &amp; 4th Week</option>
                    <option value="MONTHLY">MONTHLY — Monthly (Day 18 / 1st Mon)</option>
                    <option value="CUSTOM">CUSTOM — Tailored Instructions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Execution Schedule / Rule</label>
                  <input
                    type="text"
                    placeholder="e.g. Weekly notice Thursday, execution Sunday"
                    value={editingFund.executionInstruction || ''}
                    onChange={(e) => setEditingFund({ ...editingFund, executionInstruction: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Custodian Contact Email</label>
                <input
                  type="email"
                  value={editingFund.emailContact || ''}
                  onChange={(e) => setEditingFund({ ...editingFund, emailContact: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingFund(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
              >
                Save Fund Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
