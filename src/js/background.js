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

// Configure side panel behavior for Chrome/Edge
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error('QuickLog-Solo: Failed to set side panel behavior:', error));
}

const SYNC_CHANNEL_NAME = 'quicklog_solo_sync';
let syncChannel = null;

/**
 * Initializes the background worker state.
 * Opens the database and synchronizes the current settings (language, etc.)
 */
async function initializeBackground() {
    try {
        console.log('QuickLog-Solo: Initializing background worker...');
        const state = await initDB();

        // Ensure language is set correctly for notifications
        if (state.language) {
            setLanguage(state.language);
        }

        setupBroadcastChannel();
        await setupAlarms();
        console.log('QuickLog-Solo: Background worker initialized.');
    } catch (error) {
        console.error('QuickLog-Solo: Initialization failed:', error);
    }
}

function setupBroadcastChannel() {
    if (syncChannel) return;
    syncChannel = new BroadcastChannel(`${SYNC_CHANNEL_NAME}_${DB_NAME}`);
    syncChannel.onmessage = (event) => {
        if (event.data.type === 'alarms-updated') {
            setupAlarms();
        }
    };
}

/**
 * Schedules chrome.alarms based on the user's alarm settings in the database.
 */
async function setupAlarms() {
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
    }
}

/**
 * Alarm listener to handle triggered alarms.
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith('ql_alarm_')) {
        try {
            const alarmId = parseInt(alarm.name.replace('ql_alarm_', ''));
            const state = await getCurrentAppState();

            // Re-sync language in case it changed in the foreground
            if (state.language) {
                setLanguage(state.language);
            }

            const alarmData = state.alarms.find(a => a.id === alarmId);

            if (alarmData && alarmData.enabled) {
                console.log(`QuickLog-Solo: Alarm triggered [ID: ${alarmData.id}] message: ${alarmData.message}`);

                // 1. Show notification
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'assets/icon128.png',
                    title: t('title'),
                    message: alarmData.message || t('alarm-action-none'),
                    priority: 2
                });

                // 2. Execute automated task actions
                if (alarmData.action && alarmData.action !== 'none') {
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
                }
            }
        } catch (error) {
            console.error('QuickLog-Solo: Error processing alarm:', error);
        }
    }
});

// Run initialization
initializeBackground();
