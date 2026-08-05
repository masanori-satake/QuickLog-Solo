import { jest } from '@jest/globals';

// Set up Chrome API mocks
global.chrome = {
    runtime: {
        getURL: jest.fn(path => path),
        sendMessage: jest.fn().mockReturnValue(Promise.resolve()),
        onInstalled: { addListener: jest.fn() },
        onStartup: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() }
    },
    alarms: {
        onAlarm: { addListener: jest.fn() },
        getAll: jest.fn().mockResolvedValue([{ name: 'ql_alarm_99' }]),
        clear: jest.fn().mockResolvedValue(true),
        create: jest.fn()
    },
    notifications: {
        create: jest.fn(),
        clear: jest.fn(),
        onButtonClicked: { addListener: jest.fn() },
        onClicked: { addListener: jest.fn() }
    },
    sidePanel: {
        setPanelBehavior: jest.fn().mockResolvedValue(true)
    },
    action: {
        onClicked: { addListener: jest.fn() }
    }
};

global.BroadcastChannel = jest.fn().mockImplementation(() => ({
    postMessage: jest.fn(),
    onmessage: null
}));

// Mock required modules
jest.unstable_mockModule('../shared/js/db.js', () => ({
    getCurrentAppState: jest.fn().mockResolvedValue({
        theme: 'light',
        language: 'en',
        businessDays: [1, 2, 3, 4, 5],
        alarms: [
            { id: 1, enabled: true, time: "09:00", message: "Alarm 1", action: "stop" },
            { id: 2, enabled: false, time: "18:00", message: "Alarm 2", action: "none" }
        ],
        activeTask: null
    }),
    dbGetByName: jest.fn(),
    dbGetAll: jest.fn(),
    dbGet: jest.fn(),
    dbPut: jest.fn(),
    dbAddMultiple: jest.fn(),
    openDatabase: jest.fn(),
    initDB: jest.fn().mockResolvedValue({ language: 'en' }),
    STORE_CATEGORIES: 'categories',
    STORE_LOGS: 'logs',
    STORE_SETTINGS: 'settings',
    STORE_ALARMS: 'alarms',
    DB_NAME: 'QuickLogSoloDB',
    SYNC_CHANNEL_NAME: 'quicklog_solo_sync'
}));

jest.unstable_mockModule('../shared/js/logic.js', () => ({
    stopTaskLogic: jest.fn(),
    pauseTaskLogic: jest.fn(),
    startTaskLogic: jest.fn(),
    calculateNextAlarmTime: jest.fn().mockReturnValue(Date.now() + 60000)
}));

jest.unstable_mockModule('../shared/js/i18n.js', () => ({
    t: jest.fn(key => key),
    setLanguage: jest.fn()
}));

jest.unstable_mockModule('../shared/js/session_sync.js', () => ({
    isSessionSyncEnabled: jest.fn().mockResolvedValue(false),
    pullFromCloud: jest.fn().mockResolvedValue(),
    pushToCloud: jest.fn().mockResolvedValue()
}));

const { initDB } = await import('../shared/js/db.js');
const { calculateNextAlarmTime } = await import('../shared/js/logic.js');

describe('Background Service Worker Lifecycle (onInstalled / update)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('configures side panel and schedules alarms on update', async () => {
        // Import background script to register listeners
        await import('../projects/app/js/background.js');

        // Retrieve the registered onInstalled listener
        const onInstalledCalls = chrome.runtime.onInstalled.addListener.mock.calls;
        expect(onInstalledCalls.length).toBeGreaterThan(0);
        const onInstalledListener = onInstalledCalls[0][0];

        // Simulate update event
        const details = { reason: 'update', previousVersion: '1.14.2' };
        await onInstalledListener(details);

        // Verify side panel behavior is set
        expect(chrome.sidePanel.setPanelBehavior).toHaveBeenCalledWith({
            openPanelOnActionClick: true
        });

        // Verify initialization process is triggered
        expect(initDB).toHaveBeenCalledWith(true);

        // Verify old ql_alarm_ alarms are cleared and enabled ones are created
        expect(chrome.alarms.getAll).toHaveBeenCalled();
        expect(chrome.alarms.clear).toHaveBeenCalledWith('ql_alarm_99');
        expect(calculateNextAlarmTime).toHaveBeenCalled();
        expect(chrome.alarms.create).toHaveBeenCalledWith('ql_alarm_1', expect.objectContaining({
            when: expect.any(Number)
        }));
        // Since alarm 2 is disabled, alarms.create should NOT be called for it
        expect(chrome.alarms.create).not.toHaveBeenCalledWith('ql_alarm_2', expect.any(Object));
    });
});
