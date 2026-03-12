/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 */

import { openDatabase, dbGetAll, STORE_ALARMS, getCurrentAppState, dbGetByName, STORE_CATEGORIES, DB_NAME, initDB } from './db.js';
import { stopTaskLogic, pauseTaskLogic, startTaskLogic } from './logic.js';
import { t, setLanguage } from './i18n.js';

/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 *
 * This service worker handles background alarms and notifications,
 * and executes task logic even when the side panel is closed.
 */

/**
 * Configures the side panel behavior.
 */
function configureSidePanel() {
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        chrome.sidePanel
            .setPanelBehavior({ openPanelOnActionClick: true })
            .then(() => console.log('QuickLog-Solo: Side panel behavior set.'))
            .catch((error) => console.error('QuickLog-Solo: Failed to set side panel behavior:', error));
    }
}

// Handler for extension icon click (fallback/Firefox support)
if (typeof chrome !== 'undefined' && chrome.action) {
    chrome.action.onClicked.addListener((tab) => {
        // For Chrome, setPanelBehavior usually handles this, but we can also trigger manually
        // if sidePanel is available.
        if (chrome.sidePanel && chrome.sidePanel.open) {
            chrome.sidePanel.open({ windowId: tab.windowId }).catch((e) => {
                console.warn('QuickLog-Solo: Could not open side panel via API, falling back to default behavior.', e);
            });
        }
    });
}

const SYNC_CHANNEL_NAME = 'quicklog_solo_sync';
let syncChannel = null;
let initializationPromise = null;

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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'alarms-updated') {
        setupAlarms().catch(err => console.error('QuickLog-Solo: setupAlarms failed on message', err));
    }
    return false; // Synchronous listener
});

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
 * Alarm listener to handle triggered alarms.
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log(`QuickLog-Solo: onAlarm triggered: ${alarm.name}`);

    // Immediate diagnostic notification (System ACK)
    if (alarm.name.startsWith('ql_')) {
        chrome.notifications.create(`ack_${alarm.name}_${Date.now()}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('assets/icon128.png'),
            title: 'QuickLog-Solo System',
            message: `Event: ${alarm.name} (Service Worker Active)`,
            priority: 0
        });
    }

    try {
        await guardedInitialize();

        let alarmData = null;
        if (alarm.name.startsWith('ql_alarm_')) {
            const alarmId = parseInt(alarm.name.replace('ql_alarm_', ''));
            const state = await getCurrentAppState();
            alarmData = state.alarms.find(a => a.id === alarmId);
        } else if (alarm.name === 'ql_test_alarm') {
            alarmData = {
                id: 999,
                enabled: true,
                message: "TEST ALARM: " + t('test-notification-message') + " (Background Flow OK)",
                action: 'none'
            };
        }

        if (alarmData && alarmData.enabled) {
            console.log(`QuickLog-Solo: Alarm triggered [ID: ${alarmData.id}] message: ${alarmData.message}`);

            // 1. Show notification
            chrome.notifications.create(`alarm_${alarmData.id}_${Date.now()}`, {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('assets/icon128.png'),
                title: t('title'),
                message: alarmData.message || t('alarm-action-none'),
                priority: 2
            });

            // 2. Execute automated task actions
            if (alarmData.action && alarmData.action !== 'none') {
                console.log(`QuickLog-Solo: Executing alarm action: ${alarmData.action}`);
                const state = await getCurrentAppState();
                let activeTask = state.activeTask;

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
