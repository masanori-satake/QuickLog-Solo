import {
    initDB, getCurrentAppState, dbPut, dbClear, dbAddMultiple, STORE_ALARMS, STORE_SETTINGS, SETTING_KEY_BUSINESS_DAYS
} from '../shared/js/db.js';

export async function initData(state) {
    const dbState = await initDB(false);
    state.alarms = dbState.alarms;
    state.categories = dbState.categories;
    state.businessDays = dbState.businessDays;
    state.language = dbState.language;
}

export async function saveAlarm(alarm) {
    await dbPut(STORE_ALARMS, alarm);
    notifySync();
}

export async function saveBusinessDays(days) {
    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BUSINESS_DAYS, value: days });
    notifySync();
}

export function notifySync() {
    const bc = new BroadcastChannel('quicklog_solo_sync_QuickLogSoloDB');
    bc.postMessage({ type: 'alarms-updated' });
}

export async function exportAlarms(state) {
    const exportData = {
        app: 'QuickLog-Solo',
        kind: 'QuickLogSolo/Alarms',
        version: '1.0',
        businessDays: state.businessDays,
        alarms: state.alarms.map(a => {
            const rest = { ...a };
            delete rest.id;
            return rest;
        })
    };
    await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
}

export async function importAlarms() {
    const text = await navigator.clipboard.readText();
    const data = JSON.parse(text);
    if (data.kind !== 'QuickLogSolo/Alarms') throw new Error('Invalid format');

    if (data.businessDays) {
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BUSINESS_DAYS, value: data.businessDays });
    }
    await dbClear(STORE_ALARMS);
    await dbAddMultiple(STORE_ALARMS, data.alarms);
}
