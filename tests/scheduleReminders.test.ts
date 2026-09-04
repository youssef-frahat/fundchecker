import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getScheduleRemindersForDate } from '../src/lib/services/scheduleReminderService';
import { ReferenceData } from '../src/lib/types';

describe('Dynamic Operational Cycle & Schedule Reminder Engine', () => {
  const sampleFunds: ReferenceData[] = [
    {
      id: '1',
      symbolCode: '1020',
      symbolName: 'Misr Al Mostakbal',
      actualSymbol: 'MOSTAKBAL',
      fundType: 'T1',
      navUnitPrice: 100,
      status: 'ACTIVE',
      scheduleFrequency: 'WEEKLY',
      executionInstruction: 'اسبوعي بيتم ارسال اخطار الخميس وبيتم التنفيذ الاحد',
    },
    {
      id: '2',
      symbolCode: 'Zaldi El Masry',
      symbolName: 'Zaldi El Masry Fund',
      actualSymbol: 'ZALDI-MSRY',
      fundType: 'T1',
      navUnitPrice: 150,
      status: 'ACTIVE',
      scheduleFrequency: 'WEEKLY',
      executionInstruction: 'اسبوعي بيتم ارسال اخطار الاربعاء الساعه 2 وبيتم التنفيذ الاحد',
    },
    {
      id: '3',
      symbolCode: 'Maksab OZ',
      symbolName: 'Maksab OZ USD',
      actualSymbol: 'Maksab OZ',
      fundType: 'T1',
      navUnitPrice: 12,
      status: 'ACTIVE',
      scheduleFrequency: 'MONTHLY',
      executionInstruction:
        'الشراء اسبوعي يومي الاثنين & البيع بيتم ارسال اخطار يوم 18 من كل شهر وبيتم التنفيذ فى اول يوم اثنين من كل شهر',
    },
    // Dynamically added fund from Excel or Frontend UI with custom days
    {
      id: '4',
      symbolCode: 'NEW_FUND_01',
      symbolName: 'Alpha Tech Fund',
      actualSymbol: 'ATECH',
      fundType: 'T1',
      navUnitPrice: 55,
      status: 'ACTIVE',
      scheduleFrequency: 'WEEKLY',
      executionInstruction: 'اخطار الثلاثاء الساعه 12:00 والتنفيذ الخميس',
    },
    // Dynamically added fund with English instruction
    {
      id: '5',
      symbolCode: 'NEW_FUND_02',
      symbolName: 'Global Growth Fund',
      actualSymbol: 'GGROWTH',
      fundType: 'T1',
      navUnitPrice: 200,
      status: 'ACTIVE',
      scheduleFrequency: 'WEEKLY',
      executionInstruction: 'Weekly notice Monday at 11:00, execution Wednesday',
    },
  ];

  it('should trigger Thursday notice reminder for Misr Al Mostakbal', () => {
    // 2026-09-03 is a Thursday
    const thursdayDate = new Date(2026, 8, 3);
    assert.equal(thursdayDate.getDay(), 4, 'Must be Thursday');

    const reminders = getScheduleRemindersForDate(sampleFunds, thursdayDate);
    const notice1020 = reminders.find((r) => r.fundCode === '1020' && r.type === 'NOTICE_DUE');
    assert.ok(notice1020, '1020 must have a notice due reminder on Thursday');
    assert.equal(notice1020.urgency, 'HIGH');
  });

  it('should trigger Wednesday notice with Cutoff 14:00 for Zaldi El Masry', () => {
    // 2026-09-02 is a Wednesday
    const wednesdayDate = new Date(2026, 8, 2);
    assert.equal(wednesdayDate.getDay(), 3, 'Must be Wednesday');

    const reminders = getScheduleRemindersForDate(sampleFunds, wednesdayDate);
    const zaldiNotice = reminders.find((r) => r.fundCode === 'Zaldi El Masry' && r.type === 'NOTICE_DUE');
    assert.ok(zaldiNotice, 'Zaldi must have a notice due reminder on Wednesday');
    assert.equal(zaldiNotice.cutoffTime, '14:00', 'Must parse 2:00 PM cutoff as 14:00');
  });

  it('should dynamically trigger Tuesday notice with Cutoff 12:00 for NEW_FUND_01 without code change', () => {
    // 2026-09-01 is a Tuesday
    const tuesdayDate = new Date(2026, 8, 1);
    assert.equal(tuesdayDate.getDay(), 2, 'Must be Tuesday');

    const reminders = getScheduleRemindersForDate(sampleFunds, tuesdayDate);
    const dynNotice = reminders.find((r) => r.fundCode === 'NEW_FUND_01' && r.type === 'NOTICE_DUE');
    assert.ok(dynNotice, 'Dynamically added fund must trigger Tuesday notice');
    assert.equal(dynNotice.cutoffTime, '12:00');
  });

  it('should dynamically trigger Thursday execution for NEW_FUND_01 without code change', () => {
    const thursdayDate = new Date(2026, 8, 3);
    const reminders = getScheduleRemindersForDate(sampleFunds, thursdayDate);
    const dynExec = reminders.find((r) => r.fundCode === 'NEW_FUND_01' && r.type === 'EXECUTION_DUE');
    assert.ok(dynExec, 'Dynamically added fund must trigger Thursday execution');
  });

  it('should dynamically trigger English instructions (Notice Monday, Execution Wednesday)', () => {
    // 2026-09-07 is Monday
    const mondayDate = new Date(2026, 8, 7);
    assert.equal(mondayDate.getDay(), 1, 'Must be Monday');

    const monReminders = getScheduleRemindersForDate(sampleFunds, mondayDate);
    const engNotice = monReminders.find((r) => r.fundCode === 'NEW_FUND_02' && r.type === 'NOTICE_DUE');
    assert.ok(engNotice, 'Must trigger notice on Monday from English instruction');

    // 2026-09-09 is Wednesday
    const wednesdayDate = new Date(2026, 8, 9);
    assert.equal(wednesdayDate.getDay(), 3, 'Must be Wednesday');

    const wedReminders = getScheduleRemindersForDate(sampleFunds, wednesdayDate);
    const engExec = wedReminders.find((r) => r.fundCode === 'NEW_FUND_02' && r.type === 'EXECUTION_DUE');
    assert.ok(engExec, 'Must trigger execution on Wednesday from English instruction');
  });

  it('should trigger Day 18 notice for Maksab OZ', () => {
    const day18Date = new Date(2026, 8, 18);
    const reminders = getScheduleRemindersForDate(sampleFunds, day18Date);
    const maksabNotice = reminders.find((r) => r.fundCode === 'Maksab OZ' && r.type === 'NOTICE_DUE');
    assert.ok(maksabNotice, 'Must trigger notice on Day 18');
  });
});
