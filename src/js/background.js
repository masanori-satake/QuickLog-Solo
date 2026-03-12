/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 */

import { openDatabase, dbGetAll, STORE_ALARMS, getCurrentAppState, dbGetByName, STORE_CATEGORIES, DB_NAME } from './db.js';
import { stopTaskLogic, pauseTaskLogic, startTaskLogic } from './logic.js';
import { t } from './i18n.js';

// アイコンクリック時にサイドパネルを開くように設定 (Chrome/Edge用)
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error(error));
}

const SYNC_CHANNEL_NAME = 'quicklog_solo_sync';
let syncChannel = null;

function setupBroadcastChannel() {
    syncChannel = new BroadcastChannel(`${SYNC_CHANNEL_NAME}_${DB_NAME}`);
    syncChannel.onmessage = (event) => {
        if (event.data.type === 'alarms-updated') {
            setupAlarms();
        }
    };
}

async function setupAlarms() {
    console.log('QuickLog-Solo: Setting up alarms...');
    await openDatabase();
    const alarms = await dbGetAll(STORE_ALARMS);

    // Clear existing alarms managed by this extension
    const existingAlarms = await chrome.alarms.getAll();
    for (const alarm of existingAlarms) {
        if (alarm.name.startsWith('ql_alarm_')) {
            await chrome.alarms.clear(alarm.name);
        }
    }

    const now = new Date();

    for (const alarm of alarms) {
        if (alarm.enabled && alarm.time) {
            const [hours, minutes] = alarm.time.split(':').map(Number);
            const alarmTime = new Date();
            alarmTime.setHours(hours, minutes, 0, 0);

            // If time has passed today, schedule for tomorrow
            if (alarmTime <= now) {
                alarmTime.setDate(alarmTime.getDate() + 1);
            }

            chrome.alarms.create(`ql_alarm_${alarm.id}`, {
                when: alarmTime.getTime(),
                periodInMinutes: 1440 // Repeat daily
            });
            console.log(`QuickLog-Solo: Scheduled alarm ${alarm.id} for ${alarmTime.toLocaleString()}`);
        }
    }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith('ql_alarm_')) {
        const alarmId = parseInt(alarm.name.replace('ql_alarm_', ''));
        await openDatabase();
        const alarms = await dbGetAll(STORE_ALARMS);
        const alarmData = alarms.find(a => a.id === alarmId);

        if (alarmData && alarmData.enabled) {
            console.log(`QuickLog-Solo: Alarm fired: ${alarmData.id} - ${alarmData.message}`);
            // Show notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'assets/icon128.png',
                title: t('title'),
                message: alarmData.message || t('alarm-action-none'),
                priority: 2
            });

            // Execute action
            if (alarmData.action && alarmData.action !== 'none') {
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

                // Sync UI across tabs
                if (syncChannel) {
                    syncChannel.postMessage({ type: 'sync' });
                }
            }
        }
    }
});

// Initialize
setupBroadcastChannel();
setupAlarms();
