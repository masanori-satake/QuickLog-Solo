import { jest } from '@jest/globals';

jest.unstable_mockModule('../shared/js/db.js', () => ({
    dbAdd: jest.fn().mockResolvedValue(123),
    dbPut: jest.fn().mockResolvedValue(true),
    dbGet: jest.fn(),
    dbGetAll: jest.fn().mockResolvedValue([]),
    dbGetByName: jest.fn().mockResolvedValue(null),
    dbDelete: jest.fn(),
    dbClear: jest.fn(),
    initDB: jest.fn(),
    openDatabase: jest.fn(),
    getCurrentAppState: jest.fn(),
    DB_NAME: 'QuickLogSoloDB',
    SYNC_CHANNEL_NAME: 'quicklog_solo_sync',
    STORE_LOGS: 'logs',
    STORE_CATEGORIES: 'categories',
    STORE_SETTINGS: 'settings',
    STORE_ALARMS: 'alarms',
    SETTING_KEY_THEME: 'theme',
    SETTING_KEY_FONT: 'font',
    SETTING_KEY_ANIMATION: 'animation',
    SETTING_KEY_PAUSE_ANIMATION: 'pauseAnimation',
    SETTING_KEY_PAUSE_THEME: 'pauseTheme',
    SETTING_KEY_PAUSE_STATE: 'pauseState',
    SETTING_KEY_LANGUAGE: 'language',
    SETTING_KEY_REPORT_SETTINGS: 'reportSettings',
    SETTING_KEY_BUSINESS_DAYS: 'businessDays',
    SETTING_KEY_TIMER_HEIGHT: 'timerHeight',
    SETTING_KEY_CATEGORY_LAYOUT: 'categoryLayout',
    SETTING_KEY_SESSION_SYNC: 'sessionSync',
}));

const { validateSettingsSchema, SCHEMA_KIND_SETTINGS, SCHEMA_VERSION_2_0 } = await import('../shared/js/schema.js');
const { getSeasonalPauseDefaults } = await import('../shared/js/utils.js');

describe('Pause Animation and Theme Settings Validation', () => {
    test('validateSettingsSchema accepts valid pauseAnimation and pauseTheme entries', () => {
        const validSettings = {
            app: 'QuickLog-Solo',
            kind: SCHEMA_KIND_SETTINGS,
            version: SCHEMA_VERSION_2_0,
            entries: [
                { key: 'pauseAnimation', value: 'halloween_jack' },
                { key: 'pauseTheme', value: 'retro-nixie' },
                { key: 'pauseAnimation', value: 'snow_fall' },
                { key: 'pauseTheme', value: 'cyan' },
                { key: 'pauseAnimation', value: 'snoring_zzz' },
                { key: 'pauseTheme', value: 'outline' },
                { key: 'pauseTheme', value: 'teal' },
            ],
        };
        expect(validateSettingsSchema(validSettings)).toBe(true);
    });

    test('validateSettingsSchema rejects invalid pauseTheme color', () => {
        const invalidSettings = {
            app: 'QuickLog-Solo',
            kind: SCHEMA_KIND_SETTINGS,
            version: SCHEMA_VERSION_2_0,
            entries: [{ key: 'pauseTheme', value: 'not-a-color' }],
        };
        expect(validateSettingsSchema(invalidSettings)).toBe(false);
    });
});

describe('Seasonal Standby Animation and Theme Defaults', () => {
    test('returns halloween_jack and retro-nixie for October', () => {
        const octStart = new Date(2025, 9, 1); // Oct 1
        const octEnd = new Date(2025, 9, 31); // Oct 31

        expect(getSeasonalPauseDefaults(octStart)).toEqual({
            pauseAnimation: 'halloween_jack',
            pauseTheme: 'retro-nixie',
        });
        expect(getSeasonalPauseDefaults(octEnd)).toEqual({
            pauseAnimation: 'halloween_jack',
            pauseTheme: 'retro-nixie',
        });
    });

    test('returns snow_fall and cyan from November through January', () => {
        const novDate = new Date(2025, 10, 15); // Nov 15
        const decDate = new Date(2025, 11, 25); // Dec 25
        const janDate = new Date(2026, 0, 31); // Jan 31

        expect(getSeasonalPauseDefaults(novDate)).toEqual({
            pauseAnimation: 'snow_fall',
            pauseTheme: 'cyan',
        });
        expect(getSeasonalPauseDefaults(decDate)).toEqual({
            pauseAnimation: 'snow_fall',
            pauseTheme: 'cyan',
        });
        expect(getSeasonalPauseDefaults(janDate)).toEqual({
            pauseAnimation: 'snow_fall',
            pauseTheme: 'cyan',
        });
    });

    test('returns snoring_zzz and outline for other periods (February to September)', () => {
        const febDate = new Date(2025, 1, 1); // Feb 1
        const junDate = new Date(2025, 5, 15); // Jun 15
        const sepDate = new Date(2025, 8, 30); // Sep 30

        expect(getSeasonalPauseDefaults(febDate)).toEqual({
            pauseAnimation: 'snoring_zzz',
            pauseTheme: 'outline',
        });
        expect(getSeasonalPauseDefaults(junDate)).toEqual({
            pauseAnimation: 'snoring_zzz',
            pauseTheme: 'outline',
        });
        expect(getSeasonalPauseDefaults(sepDate)).toEqual({
            pauseAnimation: 'snoring_zzz',
            pauseTheme: 'outline',
        });
    });
});
