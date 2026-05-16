import {
    initDB, getCurrentAppState, dbPut, dbClear, dbAddMultiple, STORE_ALARMS, STORE_SETTINGS, SETTING_KEY_BUSINESS_DAYS
} from '../shared/js/db.js';
import { t, setLanguage, applyLanguage } from '../shared/js/i18n.js';
import { SYSTEM_CATEGORY_IDLE } from '../shared/js/utils.js';

let businessDays = [1, 2, 3, 4, 5];
let alarms = [];
let categories = [];

const getEl = (id) => document.getElementById(id);
const createEl = (tag) => document.createElement(tag);

async function init() {
    const state = await initDB(false);
    alarms = state.alarms;
    categories = state.categories.filter(c => c.name !== SYSTEM_CATEGORY_IDLE);
    businessDays = state.businessDays;

    if (state.language) {
        setLanguage(state.language);
    }
    applyLanguage();

    renderBusinessDays();
    renderAlarms();
    setupEventListeners();
}

function renderBusinessDays() {
    const container = getEl('business-days-container');
    if (!container) return;
    container.replaceChildren();

    const currentLang = document.documentElement.lang || 'ja';
    const formatter = new Intl.DateTimeFormat(currentLang, { weekday: 'narrow' });

    [1, 2, 3, 4, 5, 6, 0].forEach(day => {
        const d = new Date(2024, 0, 7 + day);
        const label = formatter.format(d);

        const chip = createEl('button');
        chip.className = 'filter-chip' + (businessDays.includes(day) ? ' active' : '');
        if (day === 0) chip.classList.add('sunday');
        if (day === 6) chip.classList.add('saturday');
        chip.textContent = label;

        chip.onclick = async () => {
            if (businessDays.includes(day)) {
                if (businessDays.length > 1) {
                    businessDays = businessDays.filter(d => d !== day);
                }
            } else {
                businessDays.push(day);
            }
            await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BUSINESS_DAYS, value: businessDays });
            renderBusinessDays();
            notifySync();
        };
        container.appendChild(chip);
    });
}

function renderAlarms() {
    const container = getEl('alarm-editor-list');
    container.replaceChildren();

    alarms.forEach((alarm, index) => {
        const card = createEl('div');
        card.className = 'alarm-card';

        const header = createEl('div');
        header.className = 'alarm-card-header';
        const idLabel = createEl('span');
        idLabel.className = 'alarm-id';
        idLabel.textContent = `Alarm #${index + 1}`;
        const enabledLabel = createEl('label');
        enabledLabel.className = 'alarm-row';
        const enabledCheck = createEl('input');
        enabledCheck.type = 'checkbox';
        enabledCheck.checked = alarm.enabled;
        enabledCheck.onchange = (e) => updateAlarm(alarm, { enabled: e.target.checked });
        enabledLabel.appendChild(enabledCheck);
        enabledLabel.appendChild(document.createTextNode(t('alarm-label-enabled')));

        header.appendChild(idLabel);
        header.appendChild(enabledLabel);

        // Basic Settings
        const basicSection = createEl('div');
        basicSection.className = 'alarm-section';
        const timeRow = createEl('div');
        timeRow.className = 'alarm-row';
        const timeInput = createEl('input');
        timeInput.type = 'time';
        timeInput.value = alarm.time;
        timeInput.onchange = (e) => updateAlarm(alarm, { time: e.target.value });
        timeRow.appendChild(timeInput);

        const confirmLabel = createEl('label');
        confirmLabel.className = 'alarm-row';
        const confirmCheck = createEl('input');
        confirmCheck.type = 'checkbox';
        confirmCheck.checked = alarm.requireConfirmation;
        confirmCheck.onchange = (e) => updateAlarm(alarm, { requireConfirmation: e.target.checked });
        confirmLabel.appendChild(confirmCheck);
        const confirmIcon = createEl('span');
        confirmIcon.className = 'material-symbols-outlined';
        confirmIcon.textContent = 'task_alt';
        confirmLabel.appendChild(confirmIcon);
        timeRow.appendChild(confirmLabel);
        basicSection.appendChild(timeRow);

        const msgInput = createEl('input');
        msgInput.type = 'text';
        msgInput.value = alarm.message;
        msgInput.placeholder = t('alarm-placeholder-message');
        msgInput.onchange = (e) => updateAlarm(alarm, { message: e.target.value });
        basicSection.appendChild(msgInput);

        // Action Settings
        const actionSection = createEl('div');
        actionSection.className = 'alarm-section';
        const actionLabel = createEl('label');
        actionLabel.textContent = t('alarm-label-action');
        const actionSelect = createEl('select');
        ['none', 'stop', 'pause', 'start'].forEach(val => {
            const opt = createEl('option');
            opt.value = val;
            opt.textContent = t(`alarm-action-${val}`);
            if (alarm.action === val) opt.selected = true;
            actionSelect.appendChild(opt);
        });
        actionSelect.onchange = (e) => {
            updateAlarm(alarm, { action: e.target.value });
            renderAlarms();
        };
        actionSection.appendChild(actionLabel);
        actionSection.appendChild(actionSelect);

        if (alarm.action === 'start') {
            const catSelect = createEl('select');
            categories.forEach(cat => {
                const opt = createEl('option');
                opt.value = cat.name;
                opt.textContent = cat.name;
                if (alarm.actionCategory === cat.name) opt.selected = true;
                catSelect.appendChild(opt);
            });
            catSelect.onchange = (e) => updateAlarm(alarm, { actionCategory: e.target.value });
            actionSection.appendChild(catSelect);
        }

        // Advanced Schedule Settings
        const scheduleSection = createEl('div');
        scheduleSection.className = 'alarm-section';
        const typeLabel = createEl('label');
        typeLabel.textContent = t('alarm-label-type');
        const typeSelect = createEl('select');
        ['daily_business', 'weekly', 'monthly_date', 'monthly_end_relative'].forEach(val => {
            const opt = createEl('option');
            opt.value = val;
            opt.textContent = t(`alarm-type-${val}`);
            if (alarm.type === val) opt.selected = true;
            typeSelect.appendChild(opt);
        });
        typeSelect.onchange = (e) => {
            let update = { type: e.target.value };
            // Reset adjustments if incompatible
            if (update.type === 'monthly_date' && alarm.dayOfMonth === 1 && alarm.holidayAdjustment === 'prev_business_day') {
                update.holidayAdjustment = 'none';
            }
            if (update.type === 'monthly_end_relative' && alarm.holidayAdjustment === 'next_business_day') {
                update.holidayAdjustment = 'none';
            }
            updateAlarm(alarm, update);
            renderAlarms();
        };
        scheduleSection.appendChild(typeLabel);
        scheduleSection.appendChild(typeSelect);

        // Conditional Advanced Settings
        if (alarm.type === 'weekly') {
            const dayContainer = createEl('div');
            dayContainer.className = 'filter-chips';
            const currentLang = document.documentElement.lang || 'ja';
            const formatter = new Intl.DateTimeFormat(currentLang, { weekday: 'narrow' });
            [1, 2, 3, 4, 5, 6, 0].forEach(day => {
                const d = new Date(2024, 0, 7 + day);
                const chip = createEl('button');
                chip.className = 'filter-chip' + (alarm.daysOfWeek.includes(day) ? ' active' : '');
                if (day === 0) chip.classList.add('sunday');
                if (day === 6) chip.classList.add('saturday');
                chip.textContent = formatter.format(d);
                chip.onclick = () => {
                    let newDays = [...alarm.daysOfWeek];
                    if (newDays.includes(day)) {
                        newDays = newDays.filter(d => d !== day);
                    } else {
                        newDays.push(day);
                    }
                    updateAlarm(alarm, { daysOfWeek: newDays });
                    renderAlarms();
                };
                dayContainer.appendChild(chip);
            });
            scheduleSection.appendChild(dayContainer);
        } else if (alarm.type === 'monthly_date') {
            const row = createEl('div');
            row.className = 'alarm-row';
            const dateInput = createEl('input');
            dateInput.type = 'number';
            dateInput.min = 1;
            dateInput.max = 31;
            dateInput.value = alarm.dayOfMonth;
            dateInput.onchange = (e) => {
                let val = parseInt(e.target.value);
                let update = { dayOfMonth: val };
                if (val === 1 && alarm.holidayAdjustment === 'prev_business_day') {
                    update.holidayAdjustment = 'none';
                }
                updateAlarm(alarm, update);
                renderAlarms();
            };
            row.appendChild(dateInput);
            row.appendChild(document.createTextNode(t('label-day')));
            scheduleSection.appendChild(row);
        } else if (alarm.type === 'monthly_end_relative') {
            const row = createEl('div');
            row.className = 'alarm-row';
            const dateInput = createEl('input');
            dateInput.type = 'number';
            dateInput.min = 0;
            dateInput.max = 31;
            dateInput.value = alarm.daysBeforeEnd;
            dateInput.onchange = (e) => updateAlarm(alarm, { daysBeforeEnd: parseInt(e.target.value) });
            row.appendChild(document.createTextNode(t('label-before-end-1')));
            row.appendChild(dateInput);
            row.appendChild(document.createTextNode(t('label-before-end-2')));
            scheduleSection.appendChild(row);
        }

        // Holiday Adjustment
        const adjSection = createEl('div');
        adjSection.className = 'alarm-section';
        const adjLabel = createEl('label');
        adjLabel.textContent = t('alarm-label-holiday-adjustment');
        const adjSelect = createEl('select');
        const adjOptions = ['none', 'prev_business_day', 'next_business_day', 'skip'];

        adjOptions.forEach(val => {
            // Guardrail logic
            if (val === 'prev_business_day' && alarm.type === 'monthly_date' && alarm.dayOfMonth === 1) return;
            if (val === 'next_business_day' && alarm.type === 'monthly_end_relative') return;

            const opt = createEl('option');
            opt.value = val;
            opt.textContent = t(`alarm-adj-${val}`);
            if (alarm.holidayAdjustment === val) opt.selected = true;
            adjSelect.appendChild(opt);
        });
        adjSelect.onchange = (e) => updateAlarm(alarm, { holidayAdjustment: e.target.value });
        adjSection.appendChild(adjLabel);
        adjSection.appendChild(adjSelect);

        const desc = createEl('div');
        desc.className = 'setting-description-box';
        desc.textContent = t(`alarm-adj-desc-${alarm.holidayAdjustment}`);
        adjSection.appendChild(desc);

        card.appendChild(header);
        card.appendChild(basicSection);
        card.appendChild(actionSection);
        card.appendChild(scheduleSection);
        card.appendChild(adjSection);
        container.appendChild(card);
    });
}

async function updateAlarm(alarm, patch) {
    Object.assign(alarm, patch);
    await dbPut(STORE_ALARMS, alarm);
    notifySync();
}

function notifySync() {
    const bc = new BroadcastChannel('quicklog_solo_sync_QuickLogSoloDB');
    bc.postMessage({ type: 'alarms-updated' });
    showToast(t('toast-alarm-saved'));
}

function showToast(msg) {
    const toast = getEl('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

function setupEventListeners() {
    getEl('export-btn').onclick = async () => {
        const state = await getCurrentAppState();
        const exportData = {
            app: 'QuickLog-Solo',
            kind: 'QuickLogSolo/Alarms',
            version: '1.0',
            businessDays: state.businessDays,
            alarms: alarms.map(a => {
                const rest = { ...a };
                delete rest.id;
                return rest;
            })
        };
        await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
        showToast(t('toast-export-success'));
    };

    getEl('import-btn').onclick = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const data = JSON.parse(text);
            if (data.kind !== 'QuickLogSolo/Alarms') throw new Error();

            if (await showConfirm(t('confirm-import-overwrite'))) {
                if (data.businessDays) {
                    businessDays = data.businessDays;
                    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BUSINESS_DAYS, value: businessDays });
                }
                await dbClear(STORE_ALARMS);
                await dbAddMultiple(STORE_ALARMS, data.alarms);
                location.reload();
            }
        } catch (e) {
            console.error(e);
            alert(t('alert-import-error'));
        }
    };
}

function showConfirm(msg) {
    return new Promise(resolve => {
        const modal = getEl('confirm-modal');
        getEl('confirm-message').textContent = msg;
        modal.classList.remove('hidden');
        getEl('confirm-ok-btn').onclick = () => { modal.classList.add('hidden'); resolve(true); };
        getEl('confirm-cancel-btn').onclick = () => { modal.classList.add('hidden'); resolve(false); };
    });
}

init();
