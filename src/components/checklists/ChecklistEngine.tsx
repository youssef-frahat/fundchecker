// Checklist Engine Component (Two-Tier Sign-off & Real Fund Operational Cycle)

'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Lock,
  Unlock,
  Clock,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { ChecklistItem, UserRole } from '@/lib/types';

interface ChecklistEngineProps {
  items: ChecklistItem[];
  currentRole: UserRole;
  onToggleComplete: (itemId: string, nextStatus: boolean) => void;
  onApproveItem?: (itemId: string) => void;
  onResolveLateItem?: (itemId: string, resolution: 'RESOLVED' | 'BREACHED', reason: string) => void;
  onResetDailyShift?: () => void;
  onReopenItem: (itemId: string, reason: string) => void;
}

export function ChecklistEngine({
  items,
  currentRole,
  onToggleComplete,
  onApproveItem,
  onResolveLateItem,
  onResetDailyShift,
  onReopenItem,
}: ChecklistEngineProps) {
  const [reopenModal, setReopenModal] = useState<ChecklistItem | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [lateResolutionModal, setLateResolutionModal] = useState<ChecklistItem | null>(null);
  const [lateResolutionType, setLateResolutionType] = useState<'RESOLVED' | 'BREACHED'>('RESOLVED');
  const [lateResolutionReason, setLateResolutionReason] = useState('');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [cairoMinutes, setCairoMinutes] = useState<number>(0);

  // Keep Cairo time in sync every 30 seconds
  useEffect(() => {
    const updateTime = () => {
      const cairoStr = new Date().toLocaleTimeString('en-GB', {
        timeZone: 'Africa/Cairo',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });
      const [hh, mm] = cairoStr.split(':').map(Number);
      setCairoMinutes(hh * 60 + mm);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleConfirmReopen = () => {
    if (!reopenModal || !reopenReason.trim()) return;
    onReopenItem(reopenModal.id, reopenReason.trim());
    setReopenModal(null);
    setReopenReason('');
  };

  const handleConfirmLateResolution = () => {
    if (!lateResolutionModal || !lateResolutionReason.trim() || !onResolveLateItem) return;
    onResolveLateItem(lateResolutionModal.id, lateResolutionType, lateResolutionReason.trim());
    setLateResolutionModal(null);
    setLateResolutionReason('');
    setLateResolutionType('RESOLVED');
  };

  const handleConfirmResetDailyShift = () => {
    if (!onResetDailyShift) return;
    onResetDailyShift();
    setShowResetConfirmModal(false);
  };

  const parseCutoffMinutes = (timeStr?: string): number => {
    if (!timeStr) return 9999;
    const [hh, mm] = timeStr.split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };

  const formatCairoDate = (isoStr?: string) => {
    if (!isoStr) return 'Just Now';
    return new Date(isoStr).toLocaleString('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const completedCount = items.filter((i) => i.isCompleted).length;
  const approvedCount = items.filter((i) => i.isApproved).length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-lg text-slate-900">
              Daily Fund Operational Checklists &amp; Digital Sign-off
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Operators execute compliance items prior to cutoffs. Overdue items lock automatically and require Super Admin override. Daily shift cycle resets at 06:00 AM Cairo.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="text-xs font-mono text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <span>Completed: </span>
            <span className="text-emerald-700 font-bold">
              {completedCount} / {items.length}
            </span>
          </div>
          <div className="text-xs font-mono text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span>Approved &amp; Locked: </span>
            <span className="font-bold text-emerald-700">
              {approvedCount} / {items.length}
            </span>
          </div>

          {/* Super Admin Reset Day Shift Button */}
          {currentRole === 'SUPER_ADMIN' && onResetDailyShift && (
            <button
              onClick={() => setShowResetConfirmModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition shadow-2xs"
              title="Reset checklists for new operational business day"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Start New Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Checklist Tasks */}
      <div className="space-y-3.5">
        {items.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
            No checklist items found. Loading operational workflows from database...
          </div>
        ) : (
          items.map((item) => {
            const cutoffMin = parseCutoffMinutes(item.dueTime);
            const isPastCutoff = cairoMinutes > cutoffMin;
            const isMissedDeadline = isPastCutoff && !item.isCompleted;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.isApproved
                    ? 'bg-emerald-50/40 border-emerald-300 text-slate-800 shadow-2xs'
                    : item.isCompleted
                    ? 'bg-slate-50/80 border-slate-300 text-slate-800'
                    : isMissedDeadline
                    ? 'bg-rose-50/70 border-rose-300 text-slate-900 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Digital Checkbox */}
                    <button
                      disabled={item.isApproved || (isMissedDeadline && currentRole !== 'SUPER_ADMIN')}
                      onClick={() => {
                        if (isMissedDeadline) {
                          if (currentRole === 'SUPER_ADMIN') {
                            setLateResolutionModal(item);
                          }
                          return;
                        }
                        onToggleComplete(item.id, !item.isCompleted);
                      }}
                      title={
                        item.isApproved
                          ? 'Finalized and locked post Super Admin sign-off'
                          : isMissedDeadline
                          ? currentRole === 'SUPER_ADMIN'
                            ? 'Click to open late resolution override and submit mandatory justification'
                            : '🔒 Locked: Cutoff deadline elapsed for operators'
                          : item.isCompleted
                          ? 'Click to undo completion mark'
                          : 'Click to confirm and execute task'
                      }
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 mt-0.5 ${
                        item.isApproved
                          ? 'bg-emerald-700 text-white cursor-not-allowed shadow-xs'
                          : item.isCompleted
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                          : isMissedDeadline
                          ? currentRole === 'SUPER_ADMIN'
                            ? 'bg-rose-50 border-2 border-rose-500 text-rose-500 hover:bg-rose-100 cursor-pointer shadow-xs'
                            : 'bg-rose-100 border-2 border-rose-400 text-rose-500 cursor-not-allowed'
                          : 'bg-white border border-slate-300 hover:border-emerald-600 text-transparent'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                    </button>

                    <div className="flex-1">
                      {/* Title & Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.checklistId}
                        </span>

                        <h4
                          className={`font-semibold text-sm ${
                            item.isApproved
                              ? 'text-emerald-950 font-bold'
                              : item.isCompleted
                              ? 'text-slate-700'
                              : isMissedDeadline
                              ? 'text-rose-900 font-bold'
                              : 'text-slate-900'
                          }`}
                        >
                          {item.title}
                        </h4>

                        {/* Cutoff Time Badge */}
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                            isMissedDeadline
                              ? 'bg-rose-600 text-white animate-pulse'
                              : isPastCutoff
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          Deadline: {item.dueTime}
                        </span>

                        {/* Priority Badge */}
                        {item.priority === 'CRITICAL' && (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.2 rounded uppercase">
                            CRITICAL / MANDATORY
                          </span>
                        )}

                        {/* Missed Warning Badge */}
                        {isMissedDeadline && (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            OVERDUE - INCOMPLETE!
                          </span>
                        )}

                        {/* Late Resolved / Breached Status Badges */}
                        {item.status === 'LATE_RESOLVED' && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Late Override Approved
                          </span>
                        )}
                        {item.status === 'BREACHED' && (
                          <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-white" />
                            Operational Breach Logged
                          </span>
                        )}

                        {/* Standard Status Badges */}
                        {item.isApproved ? (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <Lock className="w-3 h-3 text-emerald-700" /> Approved &amp; Locked
                          </span>
                        ) : item.isCompleted ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-700" /> Completed - Pending Super Admin Sign-off
                          </span>
                        ) : null}
                      </div>

                      {/* Description (Operational Explanation) */}
                      {item.description && (
                        <div
                          className={`mt-2 text-xs leading-relaxed p-2 rounded-lg border ${
                            isMissedDeadline
                              ? 'bg-rose-50/80 border-rose-200 text-rose-800 font-medium'
                              : item.isApproved
                              ? 'bg-emerald-50/50 border-emerald-200 text-slate-700'
                              : 'bg-slate-50/80 border-slate-200/80 text-slate-700'
                          }`}
                        >
                          <span className="font-bold text-slate-900 mr-1">Operational Description:</span>
                          <span>{item.description}</span>
                        </div>
                      )}

                      {/* Operator Locked Notice if Past Cutoff */}
                      {isMissedDeadline && !item.isCompleted && currentRole !== 'SUPER_ADMIN' && (
                        <div className="mt-2 text-[11px] text-rose-800 bg-rose-100/70 border border-rose-300 p-2 rounded-lg font-mono flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Cutoff deadline has elapsed. Task is locked for operators and requires Super Admin intervention.</span>
                        </div>
                      )}

                      {/* Super Admin Guidance Notice if Past Cutoff */}
                      {isMissedDeadline && !item.isCompleted && currentRole === 'SUPER_ADMIN' && (
                        <div className="mt-2 text-[11px] text-rose-950 bg-rose-100/80 border border-rose-300 p-2.5 rounded-lg font-mono flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Task has exceeded its cutoff deadline ({item.dueTime}). Direct checkbox confirmation is locked; click &quot;Late Override&quot; to submit mandatory audit justification.</span>
                          </div>
                        </div>
                      )}

                      {/* Two-Tier Signatures Banner */}
                      {item.isCompleted && (
                        <div
                          className={`mt-2.5 text-[11px] p-2.5 rounded-xl font-mono flex flex-wrap items-center gap-x-6 gap-y-1.5 ${
                            item.isApproved
                              ? 'bg-emerald-100/70 border border-emerald-300 text-emerald-950'
                              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                          }`}
                        >
                          {/* Operator Signature */}
                          <span className="flex items-center gap-1.5 font-bold">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Executed by:</span>
                            <span className="underline decoration-emerald-500">
                              {item.completedByName || 'Operator'}
                            </span>
                            <span className="text-slate-500 font-normal">
                              ({formatCairoDate(item.completedAt)})
                            </span>
                          </span>

                          {/* Super Admin Approval Signature */}
                          {item.isApproved && (
                            <span className="flex items-center gap-1.5 font-bold text-emerald-900">
                              <ShieldCheck className="w-4 h-4 text-emerald-700" />
                              <span>Approved &amp; Locked by (Super Admin):</span>
                              <span className="underline decoration-emerald-700">
                                {item.approvedByName || 'Super Admin'}
                              </span>
                              <span className="text-slate-500 font-normal">
                                ({formatCairoDate(item.approvedAt)})
                              </span>
                            </span>
                          )}

                          {/* Undo Notice for Operator */}
                          {!item.isApproved && (
                            <span className="text-[10px] text-slate-500 italic">
                              (Click checkbox to undo completion before Super Admin sign-off)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reopen Audit Banner */}
                      {item.reopenedByName && !item.isApproved && (
                        <div className="mt-2 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 p-2 rounded-lg font-mono">
                          <p>
                            <span className="font-bold text-amber-800">Reopened by Management:</span>{' '}
                            {item.reopenedByName} at {formatCairoDate(item.reopenedAt)}
                          </p>
                          <p className="text-slate-600 mt-0.5">Reopen Reason: &quot;{item.reopenReason}&quot;</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Column: Approve, Late Override, Undo, or Reopen */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Super Admin Late Resolution Override Button */}
                    {isMissedDeadline && !item.isCompleted && currentRole === 'SUPER_ADMIN' && onResolveLateItem && (
                      <button
                        onClick={() => setLateResolutionModal(item)}
                        className="bg-rose-600 hover:bg-rose-700 text-white shadow-xs px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                        title="Super Admin exception resolution for overdue task"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Late Override</span>
                      </button>
                    )}

                    {/* Super Admin Standard Approve & Lock Button */}
                    {item.isCompleted && !item.isApproved && currentRole === 'SUPER_ADMIN' && onApproveItem && (
                      <button
                        onClick={() => onApproveItem(item.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        title="Approve and lock task permanently against modification"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Approve &amp; Lock</span>
                      </button>
                    )}

                    {/* Operator Undo Button */}
                    {item.isCompleted && !item.isApproved && (
                      <button
                        onClick={() => onToggleComplete(item.id, false)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1"
                        title="Undo completion mark"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Undo</span>
                      </button>
                    )}

                    {/* Super Admin Reopen Button for Locked Items */}
                    {item.isApproved && currentRole === 'SUPER_ADMIN' && (
                      <button
                        onClick={() => setReopenModal(item)}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1"
                        title="Reopen locked task for audited emergency adjustment"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Reopen</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Super Admin Late Resolution Modal */}
      {lateResolutionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-rose-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Super Admin Late Resolution Override</h4>
                <p className="text-xs text-rose-600">Cutoff Deadline: {lateResolutionModal.dueTime}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              Task: &quot;{lateResolutionModal.title}&quot;
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Regulatory Action Type:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLateResolutionType('RESOLVED')}
                  className={`p-2.5 rounded-xl text-xs font-bold border text-center transition ${
                    lateResolutionType === 'RESOLVED'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ✅ Resolve &amp; Execute
                </button>
                <button
                  type="button"
                  onClick={() => setLateResolutionType('BREACHED')}
                  className={`p-2.5 rounded-xl text-xs font-bold border text-center transition ${
                    lateResolutionType === 'BREACHED'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ❌ Record Breach
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Overdue Justification (Mandatory for Audit Trail):</label>
              <textarea
                rows={3}
                placeholder="State the operational cause or impediment for exceeding the cutoff deadline..."
                value={lateResolutionReason}
                onChange={(e) => setLateResolutionReason(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setLateResolutionModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!lateResolutionReason.trim()}
                onClick={handleConfirmLateResolution}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Confirm Resolution &amp; Record Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Reset Shift Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <RotateCcw className="w-6 h-6 text-slate-700" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Start New Operational Shift</h4>
                <p className="text-xs text-slate-600">Reset checklists for new operational business day</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to reset the checklist status for all funds and begin a new operational shift?
              All previous execution logs and digital signatures remain permanently preserved in the immutable audit trail.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResetDailyShift}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/20 cursor-pointer"
              >
                Confirm Shift Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Reopen Modal */}
      {reopenModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-amber-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <Unlock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Reopen Finalized Task (Super Admin)</h4>
                <p className="text-xs text-amber-700">Requires audited justification documented in regulatory trail</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              Task: &quot;{reopenModal.title}&quot;
            </div>

            <textarea
              rows={3}
              placeholder="State the operational reason for reopening this locked task for reconciliation..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setReopenModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!reopenReason.trim()}
                onClick={handleConfirmReopen}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 shadow-md shadow-amber-600/20 cursor-pointer"
              >
                Confirm Reopen &amp; Record Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
