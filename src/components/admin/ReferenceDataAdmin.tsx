// Super Admin Reference Data Admin Component (White & Emerald Green Theme)

'use client';

import React, { useState } from 'react';
import { Database, Plus, Search, Edit3, Check } from 'lucide-react';
import { ReferenceData } from '@/lib/types';

interface ReferenceDataAdminProps {
  referenceDataList: ReferenceData[];
  onAddReferenceData: (item: Omit<ReferenceData, 'id'>) => void;
  onUpdateNavPrice: (id: string, newPrice: number) => void;
}

export function ReferenceDataAdmin({
  referenceDataList,
  onAddReferenceData,
  onUpdateNavPrice,
}: ReferenceDataAdminProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newSymbolCode, setNewSymbolCode] = useState('');
  const [newSymbolName, setNewSymbolName] = useState('');
  const [newActualSymbol, setNewActualSymbol] = useState('');
  const [newEmailContact, setNewEmailContact] = useState('');
  const [newNavPrice, setNewNavPrice] = useState('');

  const filteredData = referenceDataList.filter(
    (r) =>
      r.symbolCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.symbolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.actualSymbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartEdit = (item: ReferenceData) => {
    setEditingId(item.id);
    setTempPrice(String(item.navUnitPrice));
  };

  const handleSaveEdit = (id: string) => {
    const parsed = parseFloat(tempPrice);
    if (!isNaN(parsed)) {
      onUpdateNavPrice(id, parsed);
    }
    setEditingId(null);
  };

  const handleCreateNew = () => {
    if (!newSymbolCode || !newSymbolName || !newActualSymbol) return;
    onAddReferenceData({
      symbolCode: newSymbolCode.trim(),
      symbolName: newSymbolName.trim(),
      actualSymbol: newActualSymbol.trim(),
      emailContact: newEmailContact.trim(),
      navUnitPrice: parseFloat(newNavPrice) || 0,
      status: 'ACTIVE',
    });
    setShowAddModal(false);
    setNewSymbolCode('');
    setNewSymbolName('');
    setNewActualSymbol('');
    setNewEmailContact('');
    setNewNavPrice('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Fund Reference Data &amp; Symbol Mappings (Super Admin)
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Manage fund symbol codes (الرمز), display names (الاسم), actual symbols (الرمز2), email contacts, and NAV unit prices (سعر الوثيقة الواحدة).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reference symbols..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-300 pl-9 pr-3 py-1.5 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 w-56"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            Add Fund Reference
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono text-slate-800">
          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-3">Symbol Code (الرمز)</th>
              <th className="p-3">Symbol Name (الاسم)</th>
              <th className="p-3">Actual Symbol (الرمز2)</th>
              <th className="p-3">Email Contact</th>
              <th className="p-3 text-right">NAV / Unit Price (سعر الوثيقة)</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-semibold text-emerald-700">{row.symbolCode}</td>
                <td className="p-3 font-sans text-slate-900">{row.symbolName}</td>
                <td className="p-3 text-slate-600">{row.actualSymbol}</td>
                <td className="p-3 text-slate-600 font-sans">{row.emailContact || '-'}</td>
                <td className="p-3 text-right font-semibold text-emerald-700">
                  {editingId === row.id ? (
                    <input
                      type="number"
                      step="0.00001"
                      value={tempPrice}
                      onChange={(e) => setTempPrice(e.target.value)}
                      className="bg-white border border-emerald-600 px-2 py-0.5 rounded text-xs text-emerald-700 text-right w-28 focus:outline-none"
                    />
                  ) : (
                    row.navUnitPrice.toLocaleString('en-US', { minimumFractionDigits: 4 })
                  )}
                </td>
                <td className="p-3 text-center">
                  {editingId === row.id ? (
                    <button
                      onClick={() => handleSaveEdit(row.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded-lg text-[11px] font-bold"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(row)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg text-[11px]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Fund Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <Plus className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Add New Fund Reference</h4>
                <p className="text-xs text-slate-600">Super Admin Configuration</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Symbol Code (الرمز)</label>
                <input
                  type="text"
                  placeholder="e.g. 1025 or GOLD AZ"
                  value={newSymbolCode}
                  onChange={(e) => setNewSymbolCode(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fund Name (الاسم)</label>
                <input
                  type="text"
                  placeholder="e.g. Beltone Gold Fund"
                  value={newSymbolName}
                  onChange={(e) => setNewSymbolName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Actual Symbol (الرمز2)</label>
                <input
                  type="text"
                  placeholder="e.g. Sabayek"
                  value={newActualSymbol}
                  onChange={(e) => setNewActualSymbol(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email Contact</label>
                <input
                  type="email"
                  placeholder="fund@investment.com"
                  value={newEmailContact}
                  onChange={(e) => setNewEmailContact(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">NAV Unit Price (سعر الوثيقة الواحدة)</label>
                <input
                  type="number"
                  step="0.00001"
                  placeholder="24.0385"
                  value={newNavPrice}
                  onChange={(e) => setNewNavPrice(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
              >
                Save Reference Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
