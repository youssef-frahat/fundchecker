// Checklist Engine Component (White & Emerald Green Theme)

'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Unlock,
  Clock,
  UserCheck,
} from 'lucide-react';
import { ChecklistItem, UserRole } from '@/lib/types';

interface ChecklistEngineProps {
  items: ChecklistItem[];
  currentRole: UserRole;
  onToggleComplete: (itemId: string) => void;
  onReopenItem: (itemId: string, reason: string) => void;
}

export function ChecklistEngine({
  items,
  currentRole,
  onToggleComplete,
  onReopenItem,
}: ChecklistEngineProps) {
  const [reopenModal, setReopenModal] = useState<ChecklistItem | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const handleConfirmReopen = () => {
    if (!reopenModal || !reopenReason.trim()) return;
    onReopenItem(reopenModal.id, reopenReason.trim());
    setReopenModal(null);
    setReopenReason('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Daily Operational Checklists &amp; Digital Sign-Off
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Checkboxes lock permanently upon completion. Only Super Admin can reopen with mandatory audit reason.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
          <span>Completed: </span>
          <span className="text-emerald-700 font-bold">
            {items.filter((i) => i.isCompleted).length} / {items.length}
          </span>
        </div>
      </div>

      {/* Checklist Tasks */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
            No checklists found in the database. Run <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-700 font-mono">supabase/schema.sql</code> in the Supabase SQL editor to seed operational checklists.
          </div>
        ) : (
          items.map((item) => (
            <div

            key={item.id}
            className={`p-4 rounded-xl border transition-all ${
              item.isCompleted
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {/* Custom Digital Checkbox */}
                <button
                  disabled={item.isCompleted}
                  onClick={() => onToggleComplete(item.id)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 mt-0.5 ${
                    item.isCompleted
                      ? 'bg-emerald-600 text-white cursor-not-allowed shadow-sm'
                      : 'bg-white border border-slate-300 hover:border-emerald-600 text-transparent'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold text-sm ${item.isCompleted ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                      {item.title}
                    </h4>
                    {item.priority === 'CRITICAL' && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.2 rounded uppercase">
                        Critical
                      </span>
                    )}
                    {item.isCompleted && (
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-mono px-2 py-0.2 rounded flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600" /> LOCKED
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-xs text-slate-600 mt-1">{item.description}</p>
                  )}

                  {/* Metadata Stamp when checked */}
                  {item.isCompleted && (
                    <div className="mt-2 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-lg font-mono flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1 font-semibold">
                        <UserCheck className="w-3 h-3" /> Completed By: {item.completedByName || 'Ops User'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Completed At:{' '}
                        {item.completedAt
                          ? new Date(item.completedAt).toLocaleString('en-GB', {
                              timeZone: 'Africa/Cairo',
                            })
                          : 'Just Now'}
                      </span>
                    </div>
                  )}

                  {/* Reopen Audit Banner if item was reopened */}
                  {item.reopenedByName && (
                    <div className="mt-2 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 p-2 rounded-lg font-mono">
                      <p>
                        <span className="font-bold text-amber-800">REOPENED BY ADMIN:</span> {item.reopenedByName} at{' '}
                        {new Date(item.reopenedAt!).toLocaleString('en-GB', { timeZone: 'Africa/Cairo' })}
                      </p>
                       <p className="text-slate-600 mt-0.5">Reason: &quot;{item.reopenReason}&quot;</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reopen Button for Super Admin */}
              {item.isCompleted && currentRole === 'SUPER_ADMIN' && (
                <button
                  onClick={() => setReopenModal(item)}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Reopen
                </button>
              )}
            </div>
          </div>
        )))}
      </div>


      {/* Super Admin Reopen Modal */}
      {reopenModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-amber-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <Unlock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Super Admin Checklist Unlock</h4>
                <p className="text-xs text-amber-700">Mandatory Reopen Reason Required</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              Task: &quot;{reopenModal.title}&quot;
            </div>

            <textarea
              rows={3}
              placeholder="State explicit reason for reopening locked review..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setReopenModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={!reopenReason.trim()}
                onClick={handleConfirmReopen}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 shadow-md shadow-amber-600/20"
              >
                Confirm Reopen &amp; Log Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
