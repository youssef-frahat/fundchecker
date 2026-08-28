// Checklist Engine Component - Locked Checkboxes, Digital Sign-off & Reopen Modal

'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
  ShieldCheck,
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg text-slate-100">
              Daily Operational Checklists &amp; Digital Sign-Off
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Checkboxes lock permanently upon completion. Only Super Admin can reopen with mandatory audit reason.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          <span>Completed: </span>
          <span className="text-emerald-400 font-bold">
            {items.filter((i) => i.isCompleted).length} / {items.length}
          </span>
        </div>
      </div>

      {/* Checklist Tasks */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-xl border transition-all ${
              item.isCompleted
                ? 'bg-slate-950/80 border-slate-800/80 text-slate-300'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-100'
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
                      ? 'bg-emerald-500 text-slate-950 cursor-not-allowed shadow-md shadow-emerald-500/20'
                      : 'bg-slate-800 border border-slate-700 hover:border-emerald-500 text-transparent'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold text-sm ${item.isCompleted ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                      {item.title}
                    </h4>
                    {item.priority === 'CRITICAL' && (
                      <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold px-2 py-0.2 rounded uppercase">
                        Critical
                      </span>
                    )}
                    {item.isCompleted && (
                      <span className="bg-slate-800 text-slate-400 text-[10px] font-mono px-2 py-0.2 rounded flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-400" /> LOCKED
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                  )}

                  {/* Metadata Stamp when checked */}
                  {item.isCompleted && (
                    <div className="mt-2 text-[11px] text-emerald-400/90 bg-emerald-950/40 border border-emerald-500/20 p-2 rounded-lg font-mono flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1">
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
                    <div className="mt-2 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/20 p-2 rounded-lg font-mono">
                      <p>
                        <span className="font-semibold text-amber-400">REOPENED BY ADMIN:</span> {item.reopenedByName} at{' '}
                        {new Date(item.reopenedAt!).toLocaleString('en-GB', { timeZone: 'Africa/Cairo' })}
                      </p>
                      <p className="text-slate-400 mt-0.5">Reason: "{item.reopenReason}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reopen Button for Super Admin */}
              {item.isCompleted && currentRole === 'SUPER_ADMIN' && (
                <button
                  onClick={() => setReopenModal(item)}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 shrink-0"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Reopen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Super Admin Reopen Modal */}
      {reopenModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <Unlock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-100">Super Admin Checklist Unlock</h4>
                <p className="text-xs text-amber-400/90">Mandatory Reopen Reason Required</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-medium text-slate-300">
              Task: "{reopenModal.title}"
            </div>

            <textarea
              rows={3}
              placeholder="State explicit reason for reopening locked review..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setReopenModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
              >
                Cancel
              </button>
              <button
                disabled={!reopenReason.trim()}
                onClick={handleConfirmReopen}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 shadow-lg shadow-amber-500/20"
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
