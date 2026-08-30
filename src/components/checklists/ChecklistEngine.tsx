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
  onReopenItem: (itemId: string, reason: string) => void;
}

export function ChecklistEngine({
  items,
  currentRole,
  onToggleComplete,
  onApproveItem,
  onReopenItem,
}: ChecklistEngineProps) {
  const [reopenModal, setReopenModal] = useState<ChecklistItem | null>(null);
  const [reopenReason, setReopenReason] = useState('');
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
              دورة التشغيل اليومية للصناديق والاعتماد الرقمي (Daily Fund Operational Checklists)
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            المنفذ يقوم بالتنفيذ والتراجع بحرية قبل الاعتماد. عند اعتماد السوبر أدمن، تقفل المهمة نهائياً ويتم توثيق التوقيعين.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-mono text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <span>المنجز: </span>
            <span className="text-emerald-700 font-bold">
              {completedCount} / {items.length}
            </span>
          </div>
          <div className="text-xs font-mono text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span>المعتمد نهائياً: </span>
            <span className="font-bold text-emerald-700">
              {approvedCount} / {items.length}
            </span>
          </div>
        </div>
      </div>

      {/* Checklist Tasks */}
      <div className="space-y-3.5">
        {items.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs">
            لا توجد خطوات مسجلة. جاري تحميل خطوات التشغيل من قاعدة البيانات...
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
                      disabled={item.isApproved}
                      onClick={() => onToggleComplete(item.id, !item.isCompleted)}
                      title={
                        item.isApproved
                          ? 'مقفل نهائياً بعد اعتماد السوبر أدمن'
                          : item.isCompleted
                          ? 'انقر هنا للتراجع عن علامة الصح (Undo)'
                          : 'انقر للتأكيد والتنفيذ'
                      }
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 mt-0.5 ${
                        item.isApproved
                          ? 'bg-emerald-700 text-white cursor-not-allowed shadow-xs'
                          : item.isCompleted
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                          : isMissedDeadline
                          ? 'bg-white border-2 border-rose-500 text-transparent hover:bg-rose-50'
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
                          الديدلاين: {item.dueTime}
                        </span>

                        {/* Priority Badge */}
                        {item.priority === 'CRITICAL' && (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.2 rounded uppercase">
                            هام وحرج
                          </span>
                        )}

                        {/* Missed Warning Badge */}
                        {isMissedDeadline && (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            تجاوز موعد التنفيذ - غير مكتمل!
                          </span>
                        )}

                        {/* Status Badges */}
                        {item.isApproved ? (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                            <Lock className="w-3 h-3 text-emerald-700" /> معتمد ومقفل نهائياً
                          </span>
                        ) : item.isCompleted ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-700" /> تم التنفيذ - بانتظار اعتماد السوبر أدمن
                          </span>
                        ) : null}
                      </div>

                      {/* Description (Arabic Operational Explanation) */}
                      {item.description && (
                        <div
                          dir="rtl"
                          className={`mt-2 text-xs leading-relaxed p-2 rounded-lg border ${
                            isMissedDeadline
                              ? 'bg-rose-50/80 border-rose-200 text-rose-800 font-medium'
                              : item.isApproved
                              ? 'bg-emerald-50/50 border-emerald-200 text-slate-700'
                              : 'bg-slate-50/80 border-slate-200/80 text-slate-700'
                          }`}
                        >
                          <span className="font-bold text-slate-900 ml-1">الوصف التشغيلي:</span>
                          <span>{item.description}</span>
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
                            <span>نفّذ بواسطة:</span>
                            <span className="underline decoration-emerald-500">
                              {item.completedByName || 'المنفذ'}
                            </span>
                            <span className="text-slate-500 font-normal">
                              ({formatCairoDate(item.completedAt)})
                            </span>
                          </span>

                          {/* Super Admin Approval Signature */}
                          {item.isApproved && (
                            <span className="flex items-center gap-1.5 font-bold text-emerald-900">
                              <ShieldCheck className="w-4 h-4 text-emerald-700" />
                              <span>اعتمد وقفل بواسطة (Super Admin):</span>
                              <span className="underline decoration-emerald-700">
                                {item.approvedByName || 'سوبر أدمن'}
                              </span>
                              <span className="text-slate-500 font-normal">
                                ({formatCairoDate(item.approvedAt)})
                              </span>
                            </span>
                          )}

                          {/* Undo Notice for Operator */}
                          {!item.isApproved && (
                            <span className="text-[10px] text-slate-500 italic">
                              (يمكنك الضغط على المربع للتراجع عن التنفيذ قبل اعتماد السوبر أدمن)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reopen Audit Banner */}
                      {item.reopenedByName && !item.isApproved && (
                        <div className="mt-2 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 p-2 rounded-lg font-mono">
                          <p>
                            <span className="font-bold text-amber-800">أعيد فتحه بواسطة الإدارة:</span>{' '}
                            {item.reopenedByName} في {formatCairoDate(item.reopenedAt)}
                          </p>
                          <p className="text-slate-600 mt-0.5">سبب إعادة الفتح: &quot;{item.reopenReason}&quot;</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Column: Approve or Reopen */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Super Admin Approve & Lock Button */}
                    {item.isCompleted && !item.isApproved && currentRole === 'SUPER_ADMIN' && onApproveItem && (
                      <button
                        onClick={() => onApproveItem(item.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        title="اعتماد وقفل المهمة نهائياً لمنع أي تعديل"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>اعتماد وقفل نهائي</span>
                      </button>
                    )}

                    {/* Operator Undo Button */}
                    {item.isCompleted && !item.isApproved && (
                      <button
                        onClick={() => onToggleComplete(item.id, false)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1"
                        title="تراجع عن علامة الصح"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>تراجع</span>
                      </button>
                    )}

                    {/* Super Admin Reopen Button for Locked Items */}
                    {item.isApproved && currentRole === 'SUPER_ADMIN' && (
                      <button
                        onClick={() => setReopenModal(item)}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1"
                        title="إعادة فتح المهمة المقفلة لسبب طارئ"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>إعادة فتح</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
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
                <h4 className="font-bold text-base text-slate-900">إعادة فتح مهمة مقفلة (Super Admin)</h4>
                <p className="text-xs text-amber-700">يتطلب كتابة سبب واضح وموثق في سجل الأوديت</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              المهمة: &quot;{reopenModal.title}&quot;
            </div>

            <textarea
              rows={3}
              placeholder="اكتب سبب إعادة فتح المهمة المقفلة للمطابقة والرقابة..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setReopenModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100"
              >
                إلغاء
              </button>
              <button
                disabled={!reopenReason.trim()}
                onClick={handleConfirmReopen}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 shadow-md shadow-amber-600/20"
              >
                تأكيد إعادة الفتح وتوثيق الحركة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
