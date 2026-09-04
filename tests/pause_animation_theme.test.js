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

describe('Pause Animation and Theme Settings Validation', () => {
    test('validateSettingsSchema accepts valid pauseAnimation and pauseTheme entries', () => {
        const validSettings = {
            app: 'QuickLog-Solo',
            kind: SCHEMA_KIND_SETTINGS,
            version: SCHEMA_VERSION_2_0,
            entries: [
                { key: 'pauseAnimation', value: 'digital_rain' },
                { key: 'pauseTheme', value: 'neutral' },
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
