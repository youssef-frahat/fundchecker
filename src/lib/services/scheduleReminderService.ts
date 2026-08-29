import { ReferenceData, ScheduleReminderItem } from '../types';

/**
 * Evaluates today's operational schedule reminders based on Egyptian fund calendar.
 * Supports:
 * - Day 18 Notice Reminders (e.g. Maksab OZ)
 * - Thursday Notice Reminders (Weekly funds for Sunday execution)
 * - Wednesday 14:00 Cutoff Notice Reminders (Zaldi El Masry)
 * - Sunday Execution Reminders (All weekly funds)
 * - Monday Execution Reminders (1st Monday, 2nd & 4th Monday)
 */
export function getScheduleRemindersForDate(
  referenceDataList: ReferenceData[],
  targetDate: Date = new Date()
): ScheduleReminderItem[] {
  const day = targetDate.getDate();
  const weekday = targetDate.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const occurrence = Math.ceil(day / 7);
  const reminders: ScheduleReminderItem[] = [];

  for (const ref of referenceDataList) {
    if (ref.status === 'CLOSED' || ref.status === 'ARCHIVED') continue;

    const raw = (ref.executionInstruction || '').trim();
    const fundLabel = `${ref.symbolName} (${ref.symbolCode})`;

    // 1. Day 18 Notice Reminder
    if (day === 18 && (raw.includes('اخطار يوم 18') || raw.includes('يوم 18') || ref.scheduleFrequency === 'MONTHLY')) {
      reminders.push({
        id: `rem-day18-${ref.symbolCode}`,
        fundCode: ref.symbolCode,
        fundName: ref.symbolName,
        type: 'NOTICE_DUE',
        title: `Monthly Notice Due: ${ref.symbolCode}`,
        message: `Day 18 of the month: Send redemption notice for fund ${fundLabel} for execution on the 1st Monday of next month.`,
        rawInstruction: raw,
        cutoffTime: '12:00',
        urgency: 'HIGH',
      });
    }

    // 2. Thursday Notice Reminder (for Sunday execution)
    if (weekday === 4 && (raw.includes('اخطار الخميس') || (ref.scheduleFrequency === 'WEEKLY' && raw.includes('الخميس')))) {
      reminders.push({
        id: `rem-thu-${ref.symbolCode}`,
        fundCode: ref.symbolCode,
        fundName: ref.symbolName,
        type: 'NOTICE_DUE',
        title: `Weekly Notice Due: ${ref.symbolCode}`,
        message: `Thursday Notice: Dispatch notice for ${fundLabel} to custodian before cutoff for Sunday execution.`,
        rawInstruction: raw,
        cutoffTime: '13:00',
        urgency: 'HIGH',
      });
    }

    // 3. Wednesday Notice Reminder (Zaldi El Masry - Cutoff 14:00)
    if (weekday === 3 && (raw.includes('اخطار الاربعاء') || raw.includes('الاربعاء'))) {
      reminders.push({
        id: `rem-wed-${ref.symbolCode}`,
        fundCode: ref.symbolCode,
        fundName: ref.symbolName,
        type: 'NOTICE_DUE',
        title: `Weekly Notice Due: ${ref.symbolCode}`,
        message: `Wednesday Notice: Send notice for ${fundLabel} before 14:00 cutoff for Sunday execution.`,
        rawInstruction: raw,
        cutoffTime: '14:00',
        urgency: 'HIGH',
      });
    }

    // 4. Sunday Execution Reminder
    if (weekday === 0 && (raw.includes('التنفيذ الاحد') || raw.includes('اخطار الخميس') || raw.includes('اخطار الاربعاء'))) {
      reminders.push({
        id: `rem-sun-exec-${ref.symbolCode}`,
        fundCode: ref.symbolCode,
        fundName: ref.symbolName,
        type: 'EXECUTION_DUE',
        title: `Weekly Execution Due: ${ref.symbolCode}`,
        message: `Sunday Execution: Execute weekly transactions for ${fundLabel} following prior notices.`,
        rawInstruction: raw,
        urgency: 'MEDIUM',
      });
    }

    // 5. Monday Execution Reminders
    if (weekday === 1) {
      // 2nd and 4th Monday
      if (raw.includes('ثاني اسبوع ورابع اسبوع') || raw.includes('2nd') || raw.includes('4th')) {
        if (occurrence === 2 || occurrence === 4) {
          reminders.push({
            id: `rem-mon-biweek-${ref.symbolCode}`,
            fundCode: ref.symbolCode,
            fundName: ref.symbolName,
            type: 'EXECUTION_DUE',
            title: `Bi-Weekly Execution Due: ${ref.symbolCode}`,
            message: `Monday (Week ${occurrence} of month): Execution day for unit sales of fund ${fundLabel}.`,
            rawInstruction: raw,
            urgency: 'HIGH',
          });
        }
      }
      // 1st Monday (after Day 18)
      else if (raw.includes('اول يوم اثنين') || raw.includes('1st Monday')) {
        if (occurrence === 1) {
          reminders.push({
            id: `rem-mon-first-${ref.symbolCode}`,
            fundCode: ref.symbolCode,
            fundName: ref.symbolName,
            type: 'EXECUTION_DUE',
            title: `Monthly Execution Due: ${ref.symbolCode}`,
            message: `First Monday of month: Execution day for unit sales/redemptions of fund ${fundLabel}.`,
            rawInstruction: raw,
            urgency: 'HIGH',
          });
        }
      }
      // Every Monday
      else if (raw.includes('اسبوعي يوم الاثنين') || raw.includes('يوم الاثنين')) {
        reminders.push({
          id: `rem-mon-weekly-${ref.symbolCode}`,
          fundCode: ref.symbolCode,
          fundName: ref.symbolName,
          type: 'EXECUTION_DUE',
          title: `Weekly Execution Due: ${ref.symbolCode}`,
          message: `Monday Execution: Weekly execution for fund ${fundLabel}.`,
          rawInstruction: raw,
          urgency: 'INFO',
        });
      }
    }
  }

  return reminders;
}
