// ScheduleReminderSnackbar - FinTech Operational Cycle Reminder
// Alerts on Day 18, Thursdays, Wednesdays (14:00 cutoff), Sundays, and Mondays

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { ReferenceData, ScheduleReminderItem } from '@/lib/types';
import { getScheduleRemindersForDate } from '@/lib/services/scheduleReminderService';

interface ScheduleReminderSnackbarProps {
  referenceDataList: ReferenceData[];
}

export function ScheduleReminderSnackbar({ referenceDataList }: ScheduleReminderSnackbarProps) {
  const [simulatedDate, setSimulatedDate] = useState<Date | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const effectiveDate = useMemo(() => simulatedDate || new Date(), [simulatedDate]);
  const reminders: ScheduleReminderItem[] = useMemo(() => {
    return getScheduleRemindersForDate(referenceDataList, effectiveDate);
  }, [referenceDataList, effectiveDate]);

  // Auto-expand if high-urgency reminders exist on mount
  useEffect(() => {
    if (reminders.some((r) => r.urgency === 'HIGH')) {
      const timer = setTimeout(() => setIsExpanded(true), 0);
      return () => clearTimeout(timer);
    }
  }, [reminders]);

  if (isDismissed || reminders.length === 0) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => {
            setIsDismissed(false);
            setIsExpanded(true);
          }}
          className="flex items-center gap-2 px-3 py-2 bg-white text-slate-800 rounded-full shadow-lg border border-slate-200 hover:border-emerald-500 text-xs font-semibold transition"
          title="View fund cycle reminders"
        >
          <Bell className="w-4 h-4 text-emerald-600" />
          <span>Cycle Reminders ({reminders.length})</span>
        </button>
      </div>
    );
  }

  const noticeCount = reminders.filter((r) => r.type === 'NOTICE_DUE').length;
  const executionCount = reminders.filter((r) => r.type === 'EXECUTION_DUE').length;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-3.5 bg-slate-800/90 border-b border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white tracking-wide">
                  Daily Fund Cycle Reminders
                </h4>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  {reminders.length} tasks
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {effectiveDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition"
              title="Dismiss reminder"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Summary Pill Bar */}
        <div className="px-3.5 py-2 bg-slate-800/40 flex items-center justify-between text-[11px] text-slate-300 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {noticeCount > 0 && (
              <span className="flex items-center gap-1 text-amber-300 font-medium">
                <Clock className="w-3 h-3" /> {noticeCount} Notice Due
              </span>
            )}
            {executionCount > 0 && (
              <span className="flex items-center gap-1 text-emerald-300 font-medium">
                <CheckCircle2 className="w-3 h-3" /> {executionCount} Execution Due
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Cycle Engine
          </span>
        </div>

        {/* Expanded Reminders List */}
        {isExpanded && (
          <div className="p-3 max-h-72 overflow-y-auto space-y-2 divide-y divide-slate-800/60 font-sans">
            {reminders.map((item) => (
              <div key={item.id} className="pt-2 first:pt-0 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {item.title}
                  </span>
                  {item.cutoffTime && (
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 rounded font-mono">
                      Cutoff: {item.cutoffTime}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {item.message}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Rule: {item.rawInstruction}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Simulation / Date Tester Toolbar */}
        <div className="p-2.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1 text-slate-400">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Simulate:</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSimulatedDate(null)}
              className={`px-1.5 py-0.5 rounded transition ${
                simulatedDate === null
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-800'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setSimulatedDate(new Date(2026, 8, 18))} // 18 September
              className={`px-1.5 py-0.5 rounded transition ${
                simulatedDate?.getDate() === 18
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-800'
              }`}
            >
              Day 18
            </button>
            <button
              onClick={() => setSimulatedDate(new Date(2026, 8, 3))} // Thursday
              className={`px-1.5 py-0.5 rounded transition ${
                simulatedDate?.getDay() === 4
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-800'
              }`}
            >
              Thursday
            </button>
            <button
              onClick={() => setSimulatedDate(new Date(2026, 8, 2))} // Wednesday
              className={`px-1.5 py-0.5 rounded transition ${
                simulatedDate?.getDay() === 3
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-800'
              }`}
            >
              Wednesday
            </button>
            <button
              onClick={() => setSimulatedDate(new Date(2026, 8, 6))} // Sunday
              className={`px-1.5 py-0.5 rounded transition ${
                simulatedDate?.getDay() === 0
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-800'
              }`}
            >
              Sunday
            </button>
            <button
              onClick={() => setSimulatedDate(new Date(2026, 8, 14))} // 2nd Monday
              className={`px-1.5 py-0.5 rounded transition ${
                simulatedDate?.getDay() === 1
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-800'
              }`}
            >
              Monday
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
