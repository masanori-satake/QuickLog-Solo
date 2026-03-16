import { jest } from '@jest/globals';

// Mock chrome API
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
        getAll: jest.fn().mockResolvedValue([]),
        clear: jest.fn().mockResolvedValue(true),
        create: jest.fn()
    },
    notifications: {
        create: jest.fn()
    },
    sidePanel: {
        setPanelBehavior: jest.fn().mockReturnValue(Promise.resolve())
    },
    action: {
        onClicked: { addListener: jest.fn() }
    }
};

// Mock BroadcastChannel
global.BroadcastChannel = jest.fn().mockImplementation(() => ({
    postMessage: jest.fn(),
    onmessage: null
}));

// Mock modules
jest.unstable_mockModule('../shared/js/db.js', () => ({
    getCurrentAppState: jest.fn().mockResolvedValue({ alarms: [], activeTask: null }),
    dbGetByName: jest.fn(),
    initDB: jest.fn().mockResolvedValue({ language: 'en' }),
    STORE_CATEGORIES: 'categories',
    DB_NAME: 'QuickLogSoloDB'
}));

jest.unstable_mockModule('../shared/js/logic.js', () => ({
    stopTaskLogic: jest.fn(),
    pauseTaskLogic: jest.fn(),
    startTaskLogic: jest.fn()
}));

jest.unstable_mockModule('../shared/js/i18n.js', () => ({
    t: jest.fn(key => key),
    setLanguage: jest.fn()
}));

const { getCurrentAppState, dbGetByName } = await import('../shared/js/db.js');
const { stopTaskLogic, pauseTaskLogic, startTaskLogic } = await import('../shared/js/logic.js');

// Capture the listener BEFORE importing the module if possible,
// but since it's registered on import, we need to import it first.
await import('../projects/app/js/background.js');
const onAlarmListener = chrome.alarms.onAlarm.addListener.mock.calls[0][0];

describe('Background Alarm Logic', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('skips notification and action if "stop" action is requested but no task is active', async () => {
        const alarm = { name: 'ql_alarm_1' };
        getCurrentAppState.mockResolvedValue({
            alarms: [{ id: 1, enabled: true, action: 'stop', message: 'Stop it' }],
            activeTask: null
        });

        await onAlarmListener(alarm);

        expect(chrome.notifications.create).not.toHaveBeenCalled();
        expect(stopTaskLogic).not.toHaveBeenCalled();
    });

    test('executes "stop" action if task is active', async () => {
        const alarm = { name: 'ql_alarm_1' };
        const activeTask = { category: 'Work' };
        getCurrentAppState.mockResolvedValue({
            alarms: [{ id: 1, enabled: true, action: 'stop', message: 'Stop it' }],
            activeTask: activeTask
        });

        await onAlarmListener(alarm);

        expect(chrome.notifications.create).toHaveBeenCalledWith(
            expect.stringContaining('alarm_1_'),
            expect.objectContaining({
                message: 'Stop it',
                priority: 2
            })
        );
        expect(stopTaskLogic).toHaveBeenCalledWith(activeTask, true);
    });

    test('skips "pause" if already paused', async () => {
        const alarm = { name: 'ql_alarm_1' };
        getCurrentAppState.mockResolvedValue({
            alarms: [{ id: 1, enabled: true, action: 'pause', message: 'Pause it' }],
            activeTask: { category: '__IDLE__', isPaused: true }
        });

        await onAlarmListener(alarm);

        expect(chrome.notifications.create).not.toHaveBeenCalled();
        expect(pauseTaskLogic).not.toHaveBeenCalled();
    });

    test('skips "start" if already working on the same category', async () => {
        const alarm = { name: 'ql_alarm_1' };
        getCurrentAppState.mockResolvedValue({
            alarms: [{ id: 1, enabled: true, action: 'start', actionCategory: 'Work', message: 'Start Work' }],
            activeTask: { category: 'Work', isPaused: false }
        });

        await onAlarmListener(alarm);

        expect(chrome.notifications.create).not.toHaveBeenCalled();
        expect(startTaskLogic).not.toHaveBeenCalled();
    });

    test('does NOT skip "start" if working on a DIFFERENT category', async () => {
        const alarm = { name: 'ql_alarm_1' };
        const activeTask = { category: 'Work', isPaused: false };
        getCurrentAppState.mockResolvedValue({
            alarms: [{ id: 1, enabled: true, action: 'start', actionCategory: 'Study', message: 'Start Study' }],
            activeTask: activeTask
        });
        dbGetByName.mockResolvedValue({ name: 'Study', color: 'blue', tags: 'tag1' });

        await onAlarmListener(alarm);

        expect(chrome.notifications.create).toHaveBeenCalled();
        expect(startTaskLogic).toHaveBeenCalledWith('Study', activeTask, null, 'blue', 'tag1');
    });

    test('always triggers "none" action alarms', async () => {
        const alarm = { name: 'ql_alarm_1' };
        getCurrentAppState.mockResolvedValue({
            alarms: [{ id: 1, enabled: true, action: 'none', message: 'Just notify' }],
            activeTask: { category: 'Work' }
        });

        await onAlarmListener(alarm);

        expect(chrome.notifications.create).toHaveBeenCalled();
    });

    test('test alarm always triggers', async () => {
        const alarm = { name: 'ql_test_alarm' };
        getCurrentAppState.mockResolvedValue({
            activeTask: null,
            alarms: []
        });

        await onAlarmListener(alarm);

        expect(chrome.notifications.create).toHaveBeenCalledWith(
            expect.stringContaining('alarm_999_'),
            expect.objectContaining({
                priority: 2
            })
        );
    });
});
