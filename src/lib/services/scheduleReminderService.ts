import { ReferenceData, ScheduleReminderItem } from '../types';

/**
 * Normalizes text for robust Arabic and English matching
 */
function normalizeInstructionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

interface WeekdayDefinition {
  dayIndex: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  nameEn: string;
  nameAr: string;
  tokens: string[];
}

const WEEKDAYS_MAP: WeekdayDefinition[] = [
  { dayIndex: 0, nameEn: 'Sunday', nameAr: 'الأحد', tokens: ['احد', 'أحد', 'الأحد', 'الاحد', 'sunday', 'sun'] },
  { dayIndex: 1, nameEn: 'Monday', nameAr: 'الاثنين', tokens: ['اثنين', 'إثنين', 'الإثنين', 'الاثنين', 'تنين', 'monday', 'mon'] },
  { dayIndex: 2, nameEn: 'Tuesday', nameAr: 'الثلاثاء', tokens: ['ثلاثاء', 'تلات', 'الثلاثاء', 'التلات', 'tuesday', 'tue'] },
  { dayIndex: 3, nameEn: 'Wednesday', nameAr: 'الأربعاء', tokens: ['اربعاء', 'أربعاء', 'الأربعاء', 'الاربعاء', 'wednesday', 'wed'] },
  { dayIndex: 4, nameEn: 'Thursday', nameAr: 'الخميس', tokens: ['خميس', 'الخميس', 'thursday', 'thu'] },
  { dayIndex: 5, nameEn: 'Friday', nameAr: 'الجمعة', tokens: ['جمعه', 'جمعة', 'الجمعة', 'الجمعه', 'friday', 'fri'] },
  { dayIndex: 6, nameEn: 'Saturday', nameAr: 'السبت', tokens: ['سبت', 'السبت', 'saturday', 'sat'] },
];

/**
 * Extracts cutoff time from instruction string (e.g. "الساعة 2", "الساعة 14:00", "Cutoff 13:00")
 */
function extractCutoffTime(text: string): string | undefined {
  const norm = normalizeInstructionText(text);
  const m = norm.match(/(?:ساع[ةه]|cutoff|at)\s*(\d{1,2}(?::\d{2})?)/i);
  if (m && m[1]) {
    const val = m[1];
    if (val.includes(':')) return val;
    const num = parseInt(val, 10);
    // In Egyptian financial ops, 1..6 PM is 13:00..18:00
    if (num >= 1 && num <= 6) return `${num + 12}:00`;
    return `${num < 10 ? '0' + num : num}:00`;
  }
  const directTime = text.match(/\b(\d{1,2}:\d{2})\b/);
  if (directTime) return directTime[1];
  return undefined;
}

/**
 * Extracts specific day of month from text (e.g. "يوم 18", "day 18", "يوم 15")
 */
function extractNoticeDayOfMonth(text: string): number | undefined {
  const norm = normalizeInstructionText(text);
  const m = norm.match(/(?:يوم|day)\s*(\d{1,2})/i);
  if (m && m[1]) {
    const d = parseInt(m[1], 10);
    if (d >= 1 && d <= 31) return d;
  }
  return undefined;
}

/**
 * Dynamically parses and evaluates today's operational schedule reminders.
 * Reads fund instructions (Arabic or English) uploaded via Excel or entered in Admin UI,
 * extracting notice days, cutoff times, execution days, and cycle frequencies dynamically.
 */
export function getScheduleRemindersForDate(
  referenceDataList: ReferenceData[],
  targetDate: Date = new Date()
): ScheduleReminderItem[] {
  const day = targetDate.getDate();
  const weekday = targetDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const occurrence = Math.ceil(day / 7);
  const reminders: ScheduleReminderItem[] = [];

  for (const ref of referenceDataList) {
    if (ref.status === 'CLOSED' || ref.status === 'ARCHIVED') continue;

    const raw = (ref.executionInstruction || '').trim();
    if (!raw) continue;

    const fundLabel = `${ref.symbolName} (${ref.symbolCode})`;
    const norm = normalizeInstructionText(raw);
    const cutoff = extractCutoffTime(raw);
    const dayOfMonth = extractNoticeDayOfMonth(raw);

    // Track reminders added for this fund to prevent duplicate notifications
    let noticeAdded = false;
    let executionAdded = false;

    // 1. Separate into Notice Clause and Execution Clause to prevent day cross-contamination
    let noticeClause = '';
    let executionClause = '';

    const hasNoticeKeyword = norm.includes('اخطار') || norm.includes('notice') || norm.includes('ارسال اخطار');
    const execIndex = norm.search(/تنفيذ|execution|execute/);

    if (hasNoticeKeyword && execIndex !== -1) {
      noticeClause = norm.substring(0, execIndex);
      executionClause = norm.substring(execIndex);
    } else if (hasNoticeKeyword) {
      noticeClause = norm;
    } else {
      executionClause = norm;
    }

    // =========================================================================
    // 1. DYNAMIC NOTICE REMINDERS (اخطار / Notice)
    // =========================================================================

    // A. Day of Month Notice (e.g. "يوم 18 من كل شهر", "يوم 15")
    if (dayOfMonth !== undefined && day === dayOfMonth) {
      reminders.push({
        id: `rem-day${dayOfMonth}-${ref.symbolCode}`,
        fundCode: ref.symbolCode,
        fundName: ref.symbolName,
        type: 'NOTICE_DUE',
        title: `Monthly Notice Due: ${ref.symbolCode}`,
        message: `Day ${dayOfMonth} of the month: Dispatch required operational/redemption notice for ${fundLabel}.`,
        rawInstruction: raw,
        cutoffTime: cutoff || '12:00',
        urgency: 'HIGH',
      });
      noticeAdded = true;
    } else if (day === 18 && (norm.includes('يوم 18') || ref.scheduleFrequency === 'MONTHLY')) {
      // Canonical Day 18 fallback
      reminders.push({
        id: `rem-day18-${ref.symbolCode}`,
        fundCode: ref.symbolCode,
        fundName: ref.symbolName,
        type: 'NOTICE_DUE',
        title: `Monthly Notice Due: ${ref.symbolCode}`,
        message: `Day 18 of the month: Send redemption notice for fund ${fundLabel} for execution on the 1st Monday of next month.`,
        rawInstruction: raw,
        cutoffTime: cutoff || '12:00',
        urgency: 'HIGH',
      });
      noticeAdded = true;
    }

    // B. Weekly / Dynamic Day Notice in noticeClause
    if (!noticeAdded && noticeClause) {
      for (const wd of WEEKDAYS_MAP) {
        if (wd.dayIndex === weekday) {
          const hasDay = wd.tokens.some((token) => noticeClause.includes(token));
          if (hasDay) {
            reminders.push({
              id: `rem-notice-dyn-${wd.dayIndex}-${ref.symbolCode}`,
              fundCode: ref.symbolCode,
              fundName: ref.symbolName,
              type: 'NOTICE_DUE',
              title: `Weekly Notice Due: ${ref.symbolCode}`,
              message: `${wd.nameEn} Notice: Dispatch operational notice for ${fundLabel} before cutoff time.`,
              rawInstruction: raw,
              cutoffTime: cutoff || (wd.dayIndex === 3 ? '14:00' : '13:00'),
              urgency: 'HIGH',
            });
            noticeAdded = true;
            break;
          }
        }
      }
    }

    // =========================================================================
    // 2. DYNAMIC EXECUTION REMINDERS (تنفيذ / Execution)
    // =========================================================================

    // A. Specific Week Occurrences on Monday (e.g. 2nd & 4th Monday / 1st Monday)
    if (weekday === 1) {
      const isBiweeklyMon = norm.includes('ثاني اسبوع ورابع اسبوع') || norm.includes('2nd') || norm.includes('4th');
      const isFirstMon = norm.includes('اول يوم اثنين') || norm.includes('1st monday');

      if (isBiweeklyMon && (occurrence === 2 || occurrence === 4)) {
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
        executionAdded = true;
      } else if (isFirstMon && occurrence === 1) {
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
        executionAdded = true;
      } else if ((norm.includes('اسبوعي يوم الاثنين') || norm.includes('يوم الاثنين')) && !isBiweeklyMon && !isFirstMon) {
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
        executionAdded = true;
      }
    }

    // B. Sunday Execution (Weekly standard execution)
    if (!executionAdded && weekday === 0) {
      const isSundayExec =
        executionClause.includes('احد') ||
        norm.includes('تنفيذ الاحد') ||
        norm.includes('التنفيذ الاحد') ||
        norm.includes('اخطار الخميس') ||
        norm.includes('اخطار الاربعاء') ||
        (ref.scheduleFrequency === 'WEEKLY' && !norm.includes('اثنين'));

      if (isSundayExec) {
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
        executionAdded = true;
      }
    }

    // C. Dynamic Execution Day for ANY Other Weekday using executionClause
    if (!executionAdded && executionClause) {
      for (const wd of WEEKDAYS_MAP) {
        if (wd.dayIndex === weekday) {
          const hasDay = wd.tokens.some((token) => executionClause.includes(token));
          if (hasDay) {
            reminders.push({
              id: `rem-exec-dyn-${wd.dayIndex}-${ref.symbolCode}`,
              fundCode: ref.symbolCode,
              fundName: ref.symbolName,
              type: 'EXECUTION_DUE',
              title: `${wd.nameEn} Execution Due: ${ref.symbolCode}`,
              message: `${wd.nameEn} Execution: Execute operational orders for ${fundLabel}.`,
              rawInstruction: raw,
              urgency: 'MEDIUM',
            });
            executionAdded = true;
            break;
          }
        }
      }
    }
  }

  return reminders;
}
