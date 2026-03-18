/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 */

import { getCurrentAppState, dbGetByName, STORE_CATEGORIES, DB_NAME, initDB } from '../shared/js/db.js';
import { stopTaskLogic, pauseTaskLogic, startTaskLogic } from '../shared/js/logic.js';
import { t, setLanguage } from '../shared/js/i18n.js';

/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 *
 * This service worker handles background alarms and notifications,
 * and executes task logic even when the side panel is closed.
 */

const SYNC_CHANNEL_NAME = 'quicklog_solo_sync';
let syncChannel = null;
let initializationPromise = null;

/**
 * Configures the side panel behavior.
 */
function configureSidePanel() {
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        chrome.sidePanel
            .setPanelBehavior({ openPanelOnActionClick: true })
            .catch((error) => console.error('QuickLog-Solo: Failed to set side panel behavior:', error));
    }
}

/**
 * Initializes the background worker state.
 * Opens the database and synchronizes the current settings (language, etc.)
 */
async function initializeBackground() {
    try {
        console.log('QuickLog-Solo: Initializing background worker (Lite)...');
        // Use Lite initialization for faster wake-up
        const state = await initDB(true);

        // Ensure language is set correctly for notifications
        if (state.language) {
            setLanguage(state.language);
        }

        setupBroadcastChannel();
        await setupAlarms();
        console.log('QuickLog-Solo: Background worker initialized.');
    } catch (error) {
        console.error('QuickLog-Solo: Initialization failed:', error);
        throw error;
    }
}

/**
 * Ensures background initialization only happens once and can be awaited.
 */
async function guardedInitialize() {
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        try {
            await initializeBackground();
        } catch (error) {
            console.error('QuickLog-Solo: guardedInitialize failed:', error);
            initializationPromise = null; // Allow retry on next event
            throw error;
        }
    })();

    return initializationPromise;
}

function setupBroadcastChannel() {
    if (syncChannel) return;
    syncChannel = new BroadcastChannel(`${SYNC_CHANNEL_NAME}_${DB_NAME}`);
    syncChannel.onmessage = (event) => {
        if (event.data.type === 'alarms-updated') {
            setupAlarms().catch(err => console.error('QuickLog-Solo: setupAlarms failed on sync', err));
        }
    };
}

// Support chrome.runtime.sendMessage as well for better reliability
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.type === 'alarms-updated') {
        setupAlarms().catch(err => console.error('QuickLog-Solo: setupAlarms failed on message', err));
    } else if (message.type === 'sync') {
        // Just acknowledging sync
    }
    return false; // Synchronous listener
});

// Handler for extension icon click (fallback)
if (typeof chrome !== 'undefined' && chrome.action) {
    chrome.action.onClicked.addListener((tab) => {
        if (chrome.sidePanel && chrome.sidePanel.open) {
            chrome.sidePanel.open({ windowId: tab.windowId }).catch((e) => {
                console.warn('QuickLog-Solo: Could not open side panel via API.', e);
            });
        }
    });
}

let isSettingUpAlarms = false;
/**
 * Schedules chrome.alarms based on the user's alarm settings in the database.
 */
async function setupAlarms() {
    if (isSettingUpAlarms) return;
    isSettingUpAlarms = true;
    try {
        console.log('QuickLog-Solo: Refreshing alarms...');
        const state = await getCurrentAppState();
        const alarms = state.alarms;

        // Clear all existing ql_alarms before rescheduling
        const existingAlarms = await chrome.alarms.getAll();
        for (const alarm of existingAlarms) {
            if (alarm.name.startsWith('ql_alarm_')) {
                await chrome.alarms.clear(alarm.name);
            }
        }

        const now = Date.now();

        for (const alarm of alarms) {
            if (alarm.enabled && alarm.time) {
                const [hours, minutes] = alarm.time.split(':').map(Number);
                const alarmDate = new Date();
                alarmDate.setHours(hours, minutes, 0, 0);

                let scheduledTime = alarmDate.getTime();
                // If scheduled time is in the past, schedule for tomorrow
                if (scheduledTime <= now) {
                    scheduledTime += 24 * 60 * 60 * 1000;
                }

                chrome.alarms.create(`ql_alarm_${alarm.id}`, {
                    when: scheduledTime,
                    periodInMinutes: 1440 // Daily repeat
                });
                console.log(`QuickLog-Solo: Scheduled alarm ${alarm.id} at ${new Date(scheduledTime).toLocaleString()}`);
            }
        }
    } catch (error) {
        console.error('QuickLog-Solo: Failed to setup alarms:', error);
    } finally {
        isSettingUpAlarms = false;
    }
}

/**
 * Executes the logic associated with an alarm.
 */
async function executeAlarmAction(alarmData, activeTask) {
    console.log(`QuickLog-Solo: Executing alarm action: ${alarmData.action}`);

    if (alarmData.action === 'stop') {
        await stopTaskLogic(activeTask, true);
    } else if (alarmData.action === 'pause') {
        await pauseTaskLogic(activeTask);
    } else if (alarmData.action === 'start' && alarmData.actionCategory) {
        const cat = await dbGetByName(STORE_CATEGORIES, alarmData.actionCategory);
        if (cat) {
            await startTaskLogic(cat.name, activeTask, null, cat.color, cat.tags);
        }
    }

    // Broadcast sync to update any open side panel UI
    if (syncChannel) {
        syncChannel.postMessage({ type: 'sync' });
    }
    // Also notify via chrome.runtime for better reliability
    chrome.runtime.sendMessage({ type: 'sync' }).catch(() => {});
}

/**
 * Opens the side panel.
 */
function openSidePanel() {
    if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.windows.getCurrent((window) => {
            chrome.sidePanel.open({ windowId: window.id }).catch((e) => {
                console.warn('QuickLog-Solo: Failed to open side panel', e);
            });
        });
    }
}

/**
 * Handle notification clicks and button clicks.
 */
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (!notificationId.startsWith('alarm_')) return;

    // Immediately open the side panel to preserve user gesture
    openSidePanel();

    const alarmId = parseInt(notificationId.split('_')[1]);
    const state = await getCurrentAppState();
    const alarmData = state.alarms.find(a => a.id === alarmId);

    if (alarmData) {
        const hasAction = alarmData.action && alarmData.action !== 'none';

        if (hasAction && buttonIndex === 0) {
            // "OK" button clicked (if action exists, it's at index 0)
            await executeAlarmAction(alarmData, state.activeTask);
        }
    }

    chrome.notifications.clear(notificationId);
});

chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith('alarm_')) {
        openSidePanel();
        chrome.notifications.clear(notificationId);
    }
});

/**
 * Alarm listener to handle triggered alarms.
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log(`QuickLog-Solo: onAlarm triggered: ${alarm.name}`);

    try {
        await guardedInitialize();

        let alarmData = null;
        let state = null;
        if (alarm.name.startsWith('ql_alarm_')) {
            const alarmId = parseInt(alarm.name.replace('ql_alarm_', ''));
            state = await getCurrentAppState();
            alarmData = state.alarms.find(a => a.id === alarmId);
        } else if (alarm.name === 'ql_test_alarm') {
            alarmData = {
                id: 999,
                enabled: true,
                message: "TEST ALARM: " + t('test-notification-message') + " (Flow OK)",
                action: 'none'
            };
        }

        if (alarmData && alarmData.enabled) {
            if (!state) state = await getCurrentAppState();
            const activeTask = state.activeTask;

            // Check if action will change the state
            const isRedundantStop = alarmData.action === 'stop' && !activeTask;
            const isRedundantPause = alarmData.action === 'pause' && (!activeTask || activeTask.isPaused);
            const isRedundantStart = alarmData.action === 'start' && activeTask && !activeTask.isPaused && activeTask.category === alarmData.actionCategory;

            if (isRedundantStop || isRedundantPause || isRedundantStart) {
                console.log(`QuickLog-Solo: Alarm [ID: ${alarmData.id}] skipped because state would not change (${alarmData.action})`);
                return;
            }

            console.log(`QuickLog-Solo: Alarm triggered [ID: ${alarmData.id}] message: ${alarmData.message}`);

            const hasAction = alarmData.action && alarmData.action !== 'none';
            const requireConfirmation = !!alarmData.requireConfirmation;

            const notificationId = `alarm_${alarmData.id}_${Date.now()}`;
            const notificationOptions = {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('shared/assets/icon128.png'),
                title: t('title'),
                message: alarmData.message || t('alarm-action-none'),
                priority: 2,
                requireInteraction: requireConfirmation
            };

            if (requireConfirmation) {
                notificationOptions.buttons = [];
                if (hasAction) {
                    notificationOptions.buttons.push({ title: t('notification-btn-ok') });
                }
                notificationOptions.buttons.push({ title: t('notification-btn-close') });
            }

            // 1. Show notification
            chrome.notifications.create(notificationId, notificationOptions);

            // 2. Execute automated task actions (only if NOT requiring confirmation)
            if (!requireConfirmation && hasAction) {
                await executeAlarmAction(alarmData, activeTask);
            }
        }
    } catch (error) {
        console.error('QuickLog-Solo: Error processing alarm:', error);
    }
});

// Run initialization
chrome.runtime.onInstalled.addListener((details) => {
    console.log('QuickLog-Solo: Extension installed/updated. Reason:', details.reason);
    configureSidePanel();
    guardedInitialize().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
    console.log('QuickLog-Solo: Extension startup.');
    configureSidePanel();
    guardedInitialize().catch(() => {});
});

// Also run immediately as the worker might be woken up for an alarm or sidepanel opening
configureSidePanel();
guardedInitialize().catch(() => {});
