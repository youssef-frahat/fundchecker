// Configurable Fund Schedule Engine - Rule-Driven Evaluation
// Supports: Day 18, 1st Monday, 2nd Monday, 4th Monday, 2nd & 4th Monday, Last Thursday, Daily, Custom

import { FundSchedule } from '../types';

export interface ScheduleEvaluationContext {
  targetDate: Date;
  egyptianHolidays?: string[]; // YYYY-MM-DD format
}

/**
 * Checks if a given date is an Egyptian trading day (Sunday = 0 to Thursday = 4, Friday = 5, Saturday = 6).
 * Egyptian stock exchange weekend: Friday (5) and Saturday (6).
 */
export function isEgyptianTradingDay(date: Date, holidays: string[] = []): boolean {
  const dayOfWeek = date.getDay();
  // Weekend: Friday (5) or Saturday (6)
  if (dayOfWeek === 5 || dayOfWeek === 6) return false;

  const dateStr = date.toISOString().split('T')[0];
  if (holidays.includes(dateStr)) return false;

  return true;
}

/**
 * Adjusts a calendar date to a business day based on the convention:
 * FOLLOWING_BUSINESS_DAY: Advances to the next Sunday (or Monday if Sunday is a holiday)
 * PRECEDING_BUSINESS_DAY: Moves back to Thursday
 */
export function adjustToBusinessDay(
  date: Date,
  convention: 'FOLLOWING_BUSINESS_DAY' | 'PRECEDING_BUSINESS_DAY' | 'EXACT_DATE' = 'FOLLOWING_BUSINESS_DAY',
  holidays: string[] = []
): Date {
  if (convention === 'EXACT_DATE') return date;

  const adjusted = new Date(date);
  if (convention === 'FOLLOWING_BUSINESS_DAY') {
    while (!isEgyptianTradingDay(adjusted, holidays)) {
      adjusted.setDate(adjusted.getDate() + 1);
    }
  } else if (convention === 'PRECEDING_BUSINESS_DAY') {
    while (!isEgyptianTradingDay(adjusted, holidays)) {
      adjusted.setDate(adjusted.getDate() - 1);
    }
  }
  return adjusted;
}

/**
 * Evaluates whether a fund's execution schedule triggers on a given target date.
 */
export function isFundScheduledForDate(
  schedule: FundSchedule,
  targetDate: Date = new Date(),
  holidays: string[] = []
): boolean {
  if (!schedule.isActive) return false;

  const day = targetDate.getDate();
  const weekday = targetDate.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const month = targetDate.getMonth();
  const year = targetDate.getFullYear();

  switch (schedule.patternType) {
    case 'DAILY':
      return isEgyptianTradingDay(targetDate, holidays);

    case 'DAY_OF_MONTH': {
      // e.g. Day 18 of every month
      const nominalDate = new Date(year, month, schedule.dayOfMonth || 18);
      const effectiveDate = adjustToBusinessDay(nominalDate, 'FOLLOWING_BUSINESS_DAY', holidays);
      return (
        targetDate.getDate() === effectiveDate.getDate() &&
        targetDate.getMonth() === effectiveDate.getMonth() &&
        targetDate.getFullYear() === effectiveDate.getFullYear()
      );
    }

    case 'NTH_WEEKDAY': {
      // e.g. 1st Monday, 2nd Monday, 4th Monday
      const targetWeekday = schedule.weekdayIndex ?? 1; // Default: Monday
      if (weekday !== targetWeekday) return false;

      const occurrence = Math.ceil(day / 7);
      const targetOccurrence = schedule.weekOccurrences?.[0] ?? 1;
      return occurrence === targetOccurrence;
    }

    case 'COMPOUND_WEEKDAY': {
      // e.g. 2nd and 4th Monday of every month
      const targetWeekday = schedule.weekdayIndex ?? 1;
      if (weekday !== targetWeekday) return false;

      const occurrence = Math.ceil(day / 7);
      const validOccurrences = schedule.weekOccurrences && schedule.weekOccurrences.length > 0
        ? schedule.weekOccurrences
        : [2, 4];
      return validOccurrences.includes(occurrence);
    }

    case 'LAST_WEEKDAY': {
      // e.g. Last Thursday of the month
      const targetWeekday = schedule.weekdayIndex ?? 4; // Default: Thursday
      if (weekday !== targetWeekday) return false;

      // Check if adding 7 days pushes the date into the next month
      const nextWeekSameDay = new Date(year, month, day + 7);
      return nextWeekSameDay.getMonth() !== month;
    }

    case 'CUSTOM':
      return true;

    default:
      return false;
  }
}

/**
 * Filter an array of fund schedules for those that trigger on targetDate.
 */
export function getActiveSchedulesOnDate(
  schedules: FundSchedule[],
  targetDate: Date = new Date(),
  holidays: string[] = []
): FundSchedule[] {
  return schedules.filter((s) => isFundScheduledForDate(s, targetDate, holidays));
}
