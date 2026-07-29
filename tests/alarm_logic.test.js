import { calculateNextAlarmTime } from '../shared/js/logic.js';

describe('Alarm Calculation Logic', () => {
    const businessDays = [1, 2, 3, 4, 5]; // Mon-Fri
    const nowTs = new Date(2024, 4, 15, 8, 0, 0).getTime(); // 2024-05-15 (Wed) 08:00

    test('daily_business - same day', () => {
        const alarm = {
            enabled: true,
            time: "09:00",
            type: 'daily_business',
            holidayAdjustment: 'none'
        };
        const next = calculateNextAlarmTime(alarm, businessDays, nowTs);
        expect(new Date(next).toLocaleDateString()).toBe(new Date(2024, 4, 15).toLocaleDateString());
    });

    test('daily_business - next day', () => {
        const alarm = {
            enabled: true,
            time: "07:00",
            type: 'daily_business',
            holidayAdjustment: 'none'
        };
        const next = calculateNextAlarmTime(alarm, businessDays, nowTs);
        expect(new Date(next).toLocaleDateString()).toBe(new Date(2024, 4, 16).toLocaleDateString());
    });

    test('daily_business - holiday adjustment (prev_business_day)', () => {
        // May 18 (Sat) -> should move to May 17 (Fri)
        const satNow = new Date(2024, 4, 18, 8, 0, 0).getTime();
        const alarm = {
            enabled: true,
            time: "09:00",
            type: 'daily_business',
            holidayAdjustment: 'prev_business_day'
        };
        const next = calculateNextAlarmTime(alarm, businessDays, satNow);
        expect(new Date(next).toLocaleDateString()).toBe(new Date(2024, 4, 20).toLocaleDateString());
    });

    test('weekly - Mon and Wed', () => {
        const alarm = {
            enabled: true,
            time: "09:00",
            type: 'weekly',
            daysOfWeek: [1, 3],
            holidayAdjustment: 'none'
        };
        const wedNow = new Date(2024, 4, 15, 10, 0, 0).getTime(); // Wed 10:00
        const next = calculateNextAlarmTime(alarm, businessDays, wedNow);
        expect(new Date(next).toLocaleDateString()).toBe(new Date(2024, 4, 20).toLocaleDateString());
    });

    test('monthly_date - 15th', () => {
        const alarm = {
            enabled: true,
            time: "09:00",
            type: 'monthly_date',
            dayOfMonth: 15,
            holidayAdjustment: 'none'
        };
        const next = calculateNextAlarmTime(alarm, businessDays, nowTs);
        expect(new Date(next).toLocaleDateString()).toBe(new Date(2024, 4, 15).toLocaleDateString());
    });

    test('monthly_date - 31st overflow', () => {
        const alarm = {
            enabled: true,
            time: "09:00",
            type: 'monthly_date',
            dayOfMonth: 31,
            holidayAdjustment: 'none'
        };
        const juneNow = new Date(2024, 5, 1, 8, 0, 0).getTime(); // June 1st
        const next = calculateNextAlarmTime(alarm, businessDays, juneNow);
        expect(new Date(next).toLocaleDateString()).toBe(new Date(2024, 5, 30).toLocaleDateString());
    });

    test('monthly_end_relative - last day', () => {
        const alarm = {
            enabled: true,
            time: "09:00",
            type: 'monthly_end_relative',
            daysBeforeEnd: 0,
            holidayAdjustment: 'none'
        };
        const next = calculateNextAlarmTime(alarm, businessDays, nowTs);
        expect(new Date(next).toLocaleDateString()).toBe(new Date(2024, 4, 31).toLocaleDateString());
    });

    test('monthly_end_relative - 1 day before end', () => {
        const alarm = {
            enabled: true,
            time: "09:00",
            type: 'monthly_end_relative',
            daysBeforeEnd: 1,
            holidayAdjustment: 'none'
        };
        const next = calculateNextAlarmTime(alarm, businessDays, nowTs);
        expect(new Date(next).toLocaleDateString()).toBe(new Date(2024, 4, 30).toLocaleDateString());
    });

    test('holiday adjustment - skip', () => {
        const alarm = {
            enabled: true,
            time: "09:00",
            type: 'weekly',
            daysOfWeek: [6], // Saturday
            holidayAdjustment: 'skip'
        };
        const next = calculateNextAlarmTime(alarm, businessDays, nowTs);
        expect(next).toBeNull();
    });

    test('holiday adjustment - next_business_day', () => {
        // May 18 (Sat) -> should move to May 20 (Mon)
        const satNow = new Date(2024, 4, 18, 8, 0, 0).getTime();
        const alarm = {
            enabled: true,
            time: "09:00",
            type: 'daily_business',
            holidayAdjustment: 'next_business_day'
        };
        const next = calculateNextAlarmTime(alarm, businessDays, satNow);
        expect(new Date(next).toLocaleDateString()).toBe(new Date(2024, 4, 20).toLocaleDateString());
    });

    test('monthly_date - guard for day 1 and prev_business_day', () => {
        // June 1st (Sat) 2024. prev_business_day adjustment should NOT move to May 31st.
        // Instead, it should skip June and move to the next valid candidate (July 1st Mon).
        const june1stSat = new Date(2024, 5, 1, 8, 0, 0).getTime();
        const alarm = {
            enabled: true,
            time: "09:00",
            type: 'monthly_date',
            dayOfMonth: 1,
            holidayAdjustment: 'prev_business_day'
        };
        const next = calculateNextAlarmTime(alarm, businessDays, june1stSat);
        // July 1st (Mon) 2024
        expect(new Date(next).toLocaleDateString()).toBe(new Date(2024, 6, 1).toLocaleDateString());
    });
});
