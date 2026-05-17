import { setLanguage, getLanguage, applyLanguage, t } from '../shared/js/i18n.js';
import { setDatabaseName, dbClear, STORE_ALARMS, STORE_SETTINGS, STORE_CATEGORIES } from '../shared/js/db.js';
import { DEFAULT_ALARM_MESSAGE_STOP } from '../shared/js/utils.js';
import { initData, saveAlarm, saveAllAlarms, saveBusinessDays, exportAlarms, importAlarms } from './data-io.js';
import { initUI } from './ui.js';
import { initHistory } from './history.js';

const state = {
    alarms: [],
    categories: [],
    businessDays: [1, 2, 3, 4, 5],
    selectedAlarmId: null,
    language: 'ja',
    theme: 'light'
};

const elements = {
    alarmListEl: document.getElementById('alarm-editor-list'),
    detailPaneEl: document.querySelector('.detail-pane'),
    emptyStateEl: document.getElementById('detail-empty-state'),
    detailFormEl: document.getElementById('alarm-detail-form'),
    alarmIdEl: document.getElementById('detail-alarm-id'),
    enabledToggle: document.getElementById('alarm-enabled-toggle'),
    timeInput: document.getElementById('alarm-time-input'),
    confirmToggle: document.getElementById('alarm-confirm-toggle'),
    messageInput: document.getElementById('alarm-message-input'),
    actionSelect: document.getElementById('alarm-action-select'),
    catGroupEl: document.getElementById('action-category-group'),
    categorySelect: document.getElementById('alarm-action-category-select'),
    typeSelect: document.getElementById('alarm-type-select'),
    weeklyContainer: document.getElementById('weekly-days-container'),
    monthlyDateContainer: document.getElementById('monthly-date-container'),
    monthlyEndContainer: document.getElementById('monthly-end-container'),
    weeklyChipsEl: document.getElementById('alarm-weekly-chips'),
    dayOfMonthInput: document.getElementById('alarm-day-of-month-input'),
    daysBeforeEndInput: document.getElementById('alarm-days-before-end-input'),
    holidayAdjSelect: document.getElementById('alarm-holiday-adj-select'),
    adjDescEl: document.getElementById('alarm-adj-desc'),
    businessDaysContainer: document.getElementById('business-days-container'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    langSelect: document.getElementById('lang-select-editor'),
    resetBtn: document.getElementById('reset-btn'),
    alarmResetBtn: document.getElementById('alarm-reset-btn')
};

function getDefaultAlarm(id, index, order) {
    const isLast = index === 9;
    return {
        id: id || Date.now() + index,
        time: isLast ? '23:59' : '09:00',
        enabled: isLast,
        message: isLast ? DEFAULT_ALARM_MESSAGE_STOP : '',
        action: isLast ? 'stop' : 'none',
        type: 'daily_business',
        daysOfWeek: [1, 2, 3, 4, 5],
        dayOfMonth: 1,
        daysBeforeEnd: 0,
        holidayAdjustment: 'none',
        requireConfirmation: false,
        order: order !== undefined ? order : index
    };
}

async function init() {
    setDatabaseName('QuickLogSoloAlarmEditorDB');

    await initData(state);

    // Ensure exactly 10 alarms exist in state
    if (state.alarms.length < 10) {
        for (let i = state.alarms.length; i < 10; i++) {
            state.alarms.push(getDefaultAlarm(null, i, i));
        }
    } else if (state.alarms.length > 10) {
        state.alarms = state.alarms.slice(0, 10);
    }

    if (state.language) {
        setLanguage(state.language);
        // Map 'auto' or other values to supported select values
        const currentLang = getLanguage();
        const supportedLangs = ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'];
        elements.langSelect.value = supportedLangs.includes(currentLang) ? currentLang : 'en';
    }
    applyLanguage();

    // Theme handling
    const savedTheme = localStorage.getItem('quicklog-theme') || 'light';
    state.theme = savedTheme;
    document.body.className = `theme-${state.theme}`;
    elements.themeToggle.checked = (state.theme === 'dark');

    const history = initHistory(state);
    const ui = initUI(state, elements);

    async function syncUI() {
        ui.renderBusinessDays();
        ui.renderAlarmList();
        ui.renderDetail();
        ui.updateHistoryButtons(history);
        elements.langSelect.value = state.language;
        elements.themeToggle.checked = (state.theme === 'dark');
        document.body.className = `theme-${state.theme}`;
        applyLanguage();

        // Persist restored state
        await saveAllAlarms(state.alarms);
        await saveBusinessDays(state.businessDays);
    }

    state.onHistoryChange = syncUI;

    state.recordAction = () => {
        history.record();
        ui.updateHistoryButtons(history);
    };

    // Initial snapshot
    state.recordAction();

    state.onAlarmChange = async (alarm) => {
        state.recordAction();
        await saveAlarm(alarm);
    };

    state.onSettingsChange = async () => {
        state.recordAction();
        await saveBusinessDays(state.businessDays);
    };

    state.onThemeChange = (theme) => {
        localStorage.setItem('quicklog-theme', theme);
        document.body.className = `theme-${theme}`;
        state.recordAction();
    };

    state.onLanguageChange = (lang) => {
        setLanguage(lang);
        applyLanguage();
        state.recordAction();
        ui.renderBusinessDays();
        ui.renderAlarmList();
        ui.renderDetail();

        // Update URL QueryString
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.history.replaceState({}, '', url);
    };

    state.onReorder = async (fromIndex, toIndex) => {
        const [movedItem] = state.alarms.splice(fromIndex, 1);
        state.alarms.splice(toIndex, 0, movedItem);

        // Update order property for all alarms to persist sequence
        state.alarms.forEach((alarm, i) => {
            alarm.order = i;
        });

        state.recordAction();
        ui.renderAlarmList();
        ui.renderDetail();

        // Save all alarms in one batch to persist order safely
        await saveAllAlarms(state.alarms);
    };

    state.onAlarmReset = async (alarm) => {
        const index = state.alarms.indexOf(alarm);
        if (index === -1) return;

        // Preserve the current order when resetting an alarm
        const currentOrder = alarm.order;
        const defaultAlarm = getDefaultAlarm(alarm.id, index, currentOrder);
        Object.assign(alarm, defaultAlarm);

        state.recordAction();
        ui.renderAlarmList();
        ui.renderDetail();
        await saveAlarm(alarm);
    };

    state.showToast = (msg) => {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    };

    ui.renderBusinessDays();
    ui.renderAlarmList();
    ui.updateHistoryButtons(history);

    // Header interaction
    elements.themeToggle.addEventListener('change', () => {
        state.theme = elements.themeToggle.checked ? 'dark' : 'light';
        state.onThemeChange(state.theme);
    });

    elements.langSelect.addEventListener('change', (e) => {
        state.language = e.target.value;
        state.onLanguageChange(state.language);
    });

    // Reset button
    elements.resetBtn.onclick = async () => {
        if (await showConfirm(t('confirm-reset-all'))) {
            await dbClear(STORE_ALARMS);
            await dbClear(STORE_SETTINGS);
            await dbClear(STORE_CATEGORIES);
            location.reload();
        }
    };

    // Export/Import buttons
    elements.exportBtn.onclick = async () => {
        await exportAlarms(state);
        state.showToast(t('toast-export-success'));
    };

    elements.importBtn.onclick = async () => {
        try {
            if (await showConfirm(t('confirm-import-overwrite'))) {
                await importAlarms();
                location.reload();
            }
        } catch (e) {
            console.error(e);
            alert(t('alert-import-error'));
        }
    };

    // Keyboard shortcuts for Undo/Redo
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                if (history.redo()) {
                    syncUI();
                }
            } else {
                if (history.undo()) {
                    syncUI();
                }
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            if (history.redo()) {
                syncUI();
            }
        }
    });
}

function showConfirm(msg) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-message').textContent = msg;
        modal.classList.remove('hidden');
        document.getElementById('confirm-ok-btn').onclick = () => { modal.classList.add('hidden'); resolve(true); };
        document.getElementById('confirm-cancel-btn').onclick = () => { modal.classList.add('hidden'); resolve(false); };
    });
}

init();
