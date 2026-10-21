import { jest } from '@jest/globals';

const db = await import('../shared/js/db.js');
const getCurrentAppState = jest.fn();
const dbGetAll = jest.fn().mockResolvedValue([]);
jest.unstable_mockModule('../shared/js/db.js', () => ({
    ...db,
    getCurrentAppState,
    dbGetAll,
    dbGetByName: jest.fn().mockResolvedValue(null),
}));

const logic = await import('../shared/js/logic.js');
const actions = {
    start: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
};
jest.unstable_mockModule('../shared/js/logic.js', () => ({
    ...logic,
    startTaskLogic: actions.start,
    pauseTaskLogic: actions.pause,
    stopTaskLogic: actions.stop,
}));

const sessionSync = await import('../shared/js/session_sync.js');
jest.unstable_mockModule('../shared/js/session_sync.js', () => ({
    ...sessionSync,
    broadcastSync: jest.fn(),
}));

const { SYSTEM_CATEGORY_IDLE } = await import('../shared/js/utils.js');
const { t } = await import('../shared/js/i18n.js');
let checkPWAAlarms;
let alarm;
let task;
let nextAlarmId = 0;
const originalNotification = globalThis.Notification;

beforeAll(async () => {
    jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const app = await import('../projects/app/js/app.js');
    checkPWAAlarms = app.checkPWAAlarms;
    app.setIsAppInitializedForTesting(true);
    globalThis.Notification = Object.assign(jest.fn(), { permission: 'granted' });
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 21, 9, 0, 0));
    localStorage.clear();
    document.body.innerHTML = `
        <div id="toast" class="hidden"></div>
        <div id="confirm-modal" class="hidden">
            <p id="confirm-message"></p>
            <button id="confirm-ok-btn"></button>
            <button id="confirm-cancel-btn"></button>
        </div>
    `;
    task = { category: 'Work', startTime: Date.now() - 60000 };
    alarm = {
        id: ++nextAlarmId,
        enabled: true,
        time: '09:00',
        type: 'daily_business',
        action: 'start',
        actionCategory: 'Work',
        message: 'Alarm completed',
    };
    getCurrentAppState.mockImplementation(async () => ({ activeTask: task, alarms: [alarm] }));
    actions.start.mockResolvedValue(task);
    actions.pause.mockResolvedValue({ ...task, category: SYSTEM_CATEGORY_IDLE });
    actions.stop.mockResolvedValue(null);
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

afterAll(() => {
    jest.restoreAllMocks();
    if (originalNotification === undefined) delete globalThis.Notification;
    else globalThis.Notification = originalNotification;
});

test.each(['start', 'pause', 'stop'])('%s success refreshes the UI and notifies', async (action) => {
    alarm.action = action;
    await checkPWAAlarms();

    expect(actions[action]).toHaveBeenCalledTimes(1);
    expect(dbGetAll).toHaveBeenCalled();
    expect(Notification).toHaveBeenCalledTimes(1);
    expect(Notification).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: alarm.message }));
    expect(document.getElementById('toast').innerText).toBe('09:00 Alarm completed');
});

test.each(['start', 'pause', 'stop'])('%s failure preserves the error toast without refreshing or notifying', async (action) => {
    alarm.action = action;
    actions[action].mockRejectedValueOnce(new Error('Storage write failed'));
    await checkPWAAlarms();

    expect(actions[action]).toHaveBeenCalledTimes(1);
    expect(dbGetAll).not.toHaveBeenCalled();
    expect(Notification).not.toHaveBeenCalled();
    expect(document.getElementById('toast').innerText).toBe(t('alert-error') || 'Operation failed');
    expect(document.getElementById('toast').classList.contains('hidden')).toBe(false);
});

test.each([
    ['pause', null],
    ['pause', { category: SYSTEM_CATEGORY_IDLE }],
    ['stop', null],
    ['start', null],
])('%s without an applicable target does not refresh or notify (%j)', async (action, activeTask) => {
    alarm.action = action;
    alarm.actionCategory = '';
    task = activeTask;
    await checkPWAAlarms();

    expect(actions[action]).not.toHaveBeenCalled();
    expect(dbGetAll).not.toHaveBeenCalled();
    expect(Notification).not.toHaveBeenCalled();
    expect(document.getElementById('toast').classList.contains('hidden')).toBe(true);
});

test('confirmation cancellation does not execute or notify', async () => {
    alarm.requireConfirmation = true;
    const checking = checkPWAAlarms();
    await Promise.resolve();

    expect(document.getElementById('confirm-modal').classList.contains('hidden')).toBe(false);
    expect(actions.start).not.toHaveBeenCalled();
    expect(Notification).not.toHaveBeenCalled();
    document.getElementById('confirm-cancel-btn').click();
    await checking;

    expect(actions.start).not.toHaveBeenCalled();
    expect(dbGetAll).not.toHaveBeenCalled();
    expect(Notification).not.toHaveBeenCalled();
    expect(document.getElementById('toast').classList.contains('hidden')).toBe(true);
});

test.each(['start', 'pause', 'stop'])('confirmation waits for %s completion before notifying', async (action) => {
    alarm.action = action;
    alarm.requireConfirmation = true;
    const operation = Promise.withResolvers();
    actions[action].mockReturnValueOnce(operation.promise);
    const finished = jest.fn();
    const checking = checkPWAAlarms().then(finished);
    await Promise.resolve();
    document.getElementById('confirm-ok-btn').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(actions[action]).toHaveBeenCalledTimes(1);
    expect(finished).not.toHaveBeenCalled();
    expect(Notification).not.toHaveBeenCalled();
    operation.resolve(action === 'stop' ? null : task);
    await checking;

    expect(finished).toHaveBeenCalledTimes(1);
    expect(Notification).toHaveBeenCalledTimes(1);
    expect(document.getElementById('toast').innerText).toBe('09:00 Alarm completed');
});

test.each(['start', 'pause', 'stop'])('confirmed %s failure is awaited without a success notification', async (action) => {
    alarm.action = action;
    alarm.requireConfirmation = true;
    actions[action].mockRejectedValueOnce(new Error('Storage write failed'));
    const checking = checkPWAAlarms();
    await Promise.resolve();
    document.getElementById('confirm-ok-btn').click();
    await checking;

    expect(actions[action]).toHaveBeenCalledTimes(1);
    expect(Notification).not.toHaveBeenCalled();
    expect(dbGetAll).not.toHaveBeenCalled();
    expect(document.getElementById('toast').innerText).toBe(t('alert-error') || 'Operation failed');
});
