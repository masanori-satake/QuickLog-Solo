import {
    initDB,
    getCurrentAppState,
    dbGetByName,
    dbGetAll,
    dbCount,
    dbPut,
    dbAdd,
    dbDelete,
    dbClear,
    dbGetLogsByTimeRange,
    LOG_CLEANUP_THRESHOLD_MS,
    setDatabaseName,
    SETTING_KEY_SESSION_SYNC,
    STORE_LOGS,
    STORE_CATEGORIES,
    STORE_SETTINGS,
    STORE_ALARMS,
    SETTING_KEY_THEME,
    SETTING_KEY_FONT,
    SETTING_KEY_FONT_WEIGHT,
    SETTING_KEY_ANIMATION,
    SETTING_KEY_LANGUAGE,
    SETTING_KEY_REPORT_SETTINGS,
    SETTING_KEY_TIMER_HEIGHT,
    SETTING_KEY_PAUSE_STATE,
} from '../shared/js/db.js';
import { backupManager } from './backup.js';
import { restoreManager } from './restore.js';
import { t, setLanguage, getLanguage, applyLanguage, detectBrowserLanguage } from '../shared/js/i18n.js';
import {
    formatDuration,
    formatLogDuration,
    startTaskLogic,
    stopTaskLogic,
    pauseTaskLogic,
    generateReport,
    calculateTagAggregation,
    updateHistoryStartTime,
    deleteHistoryItem,
    splitHistoryItem,
} from '../shared/js/logic.js';
import {
    SYSTEM_CATEGORY_IDLE,
    SYSTEM_CATEGORY_UNKNOWN,
    SYSTEM_CATEGORY_PAGE_BREAK,
    generateUUID,
} from '../shared/js/utils.js';
import { AnimationEngine } from '../shared/js/animations.js';
import { saveAnimationBlob, initAnimationDB } from '../shared/js/idb_storage.js';
import {
    isSessionSyncEnabled,
    pullFromCloud,
    performInitialSync,
    clearCloudHistory,
    broadcastSync,
    setupBroadcastChannel,
    setAnimSyncProgressCallback,
} from '../shared/js/session_sync.js';
import { animations } from '../shared/js/animation_registry.js';
import { getCustomAnimationMetadataMap, setCustomAnimationMetadataMap } from '../shared/js/utils/storage.js';

// QuickLog-Solo: Main Application Entry

// CSS preload activation and FOUC prevention
(function initCssPreload() {
    const preloadLinks = document.querySelectorAll('link[data-preload-style]');
    let loaded = 0;
    const total = preloadLinks.length;

    function revealBody() {
        if (document.body) document.body.style.opacity = '1';
    }

    function onStyleLoaded() {
        if (++loaded >= total) revealBody();
    }

    preloadLinks.forEach(function (link) {
        link.onload = null;
        link.rel = 'stylesheet';
        if (link.sheet) {
            onStyleLoaded();
        } else {
            link.addEventListener('load', onStyleLoaded);
            link.addEventListener('error', onStyleLoaded);
        }
    });

    if (total === 0) {
        revealBody();
    } else {
        setTimeout(revealBody, 3000);
    }
})();

// Constants
const THEME_SYSTEM = 'system';

const URL_PARAM_TEST_CAT = 'test_cat';
const URL_PARAM_TEST_ELAPSED = 'test_elapsed';
const URL_PARAM_TEST_RESUMABLE = 'test_resumable';

const MAX_LOGS_DISPLAY = 100;
const TOAST_DURATION_MS = 2000;
const ITEMS_PER_PAGE = 16;

const EXCLUSION_PADDING_X = 4;
const EXCLUSION_PADDING_Y = 2;

const ID_SETTINGS_POPUP = 'settings-popup';
const ID_SETTINGS_TOGGLE = 'settings-toggle';
const ID_THEME_SELECT = 'theme-select';
const ID_FONT_SELECT = 'font-select';
const ID_FONT_WEIGHT_SELECT = 'font-weight-select';
const ID_ANIMATION_SELECT = 'animation-select';
const ID_LANGUAGE_SELECT = 'language-select';
const ID_TIMER_HEIGHT_SELECT = 'timer-height-select';
const ID_CATEGORY_LIST = 'category-list';
const ID_CATEGORY_PAGINATION = 'category-pagination';
const ID_LOG_LIST = 'log-list';
const ID_ELAPSED_TIME = 'elapsed-time';
const ID_STATUS_LABEL = 'status-label';
const ID_PAUSE_BTN = 'pause-btn';
const ID_END_BTN = 'end-btn';
const ID_CURRENT_TASK_DISPLAY = 'current-task-display';
const ID_TOAST = 'toast';

const ID_BACKUP_EXECUTE_BTN = 'backup-execute-btn';
const ID_BACKUP_CHANGE_DIR_BTN = 'backup-change-dir-btn';
const ID_BACKUP_LAST_TIME_DISPLAY = 'backup-last-time';
const ID_BACKUP_FILE_COUNT_DISPLAY = 'backup-file-count';
const ID_BACKUP_STATUS_INDICATOR = 'backup-status-indicator';

const ID_CONFIRM_MODAL = 'confirm-modal';
const ID_CONFIRM_MESSAGE = 'confirm-message';
const ID_CONFIRM_OK_BTN = 'confirm-ok-btn';
const ID_CONFIRM_CANCEL_BTN = 'confirm-cancel-btn';
const ID_VERSION_DISPLAY = 'version-display';
const ID_STATS_LOG_COUNT = 'stats-log-count';
const ID_STATS_CATEGORY_COUNT = 'stats-category-count';
const ID_ALARM_LIST = 'alarm-list';
const ID_BUSINESS_DAYS_CONTAINER = 'business-days-container';
const ID_CATEGORY_EDITOR_LIST = 'category-editor-list';
const ID_COPY_REPORT_BTN = 'copy-report-btn';
const ID_COPY_AGGREGATION_BTN = 'copy-aggregation-btn';
const ID_CATEGORY_SECTION = 'category-section';

const ID_DELETE_INITIALIZE_BTN = 'delete-initialize-btn';
const ID_SESSION_SYNC_TOGGLE = 'session-sync-toggle';
const ID_SYNC_STATUS_BADGE = 'sync-status-badge';

const CATEGORY_EDITOR_URL = 'https://quick-log-solo.vercel.app/category-editor/';
const ALARM_EDITOR_URL = 'https://quick-log-solo.vercel.app/alarm-editor/';

const ID_REPORT_MODAL = 'report-modal';
const ID_REPORT_PREVIEW = 'report-preview';
const ID_REPORT_DATE_TEXT = 'report-date-text';
const ID_REPORT_DATE_PREV = 'report-date-prev';
const ID_REPORT_DATE_NEXT = 'report-date-next';
const ID_REPORT_DATE_DISPLAY = 'report-date-display';
const ID_REPORT_CALENDAR_CONTAINER = 'report-calendar-container';
const ID_REPORT_FORMAT_SELECT = 'report-format-select';
const ID_REPORT_EMOJI_SELECT = 'report-emoji-select';
const ID_REPORT_ENDTIME_SELECT = 'report-endtime-select';
const ID_REPORT_DURATION_SELECT = 'report-duration-select';
const ID_REPORT_ADJUST_SELECT = 'report-adjust-select';
const ID_REPORT_COPY_CONFIRM_BTN = 'report-copy-confirm-btn';

const ID_TAG_AGGREGATION_MODAL = 'tag-aggregation-modal';
const ID_TAG_AGGREGATION_TABLE = 'tag-aggregation-table';
const ID_TAG_AGGREGATION_DATE_TEXT = 'tag-aggregation-date-text';
const ID_TAG_AGGREGATION_DATE_PREV = 'tag-aggregation-date-prev';
const ID_TAG_AGGREGATION_DATE_NEXT = 'tag-aggregation-date-next';
const ID_TAG_AGGREGATION_DATE_DISPLAY = 'tag-aggregation-date-display';
const ID_TAG_AGGREGATION_CALENDAR_CONTAINER = 'tag-aggregation-calendar-container';

/** @type {Object|null} Currently running task log entry. */
let activeTask = null;
/** @type {number|null} ID of the main timer interval. */
let timerInterval = null;
/** @type {number|null} Timeout ID for delayed sync execution. */
let syncTimeout = null;
/** @type {number} Current page index in the category list. */
let currentCategoryPage = 0;
/** @type {string} Current background animation ID. */
let currentAnimationType = 'digital_rain';
/** @type {string|null} JSON string of the last rendered category state for change detection. */
let lastCategoryRenderData = null;
/** @type {string|null} JSON string of the last rendered logs state for change detection. */
let lastLogsRenderData = null;
/** @type {string} Current custom animation specification hash for change detection. */
let currentCustomAnimSpecHash = '';
/** @type {Object|null} Instance of the animation engine. */
let animationEngine = null;
/** @type {string|null} Key identifying the currently active animation instance. */
let currentActiveAnimation = null;
/** @type {boolean} True if the app has completed initial setup. */
let isAppInitialized = false;
/** @type {Date} Currently selected date in the report modal. */
let reportSelectedDate = new Date();
/** @type {Date} Currently selected date in the tag aggregation modal. */
let tagAggregationSelectedDate = new Date();
/** @type {Set<number>} Timestamps (day start) of all dates containing logs. */
let reportLogDates = new Set();
/** @type {Object} User preferences for report generation. */
let reportSettings = {
    format: 'markdown',
    emoji: 'keep',
    endTime: 'none',
    duration: 'none',
    adjust: 'none',
};

const getEl = (id) => document.getElementById(id);
const queryAll = (selector) => document.querySelectorAll(selector);
const getBody = () => document.body;
const createEl = (tag) => document.createElement(tag);

const FONTS = [
    {
        name: 'Roboto / Noto Sans JP',
        value: "'Roboto', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', sans-serif",
        lang: ['ja', 'en', 'de', 'es', 'fr', 'pt'],
    },
    {
        name: 'Dela Gothic One',
        value: "'Dela Gothic One', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', sans-serif",
        lang: ['ja'],
    },
    {
        name: 'Yusei Magic',
        value: "'Yusei Magic', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', sans-serif",
        lang: ['ja'],
    },
    {
        name: 'Roboto / Noto Sans KR',
        value: "'Roboto', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans Symbols', sans-serif",
        lang: ['ko'],
    },
    {
        name: 'Roboto / Noto Sans SC',
        value: "'Roboto', 'Noto Sans SC', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans Symbols', sans-serif",
        lang: ['zh'],
    },
    {
        name: 'Inter',
        value: "'Inter', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', sans-serif",
        lang: ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'],
    },
    {
        name: 'Montserrat',
        value: "'Montserrat', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', sans-serif",
        lang: ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'],
    },
    {
        name: 'Open Sans',
        value: "'Open Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', sans-serif",
        lang: ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'],
    },
    {
        name: 'Ubuntu',
        value: "'Ubuntu', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', sans-serif",
        lang: ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'],
    },
    {
        name: 'font-system',
        value: 'system-ui, -apple-system, "Noto Sans Symbols", sans-serif',
        lang: ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'],
    },
];

// --- Task Control ---

async function startTask(categoryName, resumableCategory = null) {
    if (syncTimeout) clearTimeout(syncTimeout);
    const cat = await dbGetByName(STORE_CATEGORIES, categoryName);
    const color = cat ? cat.color : null;
    const tags = cat ? cat.tags || '' : '';
    activeTask = await startTaskLogic(categoryName, activeTask, resumableCategory, color, tags);
    updateUI();
    broadcastSync();
}

async function pauseTask() {
    if (syncTimeout) clearTimeout(syncTimeout);
    activeTask = await pauseTaskLogic(activeTask);
    updateUI();
    broadcastSync();
}

async function stopTask(customEndTime = null) {
    if (syncTimeout) clearTimeout(syncTimeout);
    activeTask = await stopTaskLogic(activeTask, true, customEndTime);
    broadcastSync();
}

async function endTask() {
    if (!activeTask) return;
    if (await showConfirm(t('confirm-end-task'))) {
        await stopTask();
        updateUI();
    }
}

// --- History Editing ---

async function openHistoryActionModal(log) {
    const modal = getEl('history-action-modal');
    const editBtn = getEl('history-action-edit-btn');
    const splitBtn = getEl('history-action-split-btn');
    const deleteBtn = getEl('history-action-delete-btn');
    const cancelBtn = getEl('history-action-cancel-btn');

    if (!modal) return;

    const durationMs = log.endTime ? log.endTime - log.startTime : Date.now() - log.startTime;
    const isSpecialCategory = log.category === SYSTEM_CATEGORY_IDLE || log.category === SYSTEM_CATEGORY_UNKNOWN;
    const canSplit =
        !log.isManualStop && !isSpecialCategory && (log.endTime ? durationMs >= 120000 : durationMs >= 60000);

    splitBtn.disabled = !canSplit;
    deleteBtn.disabled = !log.endTime;

    editBtn.onclick = () => {
        modal.classList.add('hidden');
        openHistoryEditModal(log);
    };

    splitBtn.onclick = async () => {
        try {
            await splitHistoryItem(log.id);
        } catch (err) {
            console.error('Failed to split history item:', err);
            alert(t('alert-error') || 'Operation failed');
        } finally {
            modal.classList.add('hidden');
            await syncState();
            broadcastSync();
        }
    };

    deleteBtn.onclick = async () => {
        if (await showConfirm(t('confirm-delete-history'))) {
            try {
                await deleteHistoryItem(log.id);
            } catch (err) {
                console.error('Failed to delete history item:', err);
                alert(t('alert-error') || 'Operation failed');
            } finally {
                modal.classList.add('hidden');
                await syncState();
                broadcastSync();
            }
        }
    };

    cancelBtn.onclick = () => {
        modal.classList.add('hidden');
    };

    modal.classList.remove('hidden');
}

async function openHistoryEditModal(log) {
    const modal = getEl('history-edit-modal');
    const timeInput = getEl('history-edit-time-input');
    const categorySelect = getEl('history-edit-category-select');
    const memoInput = getEl('history-edit-memo-input');
    if (!categorySelect || !memoInput) return;

    const titleEl = getEl('history-edit-title');
    const labelEl = getEl('history-edit-time-label');
    const warningEl = getEl('history-edit-warning');
    const applyBtn = getEl('history-edit-apply-btn');
    const cancelBtn = getEl('history-edit-cancel-btn');

    const categoryItem = getEl('history-edit-category-item');
    const memoItem = getEl('history-edit-memo-item');

    if (!modal || !timeInput) return;

    // Determine if it's a stop marker
    const isStopMarker = log.isManualStop;
    const isTask =
        log.endTime == null ||
        (!isStopMarker && log.category !== SYSTEM_CATEGORY_IDLE && log.category !== SYSTEM_CATEGORY_UNKNOWN);
    const titleKey = isStopMarker ? 'history-edit-stop-title' : 'history-edit-title';
    const labelKey = isStopMarker ? 'history-edit-end-time' : 'history-edit-start-time';

    titleEl.setAttribute('data-i18n', titleKey);
    titleEl.textContent = t(titleKey);
    labelEl.setAttribute('data-i18n', labelKey);
    labelEl.textContent = t(labelKey);

    // Get surrounding logs for range validation
    const allLogs = await dbGetAll(STORE_LOGS);
    const sortedLogs = allLogs.sort((a, b) => a.startTime - b.startTime);
    const currentIndex = sortedLogs.findIndex((l) => l.id === log.id);
    const prevLog = currentIndex > 0 ? sortedLogs[currentIndex - 1] : null;

    const currentDayStart = new Date(log.startTime).setHours(0, 0, 0, 0);
    const currentDayEnd = currentDayStart + 24 * 60 * 60 * 1000 - 1;

    // Initial time value (HH:mm)
    const initialTime = new Date(log.startTime);
    timeInput.value = `${String(initialTime.getHours()).padStart(2, '0')}:${String(initialTime.getMinutes()).padStart(2, '0')}`;

    warningEl.classList.add('hidden');

    if (isTask) {
        categoryItem?.classList.remove('hidden');
        memoItem?.classList.remove('hidden');

        // Populate category dropdown
        const categories = await dbGetAll(STORE_CATEGORIES);
        const workCategories = categories.filter(
            (c) => c.name !== SYSTEM_CATEGORY_IDLE && !(c.name || '').startsWith(SYSTEM_CATEGORY_PAGE_BREAK)
        );
        categorySelect.replaceChildren();

        const currentCategoryExists = workCategories.some((c) => c.name === log.category);
        if (!currentCategoryExists) {
            const opt = createEl('option');
            opt.value = log.category;
            opt.textContent = log.category === SYSTEM_CATEGORY_IDLE ? t('idle-category') : log.category;
            opt.selected = true;
            categorySelect.appendChild(opt);
        }

        workCategories.forEach((c) => {
            const opt = createEl('option');
            opt.value = c.name;
            opt.textContent = c.name;
            if (c.name === log.category) opt.selected = true;
            categorySelect.appendChild(opt);
        });

        memoInput.value = log.memo || '';
    } else {
        categoryItem?.classList.add('hidden');
        memoItem?.classList.add('hidden');
    }

    const validate = () => {
        const [h, m] = timeInput.value.split(':').map(Number);
        const newTime = new Date(log.startTime);
        newTime.setHours(h, m, 0, 0);
        const newTs = newTime.getTime();

        let isValid = true;
        if (log.endTime == null) {
            let minTs = currentDayStart;
            if (prevLog) {
                const isContiguous = Math.abs(prevLog.endTime - log.startTime) <= 1000;
                minTs = isContiguous && !prevLog.isManualStop ? prevLog.startTime + 60000 : prevLog.endTime;
            }
            const maxTs = Date.now();
            if (newTs < minTs || newTs > maxTs) {
                isValid = false;
            }
        } else {
            // Range validation
            // 1. Must be within the same day
            if (newTs < currentDayStart || newTs > currentDayEnd) {
                isValid = false;
            }
            // 2. Must be after previous start (if exists)
            if (prevLog && newTs < prevLog.startTime) {
                isValid = false;
            }
            // 3. Must be before current end (if not stop marker)
            if (!isStopMarker && newTs > log.endTime) {
                isValid = false;
            }
            // Special case for stop marker: must not exceed previous start if contiguous
            if (isStopMarker && prevLog && prevLog.endTime === log.startTime && newTs < prevLog.startTime) {
                isValid = false;
            }
        }

        if (isValid) {
            warningEl.classList.add('hidden');
        } else {
            warningEl.classList.remove('hidden');
        }
        return isValid;
    };

    timeInput.oninput = () => {
        warningEl.classList.add('hidden');
    };

    applyBtn.onclick = async () => {
        if (!validate()) return;

        const [h, m] = timeInput.value.split(':').map(Number);
        const newTime = new Date(log.startTime);
        newTime.setHours(h, m, 0, 0);
        const newTs = newTime.getTime();

        if (isTask) {
            const newCategoryName = categorySelect.value;
            if (newCategoryName !== log.category) {
                const cat = await dbGetByName(STORE_CATEGORIES, newCategoryName);
                log.category = newCategoryName;
                log.color = cat ? cat.color : log.color;
                log.tags = cat ? cat.tags || '' : log.tags;
            }
            log.memo = memoInput.value.trim() || undefined;
            log.updatedAt = Date.now();
            await dbPut(STORE_LOGS, log);
        }

        await updateHistoryStartTime(log.id, newTs);

        if (log.endTime == null) {
            log.startTime = newTs;
            await dbPut(STORE_SETTINGS, {
                key: SETTING_KEY_PAUSE_STATE,
                value: { ...log, isPaused: log.category === SYSTEM_CATEGORY_IDLE },
            });
            activeTask = log;
        }

        modal.classList.add('hidden');
        await updateUI();
        broadcastSync();
    };

    cancelBtn.onclick = () => {
        modal.classList.add('hidden');
    };

    modal.classList.remove('hidden');
}

// --- Timer Management ---

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

async function updateTimer() {
    if (!activeTask) {
        if (timerInterval) clearInterval(timerInterval);
        return;
    }

    const now = Date.now();

    const elapsed = now - activeTask.startTime;
    const timeStr = formatDuration(elapsed);

    const el = getEl(ID_ELAPSED_TIME);
    if (el) el.textContent = timeStr;

    const isPaused = activeTask.category === SYSTEM_CATEGORY_IDLE;

    if (isPaused) {
        if (currentActiveAnimation !== null) {
            animationEngine?.stop();
            currentActiveAnimation = null;
        }
    }
}

// --- UI Rendering ---

function applyTimerHeight(height) {
    const body = getBody();
    const select = getEl(ID_TIMER_HEIGHT_SELECT);
    if (select) select.value = height;

    const simulatedHeights = {
        normal: 100,
        compact: 66,
        mini: 50,
    };
    if (animationEngine) {
        animationEngine.simulatedHeight = simulatedHeights[height] || 100;
    }

    if (body.classList.contains(`timer-${height}`)) return;

    body.classList.remove('timer-normal', 'timer-compact', 'timer-mini');
    body.classList.add(`timer-${height}`);

    const factors = {
        normal: 1,
        compact: 2 / 3,
        mini: 0.5,
    };
    const factor = factors[height] || 1;

    document.documentElement.style.setProperty('--timer-height-factor', factor);

    // After height change, we need to update animation engine and exclusion areas
    if (animationEngine) {
        animationEngine.resize();
        updateAnimationExclusionAreas();
    }
}

function applyTheme(theme) {
    const body = getBody();
    body.classList.remove('theme-light', 'theme-dark');
    if (theme === THEME_SYSTEM) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        body.classList.add(isDark ? 'theme-dark' : 'theme-light');
    } else {
        body.classList.add(`theme-${theme}`);
    }
    const select = getEl(ID_THEME_SELECT);
    if (select) select.value = theme;
}

function ensureGoogleFontLoaded(fontValue) {
    if (!fontValue || typeof fontValue !== 'string') return;
    const fontFamilies = ['Dela Gothic One', 'Yusei Magic', 'Roboto', 'Inter', 'Montserrat', 'Open Sans', 'Ubuntu'];
    const match = fontFamilies.find((f) => fontValue.includes(`'${f}'`));
    if (!match) return;

    const linkId = `google-font-link-${match.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(linkId)) return;

    // Load font dynamically from Google Fonts if online
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(match)}:wght@400;500;700&display=swap`;
    link.onerror = () => {
        // Silent fallback to local system font if offline or blocked
        link.remove();
    };
    document.head.appendChild(link);
}

function applyFont(fontValue) {
    ensureGoogleFontLoaded(fontValue);
    getBody().style.setProperty('--font-family', fontValue);
    const select = getEl(ID_FONT_SELECT);
    if (select) select.value = fontValue;
}

function applyFontWeight(weightValue) {
    const weights = {
        normal: '400',
        medium: '500',
        bold: '700',
        heavy: '900',
    };
    const val = weights[weightValue] || '';
    if (val) {
        getBody().style.setProperty('--font-weight-custom', val);
    } else {
        getBody().style.removeProperty('--font-weight-custom');
    }
    const select = getEl(ID_FONT_WEIGHT_SELECT);
    if (select) select.value = weightValue;
}

function applyAnimation(animationType, categoryAnimation = 'default', color = 'primary', customAnimSpecHash = '') {
    currentAnimationType = animationType;
    let activeAnimation = categoryAnimation && categoryAnimation !== 'default' ? categoryAnimation : animationType;

    if (categoryAnimation === 'none') {
        activeAnimation = 'none';
    }

    const select = getEl(ID_ANIMATION_SELECT);
    if (select && select.value !== animationType) select.value = animationType;

    const display = getEl(ID_CURRENT_TASK_DISPLAY);

    if (animationEngine && activeTask && activeTask.category !== SYSTEM_CATEGORY_IDLE && activeAnimation !== 'none') {
        const colorCode = getColorCode(color);
        const animStateKey = `${activeAnimation}-${activeTask.startTime}-${colorCode}-${customAnimSpecHash}`;
        if (currentActiveAnimation !== animStateKey) {
            animationEngine.start(activeAnimation, activeTask.startTime, colorCode);
            currentActiveAnimation = animStateKey;
        } else if (!animationEngine.worker) {
            // Guard against the case where engine was stopped but currentActiveAnimation wasn't reset
            animationEngine.start(activeAnimation, activeTask.startTime, colorCode);
        }
        display?.classList.add('anim-active');
        display?.classList.remove('retro-lcd', 'retro-crt', 'retro-nixie');
        if (color === 'retro-lcd') display?.classList.add('retro-lcd');
        else if (color === 'retro-crt') display?.classList.add('retro-crt');
        else if (color === 'retro-nixie') display?.classList.add('retro-nixie');

        const base = getEl('current-task-display-base');
        base?.classList.add('anim-active');
        base?.classList.add(`cat-${color}`);
        getEl(ID_PAUSE_BTN)?.classList.add('anim-active');
        getEl(ID_END_BTN)?.classList.add('anim-active');
        updateAnimationExclusionAreas();
    } else {
        if (currentActiveAnimation !== null) {
            animationEngine?.stop();
            currentActiveAnimation = null;
        }
        display?.classList.remove('anim-active', 'retro-lcd', 'retro-crt', 'retro-nixie');
        const base = getEl('current-task-display-base');
        base?.classList.remove('anim-active');
        const colorClasses = Array.from(base?.classList || []).filter((c) => c.startsWith('cat-'));
        colorClasses.forEach((c) => base.classList.remove(c));
        getEl(ID_PAUSE_BTN)?.classList.remove('anim-active');
        getEl(ID_END_BTN)?.classList.remove('anim-active');
    }
}

function splitCategoriesIntoPages(allCategories) {
    allCategories.sort((a, b) => (a.order || 0) - (b.order || 0));

    const pages = [[]];
    let currentPageIdx = 0;
    allCategories.forEach((cat) => {
        if (cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) {
            // Only push a new page if current page isn't empty
            // to avoid multiple page breaks creating multiple empty pages
            if (pages[currentPageIdx].length > 0) {
                pages.push([]);
                currentPageIdx++;
            }
        } else {
            if (pages[currentPageIdx].length >= ITEMS_PER_PAGE) {
                pages.push([]);
                currentPageIdx++;
            }
            pages[currentPageIdx].push(cat);
        }
    });
    // Remove last page if empty (can happen if last item was a page break)
    if (pages.length > 1 && pages[pages.length - 1].length === 0) {
        pages.pop();
    }
    return pages;
}

async function renderCategories() {
    let allCategories;
    try {
        allCategories = await dbGetAll(STORE_CATEGORIES);
    } catch (e) {
        console.error('Failed to get categories:', e);
        return;
    }

    const pages = splitCategoriesIntoPages(allCategories);
    const totalPages = pages.length;
    if (currentCategoryPage >= totalPages) currentCategoryPage = totalPages - 1;

    const pageCategories = pages[currentCategoryPage] || [];

    const activeTaskCatName = activeTask ? activeTask.category : null;

    // Check if we actually need to re-render
    const currentRenderData = JSON.stringify({
        page: currentCategoryPage,
        activeTask: activeTaskCatName,
        categories: pageCategories.map((c) => ({ name: c.name, color: c.color, animation: c.animation })),
    });

    if (lastCategoryRenderData === currentRenderData) {
        return;
    }
    lastCategoryRenderData = currentRenderData;

    const list = getEl(ID_CATEGORY_LIST);
    if (!list) return;

    const fragment = document.createDocumentFragment();
    pageCategories.forEach((cat) => {
        const btn = createEl('button');
        btn.className = `category-btn cat-${cat.color || 'primary'}`;
        const isActive = activeTask && activeTask.category === cat.name;
        if (isActive) {
            btn.classList.add('active');
            btn.disabled = true;
        }
        btn.textContent = cat.name;
        btn.title = cat.name;
        btn.onclick = () => startTask(cat.name);
        fragment.appendChild(btn);
    });
    list.replaceChildren(fragment);

    renderPaginationDots(totalPages);
}

function renderPaginationDots(totalPages) {
    const container = getEl(ID_CATEGORY_PAGINATION);
    if (!container) return;

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < totalPages; i++) {
        const dot = createEl('div');
        dot.className = 'pagination-dot' + (i === currentCategoryPage ? ' active' : '');
        dot.onclick = () => {
            if (currentCategoryPage !== i) {
                currentCategoryPage = i;
                renderCategories();
            }
        };
        fragment.appendChild(dot);
    }
    container.replaceChildren(fragment);
}

async function renderLogs() {
    let allLogs;
    let categories;
    try {
        allLogs = await dbGetLogsByTimeRange(Date.now() - LOG_CLEANUP_THRESHOLD_MS);
        categories = await dbGetAll(STORE_CATEGORIES);
    } catch (e) {
        console.error('Failed to get data for logs:', e);
        return;
    }
    const categoryMap = new Map(categories.map((c) => [c.name, c]));
    const visibleLogs = allLogs
        .filter((l) => !(l.category || '').startsWith(SYSTEM_CATEGORY_PAGE_BREAK))
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, MAX_LOGS_DISPLAY);

    // Change detection for logs rendering to avoid flickering
    const currentLogsData = JSON.stringify({
        lang: getLanguage(),
        logs: visibleLogs.map((l) => ({
            id: l.id,
            category: l.category,
            startTime: l.startTime,
            endTime: l.endTime,
            isManualStop: l.isManualStop,
            memo: l.memo,
            color: l.color,
        })),
    });

    if (lastLogsRenderData === currentLogsData) {
        return;
    }
    lastLogsRenderData = currentLogsData;

    const logList = getEl(ID_LOG_LIST);
    if (!logList) return;

    const fragment = document.createDocumentFragment();
    let lastDate = '';
    const days = t('day-names');

    visibleLogs.forEach((log) => {
        const d = new Date(log.startTime);
        const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;

        if (dateStr !== lastDate) {
            const header = createEl('li');
            header.className = 'log-date-header';
            header.textContent = dateStr;
            fragment.appendChild(header);
            lastDate = dateStr;
        }

        const li = createLogElement(log, categoryMap);
        li.style.cursor = 'pointer';
        li.onclick = () => openHistoryActionModal(log);
        fragment.appendChild(li);
    });
    logList.replaceChildren(fragment);
}

function createLogElement(log, categoryMap) {
    const li = createEl('li');
    li.className = 'log-item';
    const startTimeStr = new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = log.endTime
        ? new Date(log.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    // Tags are hidden in history as per requirements
    const timeRangeSpan = createEl('span');
    timeRangeSpan.className = 'log-time';
    if (log.isManualStop) {
        const hiddenStart = createEl('span');
        hiddenStart.style.visibility = 'hidden';
        hiddenStart.textContent = startTimeStr;
        timeRangeSpan.appendChild(hiddenStart);
        timeRangeSpan.appendChild(document.createTextNode(`-${endTimeStr}`));
    } else if (log.endTime) {
        timeRangeSpan.textContent = `${startTimeStr}-${endTimeStr}`;
    } else {
        timeRangeSpan.appendChild(document.createTextNode(`${startTimeStr}-`));
        const hiddenEnd = createEl('span');
        hiddenEnd.style.visibility = 'hidden';
        hiddenEnd.textContent = startTimeStr;
        timeRangeSpan.appendChild(hiddenEnd);
    }

    const durationMs = log.endTime ? log.endTime - log.startTime : 0;
    const durationText = log.endTime && !log.isManualStop ? formatLogDuration(durationMs) : '';

    let colorClass;
    let displayName = log.category;

    if (log.isManualStop) {
        colorClass = 'dot-error';
        displayName = t('stop');
    } else if (log.category === SYSTEM_CATEGORY_IDLE) {
        colorClass = 'dot-neutral';
        displayName = t('idle-category-log');
    } else if (log.category === SYSTEM_CATEGORY_UNKNOWN) {
        colorClass = 'dot-outline';
        displayName = t('category-unknown');
    } else {
        const color = log.color || (categoryMap.get(log.category) ? categoryMap.get(log.category).color : 'primary');
        colorClass = `dot-${color}`;
        if (log.memo) {
            displayName = log.memo;
        }
    }

    const nameSpan = createEl('span');
    nameSpan.className = 'log-name';
    const dotSpan = createEl('span');
    dotSpan.className = `category-dot ${colorClass}`;
    nameSpan.appendChild(dotSpan);
    nameSpan.appendChild(document.createTextNode(displayName));

    const durSpan = createEl('span');
    durSpan.className = 'log-duration';
    durSpan.textContent = durationText;

    li.appendChild(timeRangeSpan);
    li.appendChild(nameSpan);
    li.appendChild(durSpan);

    return li;
}

function updateAnimationExclusionAreas() {
    if (!animationEngine) return;
    const canvas = getEl('animation-canvas');
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    // Grouping related elements into separate logical areas for cleaner exclusion
    const taskNameText = getEl('current-task-name-text');
    const statusLabel = getEl(ID_STATUS_LABEL);
    const elapsedTime = getEl(ID_ELAPSED_TIME);

    const exclusionAreas = [];

    if (taskNameText && taskNameText.textContent !== '-') {
        const rect = taskNameText.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            exclusionAreas.push({
                x: rect.left - canvasRect.left - EXCLUSION_PADDING_X,
                y: rect.top - canvasRect.top - EXCLUSION_PADDING_Y,
                width: rect.width + EXCLUSION_PADDING_X * 2,
                height: rect.height + EXCLUSION_PADDING_Y * 2,
            });
        }
    }

    if (statusLabel) {
        const rect = statusLabel.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            exclusionAreas.push({
                x: rect.left - canvasRect.left - EXCLUSION_PADDING_X,
                y: rect.top - canvasRect.top - EXCLUSION_PADDING_Y,
                width: rect.width + EXCLUSION_PADDING_X * 2,
                height: rect.height + EXCLUSION_PADDING_Y * 2,
            });
        }
    }

    if (elapsedTime && !elapsedTime.classList.contains('hidden')) {
        const rect = elapsedTime.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            exclusionAreas.push({
                x: rect.left - canvasRect.left - EXCLUSION_PADDING_X,
                y: rect.top - canvasRect.top - EXCLUSION_PADDING_Y,
                width: rect.width + EXCLUSION_PADDING_X * 2,
                height: rect.height + EXCLUSION_PADDING_Y * 2,
            });
        }
    }

    animationEngine.setExclusionAreas(exclusionAreas);
}

function handleSyncMessage(data) {
    if (!data) return;
    if (data.type === 'reload') {
        location.reload();
    } else if (data.type === 'alarms-updated') {
        // Background script handles alarm scheduling, but we might want to refresh UI if open
        const alarmsTab = getEl('alarms-tab');
        if (alarmsTab && !alarmsTab.classList.contains('hidden')) {
            renderAlarmList();
            renderBusinessDays();
        }
    } else if (data.type === 'categories-updated' || data.type === 'sync') {
        const categoriesTab = getEl('categories-tab');
        if (categoriesTab && !categoriesTab.classList.contains('hidden')) {
            renderCategoryList();
        }
        // Only sync if visible to reduce CPU load as requested
        if (document.visibilityState === 'visible') {
            syncState();
        }
    }
}

function initAnimationEngine() {
    const canvas = getEl('animation-canvas');
    if (canvas) {
        animationEngine = new AnimationEngine(canvas);
        window.animationEngine = animationEngine; // Expose for testing/debugging
        animationEngine.onStop = () => {
            currentActiveAnimation = null;
        };
        animations.forEach((anim) => {
            animationEngine.register(anim.id, anim.class, anim.id);
        });
        animationEngine.resize();
        updateAnimationExclusionAreas();
        window.addEventListener('resize', () => {
            animationEngine.resize();
            updateAnimationExclusionAreas();
        });

        // Robustness: Handle transition-based side panel opening
        const observer = new ResizeObserver(() => {
            if (animationEngine && document.visibilityState === 'visible') {
                animationEngine.resize();
                updateAnimationExclusionAreas();
            }
        });
        observer.observe(canvas.parentElement);
    }
}

async function syncState() {
    if (!isAppInitialized) return;
    const state = await getCurrentAppState();

    // Backup UI sync
    updateBackupUI();

    // Session Sync UI sync
    const syncEnabled = !!state.sessionSync;
    const syncBadge = getEl(ID_SYNC_STATUS_BADGE);
    if (syncBadge) {
        if (syncEnabled) {
            syncBadge.classList.remove('hidden');
        } else {
            syncBadge.classList.add('hidden');
        }
    }
    const syncToggle = getEl(ID_SESSION_SYNC_TOGGLE);
    if (syncToggle) {
        syncToggle.checked = syncEnabled;
    }

    // Toggle Maintenance sections based on Sync state
    getEl('maintenance-sync-pull-section')?.classList.toggle('hidden', !syncEnabled);
    getEl('maintenance-sync-clear-cloud-section')?.classList.toggle('hidden', !syncEnabled);

    // Migration: Update 'matrix_code' to 'digital_rain' for existing users
    if (state.animation === 'matrix_code') {
        state.animation = 'digital_rain';
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_ANIMATION, value: 'digital_rain' });
    }
    activeTask = state.activeTask;

    const lang = state.language || 'auto';
    setLanguage(lang);
    applyLanguage();
    updateBackupUI();

    applyTheme(state.theme || THEME_SYSTEM);
    applyTimerHeight(state.timerHeight || 'normal');
    applyFontWeight(state.fontWeight || 'normal');

    const langSelect = getEl(ID_LANGUAGE_SELECT);
    if (langSelect) langSelect.value = state.language || 'auto';

    // Apply report settings
    if (state.reportSettings) {
        reportSettings = state.reportSettings;
        const fmtSelect = getEl(ID_REPORT_FORMAT_SELECT);
        if (fmtSelect) {
            fmtSelect.value = reportSettings.format;
            updateDurationSelectOptions(reportSettings.format);
        }
        if (getEl(ID_REPORT_EMOJI_SELECT)) getEl(ID_REPORT_EMOJI_SELECT).value = reportSettings.emoji;
        if (getEl(ID_REPORT_ENDTIME_SELECT)) getEl(ID_REPORT_ENDTIME_SELECT).value = reportSettings.endTime;
        if (getEl(ID_REPORT_DURATION_SELECT)) getEl(ID_REPORT_DURATION_SELECT).value = reportSettings.duration;
        if (getEl(ID_REPORT_ADJUST_SELECT)) getEl(ID_REPORT_ADJUST_SELECT).value = reportSettings.adjust || 'none';
    }

    // Update Animation options
    currentAnimationType = state.animation || 'digital_rain';
    await updateAnimationSelect();

    // Update Font options first. This filters the available fonts based on language.
    updateFontSelect();

    // Ensure the selected font is valid for the current language, or fallback
    const currentLang = lang === 'auto' ? detectBrowserLanguage() : lang;
    const filteredFonts = FONTS.filter((f) => f.lang.includes(currentLang));
    const fontToApply = filteredFonts.some((f) => f.value === state.font) ? state.font : filteredFonts[0].value;
    applyFont(fontToApply);

    // Determine active animation type
    let color = 'primary';
    let categoryAnimation = 'default';
    let customAnimSpecHash = '';
    if (activeTask && activeTask.category !== SYSTEM_CATEGORY_IDLE) {
        const cat = await dbGetByName(STORE_CATEGORIES, activeTask.category);
        color = cat ? cat.color : activeTask.color || 'primary';
        categoryAnimation = cat ? cat.animation || 'default' : 'default';

        const animId = cat ? cat.animation : null;
        if (animId && animId !== 'default' && animId !== 'none') {
            const customAnims = await getCustomAnimationMetadataMap();
            if (customAnims[animId]) {
                const spec = customAnims[animId].payload?.renderSpec || {};
                const conf = customAnims[animId].config || {};
                const rev = customAnims[animId].revision || 0;
                customAnimSpecHash = JSON.stringify({ spec, conf, rev });
            }
        }
    }
    currentCustomAnimSpecHash = customAnimSpecHash;
    applyAnimation(state.animation || 'digital_rain', categoryAnimation, color, customAnimSpecHash);

    await updateUI();

    // Settings popup logic: Refresh content if tab is active
    const settingsPopup = getEl(ID_SETTINGS_POPUP);
    if (settingsPopup && !settingsPopup.classList.contains('hidden')) {
        const activeEl = document.activeElement;

        const alarmsTab = getEl('alarms-tab');
        if (alarmsTab && !alarmsTab.classList.contains('hidden')) {
            await renderBusinessDays();
            // Skip re-rendering alarms list if user is actively interacting with an input/select inside it
            const alarmList = getEl(ID_ALARM_LIST);
            const businessDaysContainer = getEl(ID_BUSINESS_DAYS_CONTAINER);
            const isEditing = activeEl && (alarmList?.contains(activeEl) || businessDaysContainer?.contains(activeEl));
            if (!isEditing) {
                await renderAlarmList();
            }
        }
        const categoriesTab = getEl('categories-tab');
        if (categoriesTab && !categoriesTab.classList.contains('hidden')) {
            await renderCategoryList();
        }
        const aboutTab = getEl('about-tab');
        if (aboutTab && !aboutTab.classList.contains('hidden')) {
            await updateAboutStats();
        }
    }
}

async function updateAboutStats() {
    try {
        const logCount = await dbCount(STORE_LOGS);
        const categories = await dbGetAll(STORE_CATEGORIES);
        // Exclude system categories and page breaks from count
        const categoryCount = categories.filter(
            (c) => c.name !== SYSTEM_CATEGORY_IDLE && !(c.name || '').startsWith(SYSTEM_CATEGORY_PAGE_BREAK)
        ).length;

        const logCountEl = getEl(ID_STATS_LOG_COUNT);
        if (logCountEl) logCountEl.textContent = logCount.toLocaleString();

        const catCountEl = getEl(ID_STATS_CATEGORY_COUNT);
        if (catCountEl) catCountEl.textContent = categoryCount.toLocaleString();
    } catch (e) {
        console.error('Failed to update About stats:', e);
    }
}

function getAnimationTooltip(metadata, lang) {
    let description = '';
    if (metadata.description) {
        description =
            typeof metadata.description === 'object'
                ? metadata.description[lang] || metadata.description['en'] || ''
                : metadata.description;
    }

    const author = metadata.author;
    if (description || author) {
        const authorText = author || t('anim-unknown-author');
        const authorLine = `${t('anim-author-label')}: ${authorText}`;
        return description ? `${description}\n${authorLine}` : authorLine;
    }
    return '';
}

async function updateAnimationSelect() {
    const animSelect = getEl(ID_ANIMATION_SELECT);
    if (animSelect) {
        const currentLang = getLanguage();
        animSelect.replaceChildren();

        const noneOpt = createEl('option');
        noneOpt.value = 'none';
        noneOpt.textContent = t('anim-none');
        animSelect.appendChild(noneOpt);

        animations.forEach((anim) => {
            const opt = createEl('option');
            opt.value = anim.id;
            if (typeof anim.metadata.name === 'object') {
                opt.textContent = anim.metadata.name[currentLang] || anim.metadata.name['en'] || anim.id;
            } else {
                opt.textContent = anim.metadata.name;
            }

            opt.title = getAnimationTooltip(anim.metadata, currentLang);
            animSelect.appendChild(opt);
        });

        // Append custom animations if available
        const customAnims = await getCustomAnimationMetadataMap();
        Object.keys(customAnims)
            .sort((a, b) => {
                const orderA = customAnims[a].order ?? 0;
                const orderB = customAnims[b].order ?? 0;
                return orderA - orderB;
            })
            .forEach((id) => {
                const opt = createEl('option');
                opt.value = id;
                opt.textContent = customAnims[id].name;
                animSelect.appendChild(opt);
            });

        animSelect.value = currentAnimationType;
    }
}

function updateFontSelect() {
    const fontSelect = getEl(ID_FONT_SELECT);
    if (fontSelect) {
        const currentFont = fontSelect.value;
        const currentLang = getLanguage();

        fontSelect.replaceChildren();
        const filteredFonts = FONTS.filter((f) => f.lang.includes(currentLang));

        filteredFonts.forEach((f) => {
            ensureGoogleFontLoaded(f.value);
            const opt = createEl('option');
            opt.value = f.value;
            opt.textContent = f.name === 'font-system' ? t('font-system') : f.name;
            opt.style.fontFamily = f.value;
            fontSelect.appendChild(opt);
        });

        // If the previously selected font is not in the filtered list, select the first available one
        if (!filteredFonts.some((f) => f.value === currentFont)) {
            if (filteredFonts.length > 0) {
                fontSelect.value = filteredFonts[0].value;
                // We should also update the style since the value changed
                getBody().style.setProperty('--font-family', filteredFonts[0].value);
            }
        } else {
            fontSelect.value = currentFont;
        }
    }
}

async function updateUI() {
    if (timerInterval) clearInterval(timerInterval);

    try {
        await renderCategories();
    } catch (e) {
        console.error('updateUI: Failed to render categories', e);
    }

    try {
        await renderLogs();
    } catch (e) {
        console.error('updateUI: Failed to render logs', e);
    }

    const elements = {
        statusLabel: getEl(ID_STATUS_LABEL),
        pauseBtn: getEl(ID_PAUSE_BTN),
        endBtn: getEl(ID_END_BTN),
        elapsedTime: getEl(ID_ELAPSED_TIME),
        display: getEl(ID_CURRENT_TASK_DISPLAY),
    };

    if (activeTask) {
        let color;
        let categoryAnimation;
        const isPaused = activeTask.category === SYSTEM_CATEGORY_IDLE;

        if (isPaused) {
            color = 'neutral';
        } else {
            const cat = await dbGetByName(STORE_CATEGORIES, activeTask.category);
            color = cat ? cat.color : activeTask.color || 'primary';
            categoryAnimation = cat ? cat.animation : 'default';
        }

        if (elements.display) elements.display.className = `cat-${color}`;

        const iconName = isPaused ? 'pause' : 'play_arrow';
        const statusClass = isPaused ? 'status-paused' : 'status-running';
        if (elements.statusLabel) {
            elements.statusLabel.textContent = iconName;
            elements.statusLabel.className = `material-symbols-outlined ${statusClass}`;
            elements.statusLabel.title = isPaused ? t('tooltip-status-paused') : t('tooltip-status-running');
            if (isPaused) {
                elements.statusLabel.classList.add('blink');
            } else {
                elements.statusLabel.classList.remove('blink');
            }
        }
        const displayCategoryName = isPaused ? t('idle-category') : activeTask.category;
        const nameEl = getEl('current-task-name-text');
        if (nameEl) nameEl.textContent = displayCategoryName;

        if (elements.pauseBtn) {
            elements.pauseBtn.replaceChildren();
            const icon = createEl('span');
            icon.className = 'material-symbols-outlined btn-icon';
            const text = createEl('span');
            text.className = 'btn-text';

            if (isPaused) {
                icon.textContent = 'play_arrow';
                text.textContent = t('resume');
                elements.pauseBtn.disabled = !activeTask.resumableCategory;
            } else {
                icon.textContent = 'pause';
                text.textContent = t('pause');
                elements.pauseBtn.disabled = false;
            }
            elements.pauseBtn.appendChild(icon);
            elements.pauseBtn.appendChild(text);
        }
        if (elements.endBtn) elements.endBtn.disabled = false;

        startTimer();
        // Ensure proper animation visibility (called after text content is updated for accurate exclusion)
        applyAnimation(currentAnimationType, categoryAnimation, color, currentCustomAnimSpecHash);
    } else {
        if (currentActiveAnimation !== null) {
            animationEngine?.stop();
            currentActiveAnimation = null;
        }
        // Do not call applyAnimation with global setting here, it resets currentAnimationType potentially
        // instead, just ensure engine is stopped.

        if (elements.display) elements.display.className = '';
        if (elements.statusLabel) {
            elements.statusLabel.textContent = 'stop';
            elements.statusLabel.className = 'material-symbols-outlined status-stopped';
            elements.statusLabel.title = t('tooltip-status-stopped');
        }
        const nameEl = getEl('current-task-name-text');
        if (nameEl) nameEl.textContent = t('status-stopped-name');

        if (elements.pauseBtn) {
            elements.pauseBtn.disabled = true;
            elements.pauseBtn.replaceChildren();
            const icon = createEl('span');
            icon.className = 'material-symbols-outlined btn-icon';
            icon.textContent = 'pause';
            const text = createEl('span');
            text.className = 'btn-text';
            text.textContent = t('pause');
            elements.pauseBtn.appendChild(icon);
            elements.pauseBtn.appendChild(text);
        }
        if (elements.endBtn) elements.endBtn.disabled = true;

        if (elements.elapsedTime) {
            elements.elapsedTime.textContent = '00:00:00';
        }
        document.title = 'QuickLog-Solo';
    }

    // Consolidate timer visibility: The timer remains visible across all states to ensure layout stability.
    if (elements.elapsedTime) {
        elements.elapsedTime.classList.remove('hidden');
        elements.elapsedTime.style.visibility = 'visible';
    }
}

// --- Action Logic ---

async function openReportModal() {
    reportSelectedDate = new Date();
    reportSelectedDate.setHours(0, 0, 0, 0);

    const logs = await dbGetLogsByTimeRange(Date.now() - LOG_CLEANUP_THRESHOLD_MS);
    reportLogDates = new Set(logs.map((l) => new Date(l.startTime).setHours(0, 0, 0, 0)));

    const state = await getCurrentAppState();
    if (state.reportSettings) {
        reportSettings = state.reportSettings;
        getEl(ID_REPORT_FORMAT_SELECT).value = reportSettings.format;
        getEl(ID_REPORT_EMOJI_SELECT).value = reportSettings.emoji;
        getEl(ID_REPORT_ENDTIME_SELECT).value = reportSettings.endTime;
        updateDurationSelectOptions(reportSettings.format);
        getEl(ID_REPORT_DURATION_SELECT).value = reportSettings.duration;
        getEl(ID_REPORT_ADJUST_SELECT).value = reportSettings.adjust || 'none';
    } else {
        updateDurationSelectOptions(getEl(ID_REPORT_FORMAT_SELECT).value);
    }

    updateReportUI();
    getEl(ID_REPORT_MODAL).classList.remove('hidden');
}

async function openTagAggregationModal() {
    tagAggregationSelectedDate = new Date();
    tagAggregationSelectedDate.setHours(0, 0, 0, 0);

    const logs = await dbGetLogsByTimeRange(Date.now() - LOG_CLEANUP_THRESHOLD_MS);
    reportLogDates = new Set(logs.map((l) => new Date(l.startTime).setHours(0, 0, 0, 0)));

    await updateTagAggregationUI();
    getEl(ID_TAG_AGGREGATION_MODAL).classList.remove('hidden');
}

function updateDurationSelectOptions(format) {
    const select = getEl(ID_REPORT_DURATION_SELECT);
    if (!select) return;

    const currentValue = select.value;
    select.replaceChildren();

    const addOption = (value, i18nKey) => {
        const opt = createEl('option');
        opt.value = value;
        opt.textContent = t(i18nKey);
        opt.setAttribute('data-i18n', i18nKey);
        select.appendChild(opt);
    };

    addOption('none', 'report-duration-none');

    if (format === 'csv' || format === 'tsv') {
        addOption('right', 'report-endtime-show'); // Use "Show" (あり) label for "right"
        if (currentValue === 'bottom') {
            select.value = 'right';
            reportSettings.duration = 'right';
        } else {
            select.value = currentValue;
        }
    } else {
        addOption('right', 'report-duration-right');
        addOption('bottom', 'report-duration-bottom');
        select.value = currentValue;
    }
}

async function updateReportUI() {
    const d = reportSelectedDate;
    const days = t('day-names');
    const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
    getEl(ID_REPORT_DATE_TEXT).textContent = dateStr;

    const startOfDay = d.getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
    const dayLogs = (await dbGetLogsByTimeRange(startOfDay, endOfDay))
        .filter((l) => l.endTime)
        .sort((a, b) => a.startTime - b.startTime);

    const reportText = generateReport(dayLogs, {
        ...reportSettings,
        idleText: t('idle-category-log'),
        headerTime: t('report-header-time'),
        headerCategory: t('report-header-category'),
    });
    getEl(ID_REPORT_PREVIEW).textContent = reportText || t('no-logs-for-day');
}

async function saveReportSettings() {
    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_REPORT_SETTINGS, value: reportSettings });
}

async function moveReportDate(delta) {
    reportSelectedDate = moveSelectedDate(reportSelectedDate, delta);
    updateReportUI();
}

async function moveTagAggregationDate(delta) {
    tagAggregationSelectedDate = moveSelectedDate(tagAggregationSelectedDate, delta);
    updateTagAggregationUI();
}

function moveSelectedDate(currentDate, delta) {
    const logDates = [...reportLogDates].sort((a, b) => a - b);
    const today = new Date().setHours(0, 0, 0, 0);

    let current = currentDate.getTime();
    let newDate = currentDate;

    if (delta < 0) {
        // Find previous date with logs
        const prevDates = logDates.filter((d) => d < current);
        if (prevDates.length > 0) {
            newDate = new Date(prevDates[prevDates.length - 1]);
        }
    } else {
        // Find next date with logs, up to today
        const nextDates = logDates.filter((d) => d > current && d <= today);
        if (nextDates.length > 0) {
            newDate = new Date(nextDates[0]);
        } else if (current < today) {
            newDate = new Date(today);
        }
    }
    return newDate;
}

async function renderReportCalendar() {
    renderCalendar(ID_REPORT_CALENDAR_CONTAINER, reportSelectedDate, (date) => {
        reportSelectedDate = new Date(date);
        updateReportUI();
    });
}

async function renderTagAggregationCalendar() {
    renderCalendar(ID_TAG_AGGREGATION_CALENDAR_CONTAINER, tagAggregationSelectedDate, (date) => {
        tagAggregationSelectedDate = new Date(date);
        updateTagAggregationUI();
    });
}

function renderCalendar(containerId, selectedDate, onSelect) {
    const container = getEl(containerId);
    container.replaceChildren();

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const table = createEl('table');
    table.className = 'calendar-table';

    // Header
    const days = t('day-names');
    const headerRow = createEl('tr');
    days.forEach((day) => {
        const th = createEl('th');
        th.textContent = day;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    let date = 1;
    for (let i = 0; i < 6; i++) {
        const row = createEl('tr');
        for (let j = 0; j < 7; j++) {
            const td = createEl('td');
            if (i === 0 && j < firstDay) {
                // Empty
            } else if (date > lastDate) {
                // Empty
            } else {
                const currentDate = new Date(year, month, date).setHours(0, 0, 0, 0);
                td.textContent = date;
                if (reportLogDates.has(currentDate)) {
                    td.classList.add('has-logs');
                }
                if (currentDate === selectedDate.getTime()) {
                    td.classList.add('selected');
                }
                if (currentDate === new Date().setHours(0, 0, 0, 0)) {
                    td.classList.add('today');
                }

                td.onclick = (e) => {
                    e.stopPropagation();
                    onSelect(currentDate);
                    container.classList.add('hidden');
                };
                date++;
            }
            row.appendChild(td);
        }
        table.appendChild(row);
        if (date > lastDate) break;
    }

    container.appendChild(table);
}

async function updateTagAggregationUI() {
    const d = tagAggregationSelectedDate;
    const days = t('day-names');
    const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
    getEl(ID_TAG_AGGREGATION_DATE_TEXT).textContent = dateStr;

    const startOfDay = d.getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
    const dayLogs = (await dbGetLogsByTimeRange(startOfDay, endOfDay)).filter((l) => l.endTime);

    const { tagAgg, noTagDuration, totalWorkDuration } = calculateTagAggregation(dayLogs);

    const table = getEl(ID_TAG_AGGREGATION_TABLE);
    table.replaceChildren();

    const sortedTags = Object.keys(tagAgg).sort((a, b) => a.localeCompare(b));

    if (dayLogs.length === 0) {
        const row = createEl('tr');
        const cell = createEl('td');
        cell.textContent = t('no-logs-for-day');
        cell.colSpan = 3;
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        table.appendChild(row);
        return;
    }

    const appendAggregationRow = (label, ms) => {
        const row = createEl('tr');

        const nameCell = createEl('td');
        nameCell.className = 'tag-name-cell';
        nameCell.textContent = label;
        nameCell.title = label;
        row.appendChild(nameCell);

        const durCell = createEl('td');
        durCell.className = 'tag-duration-cell';
        const totalMinutes = Math.round(ms / 60000);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        durCell.textContent = `${h}:${String(m).padStart(2, '0')}`;
        row.appendChild(durCell);

        const copyCell = createEl('td');
        copyCell.className = 'tag-copy-cell';
        const copyBtn = createEl('button');
        copyBtn.className = 'tag-copy-btn material-symbols-outlined';
        copyBtn.textContent = 'content_paste';
        copyBtn.title = t('btn-copy');
        copyBtn.onclick = () => {
            const text = durCell.textContent;
            navigator.clipboard.writeText(text);
            showToast(t('toast-copied'));
        };
        copyCell.appendChild(copyBtn);
        row.appendChild(copyCell);

        table.appendChild(row);
    };

    // 1. Tag rows
    sortedTags.forEach((tag) => {
        appendAggregationRow(tag, tagAgg[tag]);
    });

    // 2. Special row: (No Tags)
    appendAggregationRow(t('no-tags'), noTagDuration);

    // 3. Special row: Total Work Time
    appendAggregationRow(t('total-work-time'), totalWorkDuration);
}

function showToast(message = t('toast-done')) {
    const toast = getEl(ID_TOAST);
    if (toast) {
        toast.innerText = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), TOAST_DURATION_MS);
    }
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = getEl(ID_CONFIRM_MODAL);
        const msgEl = getEl(ID_CONFIRM_MESSAGE);
        const okBtn = getEl(ID_CONFIRM_OK_BTN);
        const cancelBtn = getEl(ID_CONFIRM_CANCEL_BTN);

        if (!modal || !msgEl || !okBtn || !cancelBtn) {
            resolve(confirm(message));
            return;
        }

        msgEl.innerText = message;
        modal.classList.remove('hidden');

        const cleanup = (result) => {
            modal.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        };

        okBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
    });
}

/**
 * Shows a multi-choice modal.
 * @param {string} message
 * @param {Array<{label: string, value: any, class?: string}>} choices
 * @returns {Promise<any>}
 */
function showMultiChoice(message, choices) {
    return new Promise((resolve) => {
        const modal = getEl('multi-choice-modal');
        const msgEl = getEl('multi-choice-message');
        const container = getEl('multi-choice-btn-container');

        if (!modal || !msgEl || !container) {
            // Fallback: use simple confirm or alert
            console.warn('Multi-choice modal not found, falling back');
            resolve(choices[0].value);
            return;
        }

        msgEl.innerText = message;
        container.replaceChildren();

        choices.forEach((choice) => {
            const btn = createEl('button');
            btn.textContent = choice.label;
            if (choice.class) btn.className = choice.class;
            btn.onclick = () => {
                modal.classList.add('hidden');
                resolve(choice.value);
            };
            container.appendChild(btn);
        });

        modal.classList.remove('hidden');
    });
}

/**
 * Shows the sync setup modal and waits for user choice.
 * @returns {Promise<{settingsMode: string, historyMode: string}|null>}
 */
function showSyncSetupModal() {
    return new Promise((resolve) => {
        const modal = getEl('sync-setup-modal');
        const okBtn = getEl('sync-setup-ok-btn');
        const cancelBtn = getEl('sync-setup-cancel-btn');
        const settingsRadios = document.querySelectorAll('input[name="settings-sync-mode"]');
        const historyRadios = document.querySelectorAll('input[name="history-sync-mode"]');

        if (!modal || !okBtn || !cancelBtn) {
            resolve(null);
            return;
        }

        // Reset state
        settingsRadios.forEach((r) => (r.checked = false));
        historyRadios.forEach((r) => (r.checked = false));
        okBtn.disabled = true;

        const updateOkButton = () => {
            const settingsSelected = [...settingsRadios].some((r) => r.checked);
            const historySelected = [...historyRadios].some((r) => r.checked);
            okBtn.disabled = !(settingsSelected && historySelected);
        };

        settingsRadios.forEach((r) => (r.onchange = updateOkButton));
        historyRadios.forEach((r) => (r.onchange = updateOkButton));

        okBtn.onclick = () => {
            const settingsMode = [...settingsRadios].find((r) => r.checked)?.value;
            const historyMode = [...historyRadios].find((r) => r.checked)?.value;
            modal.classList.add('hidden');
            resolve({ settingsMode, historyMode });
        };

        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve(null);
        };

        modal.classList.remove('hidden');
    });
}

// --- Alarms ---

/**
 * Shared helper to construct launch URLs for local/remote subprojects.
 *
 * @param {string} extensionPath - Path inside Chrome Extension.
 * @param {string} webPath - Relative/absolute path on standard web.
 * @param {Record<string, string>} params - Query parameters to append.
 * @returns {string} The constructed project URL.
 */
function getLaunchProjectUrl(extensionPath, webPath, params) {
    const isExtension = window.location.protocol === 'chrome-extension:';
    let baseUrl = isExtension ? chrome.runtime.getURL(extensionPath) : webPath;

    // For local development or testing on web, resolve absolute production URLs to local relative paths
    if (!isExtension && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        if (webPath.startsWith('https://quick-log-solo.vercel.app/')) {
            baseUrl = webPath.replace('https://quick-log-solo.vercel.app/', '../');
        }
    }

    const urlObj = new URL(baseUrl, window.location.href);
    for (const [key, value] of Object.entries(params)) {
        urlObj.searchParams.set(key, value);
    }
    return urlObj.toString();
}

/**
 * Helper to launch or focus an existing editor tab.
 * @param {string} localPath - Path inside Chrome Extension.
 * @param {string} fallbackUrl - Relative/absolute path on standard web.
 * @param {Record<string, string>} params - Query parameters to append.
 * @param {string} windowName - Target window name for non-extension duplicate prevention.
 */
async function launchOrFocusTab(localPath, fallbackUrl, params, windowName) {
    const isExtension = window.location.protocol === 'chrome-extension:';
    const url = getLaunchProjectUrl(localPath, fallbackUrl, params);

    if (isExtension && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        const extensionUrlBase = chrome.runtime.getURL(localPath);
        const queryUrlPattern = `${extensionUrlBase}*`;

        try {
            const tabs = await new Promise((resolve) => {
                chrome.tabs.query({ url: queryUrlPattern }, resolve);
            });

            if (tabs && tabs.length > 0) {
                const tab = tabs[0];
                chrome.tabs.update(tab.id, { active: true });
                if (tab.windowId) {
                    chrome.windows.update(tab.windowId, { focused: true });
                }
                return;
            }
        } catch (error) {
            console.error('Failed to query or update existing tab:', error);
        }
    }

    if (windowName && windowName !== '_blank') {
        const win = window.open('', windowName);
        if (win) {
            try {
                // Try to read the window's location to determine if it's blank or already navigated
                const href = win.location.href;
                if (href && href !== 'about:blank') {
                    // Window exists and has navigated to a URL - just focus it
                    win.focus();
                    return;
                } else {
                    // Window exists but is blank - navigate it to the target URL
                    win.location.replace(url);
                    win.focus();
                    return;
                }
            } catch (error) {
                // SecurityError means the window navigated to a cross-origin URL (not blank)
                // Just focus the existing window without navigating it
                if (error.name === 'SecurityError') {
                    try {
                        win.focus();
                    } catch (focusError) {
                        console.warn('Failed to focus existing cross-origin window:', focusError);
                    }
                    return;
                } else {
                    // Unexpected error - log and fall through to fallback
                    console.warn('Unexpected error checking window location:', error);
                }
            }
        }
        // Fallback: win is null/undefined (popup blocked or window couldn't be obtained)
        window.open(url, windowName);
    } else {
        window.open(url, '_blank', 'noopener');
    }
}

/**
 * Helper to launch editor with standard parameters (language, theme, from: 'app').
 * @param {string} localPath - Path inside Chrome Extension.
 * @param {string} fallbackUrl - Relative/absolute path on standard web.
 * @param {string} windowName - Target window name.
 */
function launchEditor(localPath, fallbackUrl, windowName) {
    const lang = getLanguage();
    const resolvedTheme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    const params = {
        lang,
        theme: resolvedTheme,
        from: 'app',
    };
    launchOrFocusTab(localPath, fallbackUrl, params, windowName);
}

async function renderBusinessDays() {
    const container = getEl(ID_BUSINESS_DAYS_CONTAINER);
    if (!container) return;

    const state = await getCurrentAppState();
    const businessDays = state.businessDays || [1, 2, 3, 4, 5];

    container.replaceChildren();

    const currentLang = getLanguage();
    const formatter = new Intl.DateTimeFormat(currentLang === 'auto' ? undefined : currentLang, { weekday: 'narrow' });

    // 0: Sun, 1: Mon, ..., 6: Sat
    // To display Sun-Sat, use [0, 1, 2, 3, 4, 5, 6]
    [0, 1, 2, 3, 4, 5, 6].forEach((day) => {
        // Let's use a known date: 2024-01-07 is Sunday
        const d = new Date(2024, 0, 7 + day);
        const label = formatter.format(d);

        const chip = createEl('button');
        chip.className = 'filter-chip' + (businessDays.includes(day) ? ' active' : '');
        if (day === 0) chip.classList.add('sunday');
        if (day === 6) chip.classList.add('saturday');
        chip.textContent = label;
        chip.disabled = true;
        chip.setAttribute('aria-disabled', 'true');
        const isActive = businessDays.includes(day);
        chip.setAttribute('aria-label', `${label} (${isActive ? 'active' : 'inactive'})`);
        chip.style.cursor = 'default';
        container.appendChild(chip);
    });

    // Check if the edit button is already added. If not, add it right after the container.
    let editBtn = getEl('business-days-edit-btn');
    if (!editBtn) {
        editBtn = createEl('button');
        editBtn.id = 'business-days-edit-btn';
        editBtn.className = 'icon-btn';
        editBtn.title = t('tooltip-edit-business-days');
        editBtn.setAttribute('data-i18n-title', 'tooltip-edit-business-days');
        editBtn.style.verticalAlign = 'middle';

        const editIcon = createEl('span');
        editIcon.className = 'material-symbols-outlined';
        editIcon.textContent = 'edit';
        editBtn.appendChild(editIcon);

        editBtn.onclick = () => {
            launchEditor('projects/alarm-editor/index.html', ALARM_EDITOR_URL, 'quicklog_alarm_editor');
        };

        const parent = container.parentElement;
        if (parent) {
            let wrapper = parent.querySelector('.business-days-wrapper');
            if (!wrapper) {
                wrapper = createEl('div');
                wrapper.className = 'business-days-wrapper';
                wrapper.style.display = 'flex';
                wrapper.style.alignItems = 'center';
                wrapper.style.gap = '8px';

                // insert wrapper before container
                parent.insertBefore(wrapper, container);
                wrapper.appendChild(container);
            }
            wrapper.appendChild(editBtn);
        }
    } else {
        editBtn.title = t('tooltip-edit-business-days');
        editBtn.setAttribute('data-i18n-title', 'tooltip-edit-business-days');
    }
}

async function renderAlarmList() {
    const list = getEl(ID_ALARM_LIST);
    if (!list) return;

    const extensionOnlyNotice = getEl('alarm-extension-notice');
    if (extensionOnlyNotice) {
        if (typeof chrome !== 'undefined' && chrome.alarms) {
            extensionOnlyNotice.classList.add('hidden');
        } else {
            extensionOnlyNotice.classList.remove('hidden');
        }
    }

    const alarms = await dbGetAll(STORE_ALARMS);
    alarms.sort((a, b) => (a.order ?? a.id ?? 0) - (b.order ?? b.id ?? 0));

    const activeEl = document.activeElement;
    if (activeEl && list.contains(activeEl) && !activeEl.classList.contains('alarm-enabled')) {
        return;
    }

    list.replaceChildren();

    alarms.forEach((alarm) => {
        const item = createEl('div');
        item.className = 'alarm-item';

        // Row 1: Enabled, Time, Confirmation
        const row1 = createEl('div');
        row1.className = 'alarm-row';

        const enabledLabel = createEl('label');
        enabledLabel.className = 'alarm-enabled-label';
        const enabledCheck = createEl('input');
        enabledCheck.type = 'checkbox';
        enabledCheck.className = 'alarm-enabled';
        enabledCheck.checked = alarm.enabled;
        const enabledText = createEl('span');
        enabledText.setAttribute('data-i18n', 'alarm-label-enabled');
        enabledText.textContent = t('alarm-label-enabled');
        enabledLabel.appendChild(enabledCheck);
        enabledLabel.appendChild(enabledText);

        const timeText = createEl('span');
        timeText.className = 'alarm-field-value alarm-time';
        timeText.textContent = alarm.time || '09:00';
        timeText.style.cursor = 'default';
        timeText.style.fontWeight = 'bold';
        timeText.style.fontSize = '1.1rem';

        const confirmIcon = createEl('span');
        confirmIcon.className = 'material-symbols-outlined';
        confirmIcon.textContent = 'task_alt';

        const confirmValue = createEl('span');
        confirmValue.className = 'alarm-field-value alarm-confirm';
        confirmValue.style.cursor = 'default';
        if (alarm.requireConfirmation) {
            confirmValue.appendChild(confirmIcon);
        } else {
            confirmValue.textContent = '-';
        }

        row1.appendChild(enabledLabel);
        row1.appendChild(timeText);
        row1.appendChild(confirmValue);

        // Row 2: Type Selection
        const rowType = createEl('div');
        rowType.className = 'alarm-row';
        const typeLabel = createEl('span');
        typeLabel.className = 'alarm-label';
        typeLabel.setAttribute('data-i18n', 'alarm-label-type');
        typeLabel.textContent = t('alarm-label-type');
        const typeText = createEl('span');
        typeText.className = 'alarm-field-value alarm-type';
        typeText.textContent = t(`alarm-type-${alarm.type || 'daily'}`);
        typeText.style.cursor = 'default';
        rowType.appendChild(typeLabel);
        rowType.appendChild(typeText);

        // Row Weekly: Days Selection
        const rowWeekly = createEl('div');
        rowWeekly.className = 'alarm-row' + (alarm.type !== 'weekly' ? ' hidden' : '');
        const weeklyLabel = createEl('span');
        weeklyLabel.className = 'alarm-label';
        weeklyLabel.setAttribute('data-i18n', 'tab-alarms');
        weeklyLabel.textContent = t('tab-alarms');
        const weeklyContainer = createEl('div');
        weeklyContainer.className = 'filter-chips';
        const currentLang = getLanguage();
        const formatter = new Intl.DateTimeFormat(currentLang === 'auto' ? undefined : currentLang, {
            weekday: 'narrow',
        });
        [0, 1, 2, 3, 4, 5, 6].forEach((day) => {
            const d = new Date(2024, 0, 7 + day);
            const chip = createEl('button');
            chip.className = 'filter-chip' + ((alarm.daysOfWeek || []).includes(day) ? ' active' : '');
            if (day === 0) chip.classList.add('sunday');
            if (day === 6) chip.classList.add('saturday');
            const label = formatter.format(d);
            chip.textContent = label;
            chip.disabled = true;
            chip.setAttribute('aria-disabled', 'true');
            const isActive = (alarm.daysOfWeek || []).includes(day);
            chip.setAttribute('aria-label', `${label} (${isActive ? 'active' : 'inactive'})`);
            chip.style.cursor = 'default';
            weeklyContainer.appendChild(chip);
        });
        rowWeekly.appendChild(weeklyLabel);
        rowWeekly.appendChild(weeklyContainer);

        // Row Monthly Date
        const rowMonthlyDate = createEl('div');
        rowMonthlyDate.className = 'alarm-row' + (alarm.type !== 'monthly_date' ? ' hidden' : '');
        const mDateLabel = createEl('span');
        mDateLabel.className = 'alarm-label';
        mDateLabel.setAttribute('data-i18n', 'label-day');
        mDateLabel.textContent = t('label-day');
        const mDateText = createEl('span');
        mDateText.className = 'alarm-field-value alarm-day-of-month';
        mDateText.textContent = alarm.dayOfMonth || 1;
        mDateText.style.cursor = 'default';
        rowMonthlyDate.appendChild(mDateLabel);
        rowMonthlyDate.appendChild(mDateText);

        // Row Monthly End
        const rowMonthlyEnd = createEl('div');
        rowMonthlyEnd.className = 'alarm-row' + (alarm.type !== 'monthly_end_relative' ? ' hidden' : '');
        const mEndPreLabel = createEl('span');
        mEndPreLabel.className = 'alarm-label';
        mEndPreLabel.setAttribute('data-i18n', 'label-before-end-1');
        mEndPreLabel.textContent = t('label-before-end-1');
        const mEndText = createEl('span');
        mEndText.className = 'alarm-field-value alarm-days-before-end';
        mEndText.textContent = alarm.daysBeforeEnd || 0;
        mEndText.style.cursor = 'default';
        const mEndPostLabel = createEl('span');
        mEndPostLabel.setAttribute('data-i18n', 'label-before-end-2');
        mEndPostLabel.textContent = t('label-before-end-2');
        rowMonthlyEnd.appendChild(mEndPreLabel);
        rowMonthlyEnd.appendChild(mEndText);
        rowMonthlyEnd.appendChild(mEndPostLabel);

        // Row Holiday Adjustment
        const rowHoliday = createEl('div');
        rowHoliday.className = 'alarm-row' + (alarm.type === 'none' ? ' hidden' : '');
        const holidayLabel = createEl('span');
        holidayLabel.className = 'alarm-label';
        holidayLabel.setAttribute('data-i18n', 'alarm-label-holiday-adjustment');
        holidayLabel.textContent = t('alarm-label-holiday-adjustment');
        const holidayText = createEl('span');
        holidayText.className = 'alarm-field-value alarm-holiday-adj';
        holidayText.textContent = t(`alarm-adj-${alarm.holidayAdjustment || 'none'}`);
        holidayText.style.cursor = 'default';
        rowHoliday.appendChild(holidayLabel);
        rowHoliday.appendChild(holidayText);

        // Row Message
        const rowMsg = createEl('div');
        rowMsg.className = 'alarm-row';
        const msgLabel = createEl('span');
        msgLabel.className = 'alarm-label';
        msgLabel.setAttribute('data-i18n', 'alarm-label-message');
        msgLabel.textContent = t('alarm-label-message');
        const msgText = createEl('span');
        msgText.className = 'alarm-field-value alarm-message';
        msgText.textContent = alarm.message || '';
        msgText.style.cursor = 'default';
        rowMsg.appendChild(msgLabel);
        rowMsg.appendChild(msgText);

        // Row Action
        const rowAction = createEl('div');
        rowAction.className = 'alarm-row';
        const actionLabel = createEl('span');
        actionLabel.className = 'alarm-label';
        actionLabel.setAttribute('data-i18n', 'alarm-label-action');
        actionLabel.textContent = t('alarm-label-action');
        const actionText = createEl('span');
        actionText.className = 'alarm-field-value alarm-action';
        actionText.textContent = t(`alarm-action-${alarm.action || 'none'}`);
        actionText.style.cursor = 'default';
        rowAction.appendChild(actionLabel);
        rowAction.appendChild(actionText);

        // Row Category
        const rowCategory = createEl('div');
        rowCategory.className = 'alarm-row' + (alarm.action !== 'start' ? ' hidden' : '');
        const catLabel = createEl('span');
        catLabel.className = 'alarm-label';
        catLabel.setAttribute('data-i18n', 'alarm-label-action-category');
        catLabel.textContent = t('alarm-label-action-category');
        const catText = createEl('span');
        catText.className = 'alarm-field-value alarm-category';
        catText.textContent = alarm.actionCategory || '';
        catText.style.cursor = 'default';
        rowCategory.appendChild(catLabel);
        rowCategory.appendChild(catText);

        item.appendChild(row1);
        item.appendChild(rowType);
        item.appendChild(rowWeekly);
        item.appendChild(rowMonthlyDate);
        item.appendChild(rowMonthlyEnd);
        item.appendChild(rowHoliday);
        item.appendChild(rowMsg);
        item.appendChild(rowAction);
        item.appendChild(rowCategory);

        enabledCheck.onchange = async () => {
            alarm.enabled = enabledCheck.checked;
            await dbPut(STORE_ALARMS, alarm);
            broadcastSync('alarms-updated');
        };

        list.appendChild(item);
    });
}

// --- Category Editor ---

function getColorCode(color) {
    // These are fallback codes for the editor, matching the refined palette in css/m3-theme.css.
    const codes = {
        primary: '#1976d2',
        secondary: '#7cb342',
        tertiary: '#8e24aa',
        error: '#d32f2f',
        neutral: '#546e7a',
        outline: '#9e9e9e',
        teal: '#0097a7',
        green: '#388e3c',
        yellow: '#fbc02d',
        orange: '#ffa000',
        pink: '#d81b60',
        indigo: '#5e35b1',
        brown: '#6d4c41',
        cyan: '#039be5',
        'retro-lcd': '#9bbc0f',
        'retro-crt': '#33ff33',
        'retro-nixie': '#ff5500',
    };
    return codes[color] || '#1976d2';
}

async function updateBackupUI() {
    const hasHandle = !!backupManager.directoryHandle;

    const dirNameEl = getEl('backup-directory-name');
    if (dirNameEl) {
        dirNameEl.textContent = backupManager.directoryHandle
            ? backupManager.directoryHandle.name
            : t('backup-not-selected');
    }

    const lastTimeDisplay = getEl(ID_BACKUP_LAST_TIME_DISPLAY);
    if (lastTimeDisplay) {
        const config = backupManager.config;
        lastTimeDisplay.textContent = config.lastBackupTime ? new Date(config.lastBackupTime).toLocaleString() : '-';
    }

    const statusIndicator = getEl(ID_BACKUP_STATUS_INDICATOR);
    if (statusIndicator) {
        if (backupManager.status === 'success') {
            statusIndicator.textContent = t('backup-status-success');
        } else if (backupManager.status === 'failed') {
            statusIndicator.textContent = t('backup-status-failed');
        } else if (backupManager.status === 'syncing') {
            statusIndicator.textContent = t('backup-status-syncing');
        } else {
            statusIndicator.textContent = '';
        }
    }

    const executeBtn = getEl(ID_BACKUP_EXECUTE_BTN);
    if (executeBtn) {
        executeBtn.disabled = !hasHandle || backupManager.isSyncing;
    }

    const changeDirBtn = getEl(ID_BACKUP_CHANGE_DIR_BTN);
    if (changeDirBtn) {
        changeDirBtn.disabled = backupManager.isSyncing;
    }

    const restoreBtn = getEl('restore-configured-btn');
    if (restoreBtn) {
        restoreBtn.disabled = !hasHandle || backupManager.isSyncing;
    }

    backupManager.getFileCount().then((count) => {
        const fileCountDisplay = getEl(ID_BACKUP_FILE_COUNT_DISPLAY);
        if (fileCountDisplay) {
            fileCountDisplay.textContent = `${count} ${t('backup-file-count-unit')}`;
        }
    });
}

async function renderCategoryList() {
    const makerExtensionNotice = getEl('maker-extension-notice');
    const launchMakerBtn = getEl('launch-maker-btn');
    if (makerExtensionNotice) {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            makerExtensionNotice.classList.add('hidden');
            if (launchMakerBtn) {
                launchMakerBtn.disabled = false;
                launchMakerBtn.style.opacity = '1';
                launchMakerBtn.style.pointerEvents = 'auto';
            }
        } else {
            makerExtensionNotice.classList.remove('hidden');
            if (launchMakerBtn) {
                launchMakerBtn.disabled = true;
                launchMakerBtn.style.opacity = '0.5';
                launchMakerBtn.style.pointerEvents = 'none';
            }
        }
    }

    const list = getEl(ID_CATEGORY_EDITOR_LIST);
    if (!list) return;
    let categories = await dbGetAll(STORE_CATEGORIES);
    categories = categories
        .filter((c) => c.name !== SYSTEM_CATEGORY_IDLE)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    list.replaceChildren();

    const lang = getLanguage();
    const customAnims = await getCustomAnimationMetadataMap();

    categories.forEach((cat) => {
        const item = createEl('div');
        const isPageBreak = (cat.name || '').startsWith(SYSTEM_CATEGORY_PAGE_BREAK);
        item.className = 'category-editor-item category-readonly-item' + (isPageBreak ? ' page-break-item' : '');
        item.style.cursor = 'default';
        item.dataset.id = cat.id;

        if (isPageBreak) {
            const row = createEl('div');
            row.className = 'cat-editor-row row-1';

            const pbLabel = createEl('span');
            pbLabel.className = 'page-break-label';
            const pbIcon = createEl('span');
            pbIcon.className = 'material-symbols-outlined';
            pbIcon.style.verticalAlign = 'middle';
            pbIcon.style.marginRight = '4px';
            pbIcon.textContent = 'insert_page_break';
            const pbText = createEl('span');
            pbText.style.verticalAlign = 'middle';
            pbText.textContent = t('page-break');
            pbLabel.appendChild(pbIcon);
            pbLabel.appendChild(pbText);
            row.appendChild(pbLabel);
            item.appendChild(row);
        } else {
            // Row 1: Color swatch + Name
            const row1 = createEl('div');
            row1.className = 'cat-editor-row row-1';
            row1.style.display = 'flex';
            row1.style.alignItems = 'center';
            row1.style.gap = '8px';

            const swatch = createEl('span');
            swatch.className = 'category-readonly-swatch';
            swatch.style.backgroundColor = getColorCode(cat.color);

            const retroMap = { 'retro-lcd': 'L', 'retro-crt': 'C', 'retro-nixie': 'N' };
            const retroTextColor = { 'retro-lcd': '#0f380f', 'retro-crt': '#030c04', 'retro-nixie': '#1a0800' };
            if (retroMap[cat.color]) {
                swatch.textContent = retroMap[cat.color];
                swatch.style.color = retroTextColor[cat.color];
            }

            const nameSpan = createEl('span');
            nameSpan.className = 'category-readonly-name';
            nameSpan.textContent = cat.name;

            row1.appendChild(swatch);
            row1.appendChild(nameSpan);

            // Row 2: Tags
            const tagsRow = createEl('div');
            tagsRow.className = 'cat-detail-row row-2';
            tagsRow.style.paddingLeft = '32px'; // Swatch 24px + gap 8px

            const tagIcon = createEl('span');
            tagIcon.className = 'material-symbols-outlined';
            tagIcon.textContent = 'sell';

            const tagValue = createEl('span');
            tagValue.className = 'category-readonly-detail-value';
            const tagStr = cat.tags || '';
            const tagList = tagStr
                ? tagStr
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .join(', ')
                : '';
            tagValue.textContent = tagList;

            tagsRow.appendChild(tagIcon);
            tagsRow.appendChild(tagValue);

            // Row 3: Animation
            const animRow = createEl('div');
            animRow.className = 'cat-detail-row row-3';
            animRow.style.paddingLeft = '32px'; // Swatch 24px + gap 8px

            const animIcon = createEl('span');
            animIcon.className = 'material-symbols-outlined';
            animIcon.textContent = 'animation';

            const animValue = createEl('span');
            animValue.className = 'category-readonly-detail-value';

            const anim = cat.animation || 'none';
            if (anim === 'none') {
                animValue.textContent = t('anim-none');
            } else if (anim === 'default') {
                animValue.textContent = t('anim-default');
            } else {
                const stdAnim = animations.find((a) => a.id === anim);
                if (stdAnim) {
                    if (typeof stdAnim.metadata.name === 'object') {
                        animValue.textContent =
                            stdAnim.metadata.name[lang] || stdAnim.metadata.name['en'] || stdAnim.id;
                    } else {
                        animValue.textContent = stdAnim.metadata.name;
                    }
                } else if (customAnims[anim]) {
                    animValue.textContent = customAnims[anim].name;
                } else {
                    animValue.textContent = anim;
                }
            }

            animRow.appendChild(animIcon);
            animRow.appendChild(animValue);

            item.appendChild(row1);
            item.appendChild(tagsRow);
            item.appendChild(animRow);
        }

        list.appendChild(item);
    });
}

// --- Initialization & Event Listeners ---

async function loadVersion() {
    try {
        const response = await fetch('version.json');
        const data = await response.json();
        const el = getEl(ID_VERSION_DISPLAY);
        if (el) el.textContent = `v${data.version}`;
    } catch (e) {
        console.error('Failed to load version:', e);
    }
}

async function renderCustomAnimationsTab() {
    const select = getEl('custom-anim-select');
    if (!select) return;

    const customAnims = await getCustomAnimationMetadataMap();

    select.replaceChildren();

    const keys = Object.keys(customAnims);
    if (keys.length === 0) {
        const opt = createEl('option');
        opt.value = '';
        opt.textContent = t('anim-none');
        select.appendChild(opt);
        getEl('custom-anim-name').textContent = '-';
        getEl('custom-anim-desc').textContent = '-';
        return;
    }

    keys.forEach((id) => {
        const opt = createEl('option');
        opt.value = id;
        opt.textContent = customAnims[id].name;
        select.appendChild(opt);
    });

    const selectedId = select.value;
    if (selectedId && customAnims[selectedId]) {
        getEl('custom-anim-name').textContent = customAnims[selectedId].name;
        getEl('custom-anim-desc').textContent = customAnims[selectedId].description || '-';
    } else {
        getEl('custom-anim-name').textContent = '-';
        getEl('custom-anim-desc').textContent = '-';
    }
}

async function importCustomAnimation(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        throw new Error('Invalid JSON', { cause: err });
    }

    if (data.format !== 'quicklog-animation-package') {
        throw new Error('Invalid format');
    }

    const { id, metadata, config, payload } = data;
    if (!metadata || !metadata.name || !payload || !payload.imageData || !payload.renderSpec) {
        throw new Error('Missing fields');
    }

    const custom_animation_metadata_map = await getCustomAnimationMetadataMap();

    const finalId = !id || custom_animation_metadata_map[id] ? generateUUID() : id;

    const byteString = atob(payload.imageData.split(',')[1]);
    const mimeString = payload.imageData.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });

    await saveAnimationBlob(finalId, blob, payload.renderSpec, config || { exclusionStrategy: 'freedom' });

    // Resolve name duplicate by appending sequence numbering (1), (2), etc.
    let finalName = metadata.name || 'My Animation';
    const existingNames = new Set(Object.values(custom_animation_metadata_map).map((item) => item.name));
    if (existingNames.has(finalName)) {
        let suffix = 1;
        let candidateName = `${finalName} (${suffix})`;
        while (existingNames.has(candidateName)) {
            suffix++;
            candidateName = `${finalName} (${suffix})`;
        }
        finalName = candidateName;
    }

    custom_animation_metadata_map[finalId] = {
        name: finalName,
        description: metadata.description || '',
        config: config || { exclusionStrategy: 'freedom' },
        payload: {
            renderSpec: payload.renderSpec,
        },
    };

    await setCustomAnimationMetadataMap(custom_animation_metadata_map);

    showToast(t('toast-custom-anim-imported') || 'Imported!');

    await renderCustomAnimationsTab();
    await updateAnimationSelect();
    await renderCategoryList();
    await updateUI();
    broadcastSync();
}
window.importCustomAnimation = importCustomAnimation;

function setupEventListeners() {
    getEl(ID_PAUSE_BTN)?.addEventListener('click', () => {
        if (!activeTask) return;
        if (activeTask.category === SYSTEM_CATEGORY_IDLE) {
            startTask(activeTask.resumableCategory);
        } else {
            pauseTask();
        }
    });
    getEl(ID_END_BTN)?.addEventListener('click', endTask);
    getEl(ID_COPY_REPORT_BTN)?.addEventListener('click', openReportModal);
    getEl(ID_COPY_AGGREGATION_BTN)?.addEventListener('click', openTagAggregationModal);

    // Category Wheel Pagination
    const categorySection = getEl(ID_CATEGORY_SECTION);
    categorySection?.addEventListener(
        'wheel',
        (e) => {
            e.preventDefault();
            dbGetAll(STORE_CATEGORIES).then((categories) => {
                const pages = splitCategoriesIntoPages(categories);
                const totalPages = pages.length;
                if (e.deltaY > 0) {
                    // Scroll down -> next page
                    if (currentCategoryPage < totalPages - 1) {
                        currentCategoryPage++;
                        renderCategories();
                    }
                } else {
                    // Scroll up -> prev page
                    if (currentCategoryPage > 0) {
                        currentCategoryPage--;
                        renderCategories();
                    }
                }
            });
        },
        { passive: false }
    );

    // Modals
    const popups = {
        settings: getEl(ID_SETTINGS_POPUP),
        report: getEl(ID_REPORT_MODAL),
        tagAggregation: getEl(ID_TAG_AGGREGATION_MODAL),
        multiChoice: getEl('multi-choice-modal'),
        syncSetup: getEl('sync-setup-modal'),
        historyAction: getEl('history-action-modal'),
        historyEdit: getEl('history-edit-modal'),
    };

    getEl(ID_SETTINGS_TOGGLE)?.addEventListener('click', async () => {
        popups.settings?.classList.remove('hidden');
        try {
            await updateAnimationSelect();
            await renderCategoryList();
        } catch (err) {
            console.error('Failed to update settings UI:', err);
            showToast(t('alert-error') || 'Operation failed');
        }
    });

    queryAll(
        '.settings-close-btn, .report-close-btn, .tag-aggregation-close-btn, .history-action-close-btn, .history-edit-close-btn'
    ).forEach((btn) => {
        btn.onclick = (e) => {
            e.stopPropagation(); // Avoid triggering window.onclick
            Object.values(popups).forEach((p) => p?.classList.add('hidden'));
        };
    });

    window.onclick = (event) => {
        Object.values(popups).forEach((p) => {
            if (event.target === p) p.classList.add('hidden');
        });
        // Close custom dropdowns when clicking outside
        if (!event.target.closest('.custom-color-dropdown')) {
            queryAll('.color-dropdown-menu').forEach((m) => m.classList.add('hidden'));
        }
        if (!event.target.closest('#report-date-display-box')) {
            getEl(ID_REPORT_CALENDAR_CONTAINER)?.classList.add('hidden');
        }
        if (!event.target.closest('#tag-aggregation-date-display-box')) {
            getEl(ID_TAG_AGGREGATION_CALENDAR_CONTAINER)?.classList.add('hidden');
        }
    };

    // Report Modal events
    getEl(ID_REPORT_DATE_PREV)?.addEventListener('click', () => moveReportDate(-1));
    getEl(ID_REPORT_DATE_NEXT)?.addEventListener('click', () => moveReportDate(1));
    getEl(ID_REPORT_DATE_DISPLAY)?.addEventListener('click', (e) => {
        e.stopPropagation();
        const container = getEl(ID_REPORT_CALENDAR_CONTAINER);
        if (container.classList.contains('hidden')) {
            renderReportCalendar();
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    });

    getEl(ID_REPORT_DATE_DISPLAY)?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveReportDate(-1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveReportDate(1);
        }
    });

    // Tag Aggregation Modal events
    getEl(ID_TAG_AGGREGATION_DATE_PREV)?.addEventListener('click', () => moveTagAggregationDate(-1));
    getEl(ID_TAG_AGGREGATION_DATE_NEXT)?.addEventListener('click', () => moveTagAggregationDate(1));
    getEl(ID_TAG_AGGREGATION_DATE_DISPLAY)?.addEventListener('click', (e) => {
        e.stopPropagation();
        const container = getEl(ID_TAG_AGGREGATION_CALENDAR_CONTAINER);
        if (container.classList.contains('hidden')) {
            renderTagAggregationCalendar();
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    });

    getEl(ID_TAG_AGGREGATION_DATE_DISPLAY)?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveTagAggregationDate(-1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveTagAggregationDate(1);
        }
    });

    [
        ID_REPORT_FORMAT_SELECT,
        ID_REPORT_EMOJI_SELECT,
        ID_REPORT_ENDTIME_SELECT,
        ID_REPORT_DURATION_SELECT,
        ID_REPORT_ADJUST_SELECT,
    ].forEach((id) => {
        getEl(id)?.addEventListener('change', (e) => {
            const key = e.target.dataset.key || id.replace('report-', '').replace('-select', '');
            reportSettings[key] = e.target.value;

            if (id === ID_REPORT_FORMAT_SELECT) {
                updateDurationSelectOptions(e.target.value);
            }

            updateReportUI();
            saveReportSettings();
        });
    });

    getEl(ID_REPORT_COPY_CONFIRM_BTN)?.addEventListener('click', async () => {
        const text = getEl(ID_REPORT_PREVIEW).textContent;
        if (reportSettings.format === 'html') {
            const htmlType = 'text/html';
            const plainType = 'text/plain';
            const blobHtml = new Blob([text], { type: htmlType });
            const blobPlain = new Blob([text], { type: plainType });
            const data = [
                new ClipboardItem({
                    [htmlType]: blobHtml,
                    [plainType]: blobPlain,
                }),
            ];
            await navigator.clipboard.write(data);
        } else {
            await navigator.clipboard.writeText(text);
        }

        showToast(t('toast-copied'));
    });

    // Tabs
    queryAll('.tab-btn').forEach((btn) => {
        btn.onclick = () => {
            queryAll('.tab-btn').forEach((b) => b.classList.remove('active'));
            queryAll('.tab-content').forEach((c) => c.classList.add('hidden'));

            let tabName = btn.dataset.tab;
            btn.classList.add('active');

            const target = getEl(`${tabName}-tab`);
            if (target) target.classList.remove('hidden');
            if (tabName === 'alarms') {
                renderBusinessDays();
                renderAlarmList();
            }
            if (tabName === 'categories') renderCategoryList();
            if (tabName === 'maintenance') updateBackupUI();
            if (tabName === 'about') {
                updateAboutStats();
            }
        };
    });

    // Backup & Maintenance tab listeners
    const handleBackupChangeDir = async () => {
        if (backupManager.isSyncing) return;
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await backupManager.setDirectory(handle);
            updateBackupUI();
            broadcastSync();
        } catch (err) {
            console.warn('QuickLog-Solo: Directory selection cancelled or failed', err);
        }
    };

    getEl(ID_BACKUP_CHANGE_DIR_BTN)?.addEventListener('click', handleBackupChangeDir);

    getEl(ID_BACKUP_EXECUTE_BTN)?.addEventListener('click', async () => {
        if (!(await backupManager.hasPermission())) {
            const granted = await backupManager.requestPermission();
            if (!granted) return;
        }
        await backupManager.sync();
        updateBackupUI();
        broadcastSync();
    });

    // Delete/Initialize checkbox handler
    const deleteInitCheckboxes = queryAll('#delete-initialize-section input[type="checkbox"]');
    const deleteInitBtn = getEl(ID_DELETE_INITIALIZE_BTN);
    deleteInitCheckboxes.forEach((cb) => {
        cb.addEventListener('change', () => {
            const anyChecked = [...deleteInitCheckboxes].some((c) => c.checked);
            if (deleteInitBtn) deleteInitBtn.disabled = !anyChecked;
        });
    });

    // Delete/Initialize execute handler
    getEl(ID_DELETE_INITIALIZE_BTN)?.addEventListener('click', async () => {
        const checked = [...deleteInitCheckboxes].filter((c) => c.checked);
        if (checked.length === 0) return;

        const itemNameMap = {
            logs: t('maintenance-clear-logs'),
            categories: t('maintenance-clear-categories'),
            settings: t('maintenance-clear-settings'),
            alarms: t('maintenance-clear-alarms'),
            animations: t('maintenance-clear-animations'),
        };

        const selectedItems = checked.map((c) => itemNameMap[c.value] || c.value);
        const confirmMsg = t('confirm-delete-initialize').replace('{items}', selectedItems.join('\n'));

        if (!(await showConfirm(confirmMsg))) return;

        if (activeTask) {
            await stopTask();
            updateUI();
        }

        if (deleteInitBtn) deleteInitBtn.disabled = true;

        try {
            for (const cb of checked) {
                const itemKey = cb.value;
                const itemName = itemNameMap[itemKey] || itemKey;
                try {
                    if (itemKey === 'logs') {
                        await dbClear(STORE_LOGS);
                    } else if (itemKey === 'categories') {
                        await dbClear(STORE_CATEGORIES);
                    } else if (itemKey === 'settings') {
                        await dbClear(STORE_SETTINGS);
                    } else if (itemKey === 'alarms') {
                        await dbClear(STORE_ALARMS);
                    } else if (itemKey === 'animations') {
                        const animDb = await initAnimationDB();
                        await new Promise((resolve, reject) => {
                            const tx = animDb.transaction('blobs', 'readwrite');
                            const store = tx.objectStore('blobs');
                            const request = store.clear();
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                        });
                        await setCustomAnimationMetadataMap({});
                    }
                } catch (err) {
                    console.error(`QuickLog-Solo: Failed to clear ${itemKey}:`, err);
                    showToast(t('maintenance-delete-error').replace('{item}', itemName));
                    return;
                }
            }

            // Reset all checkboxes and disable button
            deleteInitCheckboxes.forEach((c) => {
                c.checked = false;
            });
            if (deleteInitBtn) deleteInitBtn.disabled = true;

            showToast(t('maintenance-delete-success'));
            await updateUI();
            broadcastSync('reload');
        } catch (err) {
            console.error('QuickLog-Solo: Delete/Initialize failed:', err);
            showToast(t('alert-error') || 'Operation failed');
        } finally {
            // Re-evaluate button state based on current checkbox selection
            if (deleteInitBtn) {
                const anyChecked = [...deleteInitCheckboxes].some((c) => c.checked);
                deleteInitBtn.disabled = !anyChecked;
            }
        }
    });

    // Status update callback
    backupManager.onStatusChange = () => {
        updateBackupUI();
    };

    // Restore button
    const handleRestore = async () => {
        if (backupManager.isSyncing) return;

        let dirHandle = backupManager.directoryHandle;
        if (dirHandle) {
            try {
                // If we have a backup directory, make sure we have read permission
                const permission = await dirHandle.queryPermission({ mode: 'read' });
                if (permission !== 'granted') {
                    const reqResult = await dirHandle.requestPermission({ mode: 'read' });
                    if (reqResult !== 'granted') {
                        // If user denies permission, fallback to showing directory picker
                        dirHandle = null;
                    }
                }
            } catch (err) {
                console.warn('QuickLog-Solo: Failed to query/request read permission, falling back to picker', err);
                dirHandle = null;
            }
        }

        const restoredHandle = await restoreManager.restoreFromDirectory(showConfirm, showToast, t, dirHandle);
        if (restoredHandle) {
            await backupManager.setDirectory(restoredHandle);
            location.reload();
        }
    };
    getEl('restore-configured-btn')?.addEventListener('click', handleRestore);

    getEl('advanced-editor-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        launchEditor('projects/category-editor/index.html', CATEGORY_EDITOR_URL, 'quicklog_category_editor');
    });

    getEl('launch-maker-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
            return;
        }
        const lang = getLanguage();
        const resolvedTheme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';

        launchOrFocusTab(
            'projects/animation-maker/index.html',
            '../animation-maker/index.html',
            { lang, theme: resolvedTheme },
            'quicklog_animation_maker'
        );
    });

    getEl('alarm-editor-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        launchEditor('projects/alarm-editor/index.html', ALARM_EDITOR_URL, 'quicklog_alarm_editor');
    });

    getEl('test-notification-btn')?.addEventListener('click', async () => {
        if (typeof chrome !== 'undefined' && (chrome.notifications || chrome.alarms)) {
            // 1. Immediate notification test
            if (chrome.notifications) {
                chrome.notifications.create(
                    {
                        type: 'basic',
                        iconUrl: 'shared/assets/icon128.png',
                        title: t('title'),
                        message: t('test-notification-message') + ' (Immediate)',
                        priority: 2,
                    },
                    (_id) => {
                        if (chrome.runtime.lastError) {
                            console.error('QuickLog-Solo: Test notification failed:', chrome.runtime.lastError);
                        }
                    }
                );
            }

            // 2. Background alarm test (schedules an alarm for 1 minute in the future)
            // Chrome enforces a 1-minute minimum for alarms in packed extensions to prevent abuse.
            if (chrome.alarms) {
                const testAlarmName = 'ql_test_alarm';
                await chrome.alarms.clear(testAlarmName);
                // We use exactly 1.0 minutes to ensure scheduling by the browser
                chrome.alarms.create(testAlarmName, { delayInMinutes: 1.0 });
                showToast('Background test scheduled. Please wait 60s.');
            }
        } else {
            alert('Extension APIs not available in this environment.');
        }
    });

    backupManager.onStatusChange = () => {
        updateBackupUI();
    };

    backupManager.onConfirm = async (key, params) => {
        const choice = await showMultiChoice(t(key, params), [
            { label: t('backup-btn-ignore-continue'), value: true, class: 'primary-btn' },
            { label: t('backup-btn-abort-investigate'), value: false, class: 'danger-btn' },
        ]);
        return choice;
    };

    // Settings listeners
    getEl(ID_LANGUAGE_SELECT)?.addEventListener('change', async (e) => {
        const lang = e.target.value;
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_LANGUAGE, value: lang });
        setLanguage(lang);
        applyLanguage();
        updateBackupUI();

        // Update selectors based on the new language
        await updateAnimationSelect();
        updateFontSelect();
        // Save the font change if updateFontSelect had to fallback
        const newFontValue = getEl(ID_FONT_SELECT).value;
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_FONT, value: newFontValue });

        await updateUI();
        broadcastSync();
    });

    getEl(ID_THEME_SELECT)?.addEventListener('change', async (e) => {
        const theme = e.target.value;
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_THEME, value: theme });
        applyTheme(theme);
        await updateUI();
        broadcastSync();
    });

    const fontSelect = getEl(ID_FONT_SELECT);
    if (fontSelect) {
        fontSelect.addEventListener('change', async (e) => {
            const fontValue = e.target.value;
            await dbPut(STORE_SETTINGS, { key: SETTING_KEY_FONT, value: fontValue });
            applyFont(fontValue);
            await updateUI();
            broadcastSync();
        });
    }

    const fontWeightSelect = getEl(ID_FONT_WEIGHT_SELECT);
    if (fontWeightSelect) {
        fontWeightSelect.addEventListener('change', async (e) => {
            const weightValue = e.target.value;
            await dbPut(STORE_SETTINGS, { key: SETTING_KEY_FONT_WEIGHT, value: weightValue });
            applyFontWeight(weightValue);
            await updateUI();
            broadcastSync();
        });
    }

    getEl(ID_TIMER_HEIGHT_SELECT)?.addEventListener('change', async (e) => {
        const height = e.target.value;
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_TIMER_HEIGHT, value: height });
        applyTimerHeight(height);
        broadcastSync();
    });

    const animSelect = getEl(ID_ANIMATION_SELECT);
    if (animSelect) {
        animSelect.addEventListener('change', async (e) => {
            const animType = e.target.value;
            currentAnimationType = animType;
            await dbPut(STORE_SETTINGS, { key: SETTING_KEY_ANIMATION, value: animType });
            await updateUI();
            broadcastSync();
        });
    }

    getEl(ID_SESSION_SYNC_TOGGLE)?.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        if (enabled) {
            const result = await showSyncSetupModal();
            if (result) {
                try {
                    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_SESSION_SYNC, value: true });
                    await performInitialSync(result.settingsMode, result.historyMode);
                    await syncState();
                    broadcastSync();
                } catch (err) {
                    console.error('Initial sync failed:', err);
                    alert(t('alert-import-error') || 'Sync failed');
                    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_SESSION_SYNC, value: false });
                    e.target.checked = false;
                    await syncState();
                }
            } else {
                e.target.checked = false;
            }
        } else {
            if (await showConfirm(t('confirm-disable-session-sync'))) {
                await dbPut(STORE_SETTINGS, { key: SETTING_KEY_SESSION_SYNC, value: false });
                await syncState();
                broadcastSync();
            } else {
                e.target.checked = true;
            }
        }
    });

    // Maintenance helpers
    async function performMaintenanceAction(confirmMessage, action) {
        if (await showConfirm(confirmMessage)) {
            if (activeTask) {
                await stopTask();
                updateUI();
            }
            await action();
        }
    }

    getEl('sync-pull-btn')?.addEventListener('click', () => {
        performMaintenanceAction(t('confirm-sync-pull'), async () => {
            try {
                // Add a slight delay to avoid race conditions with async stopTask push
                await new Promise((resolve) => setTimeout(resolve, 200));
                await performInitialSync('none', 'cloud-to-local');
                await broadcastSync('reload');
                location.reload();
            } catch (error) {
                console.error('Failed to pull sync data:', error);
                showToast(t('error-sync-pull') || 'Failed to sync');
            }
        });
    });

    getEl('sync-clear-cloud-btn')?.addEventListener('click', () => {
        performMaintenanceAction(t('confirm-sync-clear-cloud'), async () => {
            try {
                // Stop the active task first to ensure consistency across devices
                if (activeTask) {
                    await stopTask();
                }
                // Add a slight delay to avoid race conditions with async stopTask push
                await new Promise((resolve) => setTimeout(resolve, 200));
                await clearCloudHistory();
                await dbClear(STORE_LOGS);
                // Force idle state in settings (using literal to avoid import issues in CI/extension context)
                await dbDelete(STORE_SETTINGS, 'pauseState');
                activeTask = null;

                await updateUI();
                // Ensure animations and timer UI are reset
                if (animationEngine) animationEngine.stop();

                await broadcastSync('reload');
                showToast(t('toast-deleted'));
            } catch (error) {
                console.error('Failed to clear cloud history:', error);
                showToast(t('error-clear-cloud') || 'Failed to clear cloud history');
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const dbParam = urlParams.get('db');
    if (dbParam) {
        // Strict validation for database name: alphanumeric and underscores only, max 50 chars
        if (/^[a-zA-Z0-9_]{1,50}$/.test(dbParam)) {
            console.log(`QuickLog-Solo: Using custom database: ${dbParam}`);
            setDatabaseName(dbParam);
        } else {
            console.warn('QuickLog-Solo: Invalid database name parameter ignored.');
        }
    }

    try {
        await loadVersion();
    } catch (e) {
        console.error('Failed to load version:', e);
    }

    try {
        await initDB();

        // Set up animation sync progress callback (non-blocking UI update)
        setAnimSyncProgressCallback((completed, total) => {
            const indicator = getEl('anim-sync-progress');
            if (indicator) {
                if (completed >= total) {
                    indicator.textContent = '';
                    indicator.style.display = 'none';
                } else {
                    indicator.textContent = `${completed} / ${total}`;
                    indicator.style.display = '';
                }
            }
        });

        if (await isSessionSyncEnabled()) {
            await pullFromCloud().catch((err) =>
                console.error('Failed to pull from cloud during initialization:', err)
            );
        }

        initAnimationEngine();
        await backupManager.init();
        setupBroadcastChannel(handleSyncMessage);
        setupEventListeners();
        await handleTestParameters();

        isAppInitialized = true;
        await syncState();
    } catch (e) {
        console.error('Failed to initialize application:', e);
        alert(`${t('alert-init-error')}\n\nDetails: ${e.message || e}`);
    }

    console.log('QuickLog-Solo Initialized');

    // State Synchronization: Sync when tab becomes visible or window gets focus
    const delayedSync = () => {
        if (syncTimeout) clearTimeout(syncTimeout);
        // Delay sync slightly to allow local interactions (like clicks) to take precedence
        syncTimeout = setTimeout(async () => {
            if (document.visibilityState === 'visible') {
                // Concurrency control: Wait for ongoing sync to complete to prevent race conditions
                if (delayedSync.activePromise) {
                    await delayedSync.activePromise.catch(() => {});
                }
                delayedSync.activePromise = (async () => {
                    try {
                        if (await isSessionSyncEnabled()) {
                            await pullFromCloud().catch(() => false);
                        }
                        // Always sync UI state to pick up changes that might have been applied by the background script
                        await syncState();
                    } finally {
                        delayedSync.activePromise = null;
                    }
                })();
                await delayedSync.activePromise.catch((err) => {
                    console.error('QuickLog-Solo: Sync failed', err);
                });
            }
        }, 100);
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            delayedSync();
        }
    });
    window.addEventListener('focus', delayedSync);
    window.addEventListener('online', delayedSync);

    // Deep Sleep / Wake detection: Monitor for significant time jumps
    let lastTick = Date.now();
    setInterval(() => {
        const now = Date.now();
        if (now - lastTick > 10000) {
            // Jump > 10s detected (e.g. PC wake)
            console.log('QuickLog-Solo: Wake detected, triggering sync.');
            delayedSync();
        }
        lastTick = now;
    }, 2000);

    // Direct background message detection
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message) => {
            if (
                message?.type === 'sync' ||
                message?.type === 'categories-updated' ||
                message?.type === 'alarms-updated'
            ) {
                delayedSync();
            }
        });
    }
});

async function handleTestParameters() {
    const urlParams = new URLSearchParams(window.location.search);

    // テスト用のタスク開始: ?test_cat=Dev&test_elapsed=60000&test_resumable=Dev
    let testCat = urlParams.get(URL_PARAM_TEST_CAT);
    if (testCat) {
        if (testCat.length > 50) testCat = testCat.substring(0, 50);
        const elapsed = parseInt(urlParams.get(URL_PARAM_TEST_ELAPSED) || '0');
        const resumable = urlParams.get(URL_PARAM_TEST_RESUMABLE);
        const startTime = Date.now() - elapsed;

        // 既存のタスクを強制終了
        if (activeTask) {
            await stopTaskLogic(activeTask);
        }

        // 指定された状態をDBに直接注入
        const cat = await dbGetByName(STORE_CATEGORIES, testCat);
        const newLog = {
            category: testCat,
            startTime: startTime,
            endTime: null,
            resumableCategory: resumable,
            color: cat ? cat.color || 'primary' : 'primary',
            tags: cat ? cat.tags || '' : '',
        };
        const id = await dbAdd(STORE_LOGS, newLog);
        newLog.id = id;
        activeTask = newLog;

        // URLをクリーンアップして再読み込み時にループしないようにする
        // test_* パラメータのみを削除し、langやdbは維持する
        const params = new URLSearchParams(window.location.search);
        params.delete(URL_PARAM_TEST_CAT);
        params.delete(URL_PARAM_TEST_ELAPSED);
        params.delete(URL_PARAM_TEST_RESUMABLE);

        const queryString = params.toString();
        const newUrl = window.location.pathname + (queryString ? '?' + queryString : '');
        window.history.replaceState({}, '', newUrl);
    }
}
