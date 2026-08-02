import {
    initDB, dbPut, dbClear, dbAddMultiple, STORE_ALARMS, STORE_SETTINGS, SETTING_KEY_BUSINESS_DAYS, SETTING_KEY_LANGUAGE
} from '../shared/js/db.js';

export async function initData(state) {
    const dbState = await initDB(false);
    state.alarms = dbState.alarms;
    state.categories = dbState.categories;
    state.businessDays = dbState.businessDays;
    state.language = dbState.language;
}

export async function saveAlarm(alarm) {
    if (window.state && window.state.fromApp) return;
    await dbPut(STORE_ALARMS, alarm);
    notifySync();
}

export async function saveAllAlarms(alarms) {
    if (window.state && window.state.fromApp) return;
    await dbClear(STORE_ALARMS);
    await dbAddMultiple(STORE_ALARMS, alarms);
    notifySync();
}

export async function saveBusinessDays(days) {
    if (window.state && window.state.fromApp) return;
    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BUSINESS_DAYS, value: days });
    notifySync();
}

export async function commitChanges(state) {
    await dbClear(STORE_ALARMS);
    await dbAddMultiple(STORE_ALARMS, state.alarms);
    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BUSINESS_DAYS, value: state.businessDays });
    notifySync();
}

export async function saveLanguage(lang) {
    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_LANGUAGE, value: lang });
}

export function notifySync() {
    const bc = new BroadcastChannel('quicklog_solo_sync_QuickLogSoloDB');
    bc.postMessage({ type: 'alarms-updated' });
}
