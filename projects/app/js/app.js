import {
    initDB, getCurrentAppState, dbGetByName, dbGetAll, dbCount, dbPut, dbAdd, dbAddMultiple, dbDelete, dbClear, dbImportCategories,
    setDatabaseName, DB_NAME,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, STORE_ALARMS,
    SETTING_KEY_THEME, SETTING_KEY_FONT, SETTING_KEY_ANIMATION, SETTING_KEY_LANGUAGE, SETTING_KEY_REPORT_SETTINGS
} from '../shared/js/db.js';
import { backupManager } from './backup.js';
import { t, setLanguage, getLanguage, applyLanguage, detectBrowserLanguage } from '../shared/js/i18n.js';
import { formatDuration, formatLogDuration, startTaskLogic, stopTaskLogic, pauseTaskLogic, generateReport, calculateTagAggregation } from '../shared/js/logic.js';
import { escapeHtml, escapeCsv, parseCsvLine, isValidCategoryName, SYSTEM_CATEGORY_IDLE, SYSTEM_CATEGORY_PAGE_BREAK } from '../shared/js/utils.js';
import { AnimationEngine } from '../shared/js/animations.js';
import { animations } from '../shared/js/animation_registry.js';
import {
    validateCategorySchema, SCHEMA_KIND_CATEGORY, SCHEMA_VERSION_1_0,
    SCHEMA_TYPE_CATEGORY, SCHEMA_TYPE_PAGE_BREAK
} from '../shared/js/schema.js';

// QuickLog-Solo: Main Application Entry

// Constants
const THEME_SYSTEM = 'system';

const URL_PARAM_TEST_CAT = 'test_cat';
const URL_PARAM_TEST_ELAPSED = 'test_elapsed';
const URL_PARAM_TEST_RESUMABLE = 'test_resumable';

const MAX_LOGS_DISPLAY = 100;
const TOAST_DURATION_MS = 2000;
const IMPORT_FEEDBACK_DELAY_MS = 500;
const ITEMS_PER_PAGE = 16;

const EXCLUSION_PADDING_X = 4;
const EXCLUSION_PADDING_Y = 2;

const CSV_HEADER = "id,category,startTime,endTime\n";
const SYNC_CHANNEL_NAME = 'quicklog_solo_sync';

const ID_SETTINGS_POPUP = 'settings-popup';
const ID_SETTINGS_TOGGLE = 'settings-toggle';
const ID_THEME_SELECT = 'theme-select';
const ID_FONT_SELECT = 'font-select';
const ID_ANIMATION_SELECT = 'animation-select';
const ID_LANGUAGE_SELECT = 'language-select';
const ID_CATEGORY_LIST = 'category-list';
const ID_CATEGORY_PAGINATION = 'category-pagination';
const ID_LOG_LIST = 'log-list';
const ID_ELAPSED_TIME = 'elapsed-time';
const ID_STATUS_LABEL = 'status-label';
const ID_PAUSE_BTN = 'pause-btn';
const ID_END_BTN = 'end-btn';
const ID_CURRENT_TASK_DISPLAY = 'current-task-display';
const ID_TOAST = 'toast';

const ID_BACKUP_INIT_CONTAINER = 'backup-init-container';
const ID_BACKUP_RUN_INIT_BTN = 'backup-run-init-btn';
const ID_BACKUP_MAIN_CONTAINER = 'backup-main-container';
const ID_BACKUP_RUN_BTN = 'backup-run-btn';
const ID_BACKUP_RUN_BTN_TEXT = 'backup-run-btn-text';
const ID_BACKUP_CHANGE_DIR_BTN = 'backup-change-dir-btn';
const ID_BACKUP_LAST_TIME_DISPLAY = 'backup-last-time-display';
const ID_BACKUP_FILE_COUNT_DISPLAY = 'backup-file-count-display';
const ID_BACKUP_DIR_PATH = 'backup-dir-path';

const ID_CONFIRM_MODAL = 'confirm-modal';
const ID_CONFIRM_MESSAGE = 'confirm-message';
const ID_CONFIRM_OK_BTN = 'confirm-ok-btn';
const ID_CONFIRM_CANCEL_BTN = 'confirm-cancel-btn';
const ID_VERSION_DISPLAY = 'version-display';
const ID_STATS_LOG_COUNT = 'stats-log-count';
const ID_STATS_CATEGORY_COUNT = 'stats-category-count';
const ID_ALARM_LIST = 'alarm-list';
const ID_CATEGORY_EDITOR_LIST = 'category-editor-list';
const ID_NEW_CATEGORY_NAME_SETTINGS = 'new-category-name-settings';
const ID_COPY_REPORT_BTN = 'copy-report-btn';
const ID_COPY_AGGREGATION_BTN = 'copy-aggregation-btn';
const ID_CATEGORY_SECTION = 'category-section';
const ID_ADD_CATEGORY_BTN_SETTINGS = 'add-category-btn-settings';
const ID_EXPORT_CSV_BTN = 'export-csv-btn';
const ID_IMPORT_CSV_BTN = 'import-csv-btn';
const ID_CSV_FILE_INPUT = 'csv-file-input';
const ID_EXPORT_CATEGORIES_BTN = 'export-categories-btn';
const ID_IMPORT_CATEGORIES_BTN = 'import-categories-btn';
const ID_CLEAR_LOGS_BTN = 'clear-logs-btn';
const ID_RESET_CAT_SETTINGS_BTN = 'reset-cat-settings-btn';
const ID_RESET_SETTINGS_BTN = 'reset-settings-btn';

const CATEGORY_EDITOR_URL = 'https://quick-log-solo.vercel.app/category-editor/';

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
/** @type {BroadcastChannel|null} Channel for cross-tab state sync. */
let syncChannel = null;
/** @type {number|null} Timeout ID for delayed sync execution. */
let syncTimeout = null;
/** @type {number} Current page index in the category list. */
let currentCategoryPage = 0;
/** @type {string} Current background animation ID. */
let currentAnimationType = 'digital_rain';
/** @type {string|null} JSON string of the last rendered category state for change detection. */
let lastCategoryRenderData = null;
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
    adjust: 'none'
};

const getEl = (id) => document.getElementById(id);
const queryAll = (selector) => document.querySelectorAll(selector);
const getBody = () => document.body;
const createEl = (tag) => document.createElement(tag);

const FONTS = [
    { name: 'Roboto / Noto Sans JP', value: "'Roboto', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', 'Noto Color Emoji', sans-serif", lang: ['ja', 'en', 'de', 'es', 'fr', 'pt'] },
    { name: 'Roboto / Noto Sans KR', value: "'Roboto', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans Symbols', 'Noto Color Emoji', sans-serif", lang: ['ko'] },
    { name: 'Roboto / Noto Sans SC', value: "'Roboto', 'Noto Sans SC', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans Symbols', 'Noto Color Emoji', sans-serif", lang: ['zh'] },
    { name: 'Inter', value: "'Inter', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', 'Noto Color Emoji', sans-serif", lang: ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'] },
    { name: 'Montserrat', value: "'Montserrat', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', 'Noto Color Emoji', sans-serif", lang: ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'] },
    { name: 'Open Sans', value: "'Open Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', 'Noto Color Emoji', sans-serif", lang: ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'] },
    { name: 'Ubuntu', value: "'Ubuntu', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Symbols', 'Noto Color Emoji', sans-serif", lang: ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'] },
    { name: 'font-system', value: 'system-ui, -apple-system, "Noto Sans Symbols", "Noto Color Emoji", sans-serif', lang: ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'] }
];

// --- Task Control ---

async function startTask(categoryName, resumableCategory = null) {
    if (syncTimeout) clearTimeout(syncTimeout);
    const cat = await dbGetByName(STORE_CATEGORIES, categoryName);
    const color = cat ? cat.color : null;
    const tags = cat ? (cat.tags || '') : '';
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
    const timeStr = formatDuration(elapsed).toString();

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


function applyFont(fontValue) {
    getBody().style.setProperty('--font-family', fontValue);
    const select = getEl(ID_FONT_SELECT);
    if (select) select.value = fontValue;
}

function applyAnimation(animationType, categoryAnimation = 'default', color = 'primary') {
    currentAnimationType = animationType;
    let activeAnimation = (categoryAnimation && categoryAnimation !== 'default') ? categoryAnimation : animationType;

    if (categoryAnimation === 'none') {
        activeAnimation = 'none';
    }

    const select = getEl(ID_ANIMATION_SELECT);
    if (select && select.value !== animationType) select.value = animationType;

    const display = getEl(ID_CURRENT_TASK_DISPLAY);

    if (animationEngine && activeTask && activeTask.category !== SYSTEM_CATEGORY_IDLE && activeAnimation !== 'none') {
        const colorCode = getColorCode(color);
        const animStateKey = `${activeAnimation}-${activeTask.startTime}-${colorCode}`;
        if (currentActiveAnimation !== animStateKey) {
            animationEngine.start(activeAnimation, activeTask.startTime, colorCode);
            currentActiveAnimation = animStateKey;
        } else if (!animationEngine.worker) {
            // Guard against the case where engine was stopped but currentActiveAnimation wasn't reset
            animationEngine.start(activeAnimation, activeTask.startTime, colorCode);
        }
        display?.classList.add('anim-active');
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
        display?.classList.remove('anim-active');
        const base = getEl('current-task-display-base');
        base?.classList.remove('anim-active');
        const colorClasses = Array.from(base?.classList || []).filter(c => c.startsWith('cat-'));
        colorClasses.forEach(c => base.classList.remove(c));
        getEl(ID_PAUSE_BTN)?.classList.remove('anim-active');
        getEl(ID_END_BTN)?.classList.remove('anim-active');
    }
}

function splitCategoriesIntoPages(allCategories) {
    allCategories.sort((a, b) => (a.order || 0) - (b.order || 0));

    const pages = [[]];
    let currentPageIdx = 0;
    allCategories.forEach(cat => {
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
        categories: pageCategories.map(c => ({ name: c.name, color: c.color }))
    });

    if (lastCategoryRenderData === currentRenderData) {
        return;
    }
    lastCategoryRenderData = currentRenderData;

    console.log('QuickLog-Solo: Rendering categories...');
    const list = getEl(ID_CATEGORY_LIST);
    if (!list) return;
    list.replaceChildren();

    pageCategories.forEach(cat => {
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
        list.appendChild(btn);
    });

    renderPaginationDots(totalPages);
}

function renderPaginationDots(totalPages) {
    const container = getEl(ID_CATEGORY_PAGINATION);
    if (!container) return;
    container.replaceChildren();

    for (let i = 0; i < totalPages; i++) {
        const dot = createEl('div');
        dot.className = 'pagination-dot' + (i === currentCategoryPage ? ' active' : '');
        dot.onclick = () => {
            if (currentCategoryPage !== i) {
                currentCategoryPage = i;
                renderCategories();
            }
        };
        container.appendChild(dot);
    }
}

async function renderLogs() {
    let allLogs;
    let categories;
    try {
        allLogs = await dbGetAll(STORE_LOGS);
        categories = await dbGetAll(STORE_CATEGORIES);
    } catch (e) {
        console.error('Failed to get data for logs:', e);
        return;
    }
    const categoryMap = new Map(categories.map(c => [c.name, c]));
    const visibleLogs = allLogs.sort((a, b) => b.startTime - a.startTime).slice(0, MAX_LOGS_DISPLAY);

    const logList = getEl(ID_LOG_LIST);
    if (!logList) return;
    logList.replaceChildren();

    let lastDate = '';
    const days = t('day-names');

    visibleLogs.forEach((log) => {
        const d = new Date(log.startTime);
        const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;

        if (dateStr !== lastDate) {
            const header = createEl('li');
            header.className = 'log-date-header';
            header.textContent = dateStr;
            logList.appendChild(header);
            lastDate = dateStr;
        }

        const li = createLogElement(log, categoryMap);
        logList.appendChild(li);
    });
}

function createLogElement(log, categoryMap) {
    const li = createEl('li');
    li.className = 'log-item';
    const startTimeStr = new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = log.endTime ? new Date(log.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

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
    const durationText = (log.endTime && !log.isManualStop) ? formatLogDuration(durationMs) : '';

    let colorClass;
    let displayName = log.category;

    if (log.isManualStop) {
        colorClass = 'dot-error';
        displayName = t('stop');
    } else if (log.category === SYSTEM_CATEGORY_IDLE) {
        colorClass = 'dot-neutral';
        displayName = t('idle-category-log');
    } else {
        const color = log.color || (categoryMap.get(log.category) ? categoryMap.get(log.category).color : 'primary');
        colorClass = `dot-${color}`;
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
                width: rect.width + (EXCLUSION_PADDING_X * 2),
                height: rect.height + (EXCLUSION_PADDING_Y * 2)
            });
        }
    }

    if (statusLabel) {
        const rect = statusLabel.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            exclusionAreas.push({
                x: rect.left - canvasRect.left - EXCLUSION_PADDING_X,
                y: rect.top - canvasRect.top - EXCLUSION_PADDING_Y,
                width: rect.width + (EXCLUSION_PADDING_X * 2),
                height: rect.height + (EXCLUSION_PADDING_Y * 2)
            });
        }
    }

    if (elapsedTime && !elapsedTime.classList.contains('hidden')) {
        const rect = elapsedTime.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            exclusionAreas.push({
                x: rect.left - canvasRect.left - EXCLUSION_PADDING_X,
                y: rect.top - canvasRect.top - EXCLUSION_PADDING_Y,
                width: rect.width + (EXCLUSION_PADDING_X * 2),
                height: rect.height + (EXCLUSION_PADDING_Y * 2)
            });
        }
    }

    animationEngine.setExclusionAreas(exclusionAreas);
}

function initAnimationEngine() {
    const canvas = getEl('animation-canvas');
    if (canvas) {
        animationEngine = new AnimationEngine(canvas);
        animationEngine.onStop = () => {
            currentActiveAnimation = null;
        };
        animations.forEach(anim => {
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

function setupBroadcastChannel() {
    syncChannel = new BroadcastChannel(`${SYNC_CHANNEL_NAME}_${DB_NAME}`);
    syncChannel.onmessage = (event) => {
        console.log('QuickLog-Solo: Received sync message', event.data);
        if (event.data.type === 'reload') {
            location.reload();
        } else if (event.data.type === 'alarms-updated') {
            // Background script handles alarm scheduling, but we might want to refresh UI if open
            const alarmsTab = getEl('alarms-tab');
            if (alarmsTab && !alarmsTab.classList.contains('hidden')) {
                renderAlarmList();
            }
        } else if (event.data.type === 'sync') {
            // Only sync if visible to reduce CPU load as requested
            if (document.visibilityState === 'visible') {
                syncState();
            }
        }
    };
}

function broadcastSync(type = 'sync') {
    if (syncChannel) {
        syncChannel.postMessage({ type });
    }
    // Also notify background script via chrome.runtime for better reliability
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type }).catch(() => {
            // Ignore errors if background script is not listening
        });
    }
}

async function syncState() {
    if (!isAppInitialized) return;
    const state = await getCurrentAppState();

    // Backup UI sync
    updateBackupUI();

    // Migration: Update 'matrix_code' to 'digital_rain' for existing users
    if (state.animation === 'matrix_code') {
        state.animation = 'digital_rain';
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_ANIMATION, value: 'digital_rain' });
    }
    activeTask = state.activeTask;

    const lang = state.language || 'auto';
    setLanguage(lang);
    applyLanguage();

    applyTheme(state.theme || THEME_SYSTEM);

    const langSelect = getEl(ID_LANGUAGE_SELECT);
    if (langSelect) langSelect.value = state.language || 'auto';


    // Update Animation options
    currentAnimationType = state.animation || 'digital_rain';
    updateAnimationSelect();

    // Update Font options first. This filters the available fonts based on language.
    updateFontSelect();

    // Ensure the selected font is valid for the current language, or fallback
    const currentLang = (lang === 'auto') ? detectBrowserLanguage() : lang;
    const filteredFonts = FONTS.filter(f => f.lang.includes(currentLang));
    const fontToApply = filteredFonts.some(f => f.value === state.font) ? state.font : filteredFonts[0].value;
    applyFont(fontToApply);

    // Determine active animation type
    let color = 'primary';
    let categoryAnimation = 'default';
    if (activeTask && activeTask.category !== SYSTEM_CATEGORY_IDLE) {
        const cat = await dbGetByName(STORE_CATEGORIES, activeTask.category);
        color = cat ? cat.color : (activeTask.color || 'primary');
        categoryAnimation = cat ? (cat.animation || 'default') : 'default';
    }
    applyAnimation(state.animation || 'digital_rain', categoryAnimation, color);

    await updateUI();

    // Settings popup logic: Refresh content if tab is active
    const settingsPopup = getEl(ID_SETTINGS_POPUP);
    if (settingsPopup && !settingsPopup.classList.contains('hidden')) {
            const alarmsTab = getEl('alarms-tab');
            if (alarmsTab && !alarmsTab.classList.contains('hidden')) {
                await renderAlarmList();
            }
        const categoriesTab = getEl('categories-tab');
        if (categoriesTab && !categoriesTab.classList.contains('hidden')) {
            await renderCategoryEditor();
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
        const categoryCount = categories.filter(c => c.name !== SYSTEM_CATEGORY_IDLE && !c.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)).length;

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
        description = (typeof metadata.description === 'object')
            ? (metadata.description[lang] || metadata.description['en'] || '')
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

function updateAnimationSelect() {
    const animSelect = getEl(ID_ANIMATION_SELECT);
    if (animSelect) {
        const currentLang = getLanguage();
        animSelect.replaceChildren();

        const noneOpt = createEl('option');
        noneOpt.value = 'none';
        noneOpt.textContent = t('anim-none');
        animSelect.appendChild(noneOpt);

        animations.forEach(anim => {
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
        animSelect.value = currentAnimationType;
    }
}

function updateFontSelect() {
    const fontSelect = getEl(ID_FONT_SELECT);
    if (fontSelect) {
        const currentFont = fontSelect.value;
        const currentLang = getLanguage();

        fontSelect.replaceChildren();
        const filteredFonts = FONTS.filter(f => f.lang.includes(currentLang));

        filteredFonts.forEach(f => {
            const opt = createEl('option');
            opt.value = f.value;
            opt.textContent = (f.name === 'font-system') ? t('font-system') : f.name;
            opt.style.fontFamily = f.value;
            fontSelect.appendChild(opt);
        });

        // If the previously selected font is not in the filtered list, select the first available one
        if (!filteredFonts.some(f => f.value === currentFont)) {
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
    console.log('QuickLog-Solo: updateUI called');
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
        display: getEl(ID_CURRENT_TASK_DISPLAY)
    };

    if (activeTask) {
        let color;
        let categoryAnimation;
        const isPaused = activeTask.category === SYSTEM_CATEGORY_IDLE;

        if (isPaused) {
            color = 'neutral';
        } else {
            const cat = await dbGetByName(STORE_CATEGORIES, activeTask.category);
            color = cat ? cat.color : (activeTask.color || 'primary');
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
        applyAnimation(currentAnimationType, categoryAnimation, color);
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

    const allLogs = await dbGetAll(STORE_LOGS);
    reportLogDates = new Set(allLogs.map(l => new Date(l.startTime).setHours(0, 0, 0, 0)));

    const state = await getCurrentAppState();
    if (state.reportSettings) {
        reportSettings = state.reportSettings;
        getEl(ID_REPORT_FORMAT_SELECT).value = reportSettings.format;
        getEl(ID_REPORT_EMOJI_SELECT).value = reportSettings.emoji;
        getEl(ID_REPORT_ENDTIME_SELECT).value = reportSettings.endTime;
        getEl(ID_REPORT_DURATION_SELECT).value = reportSettings.duration;
        getEl(ID_REPORT_ADJUST_SELECT).value = reportSettings.adjust || 'none';
    }

    updateReportUI();
    getEl(ID_REPORT_MODAL).classList.remove('hidden');
}

async function openTagAggregationModal() {
    tagAggregationSelectedDate = new Date();
    tagAggregationSelectedDate.setHours(0, 0, 0, 0);

    const allLogs = await dbGetAll(STORE_LOGS);
    reportLogDates = new Set(allLogs.map(l => new Date(l.startTime).setHours(0, 0, 0, 0)));

    await updateTagAggregationUI();
    getEl(ID_TAG_AGGREGATION_MODAL).classList.remove('hidden');
}

async function updateReportUI() {
    const d = reportSelectedDate;
    const days = t('day-names');
    const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
    getEl(ID_REPORT_DATE_TEXT).textContent = dateStr;

    const allLogs = await dbGetAll(STORE_LOGS);
    const startOfDay = d.getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
    const dayLogs = allLogs.filter(l => l.startTime >= startOfDay && l.startTime <= endOfDay && l.endTime).sort((a, b) => a.startTime - b.startTime);

    const reportText = generateReport(dayLogs, {
        ...reportSettings,
        idleText: t('idle-category-log'),
        headerTime: t('report-header-time'),
        headerCategory: t('report-header-category')
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
        const prevDates = logDates.filter(d => d < current);
        if (prevDates.length > 0) {
            newDate = new Date(prevDates[prevDates.length - 1]);
        }
    } else {
        // Find next date with logs, up to today
        const nextDates = logDates.filter(d => d > current && d <= today);
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
    days.forEach(day => {
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

    const allLogs = await dbGetAll(STORE_LOGS);
    const startOfDay = d.getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
    const dayLogs = allLogs.filter(l => l.startTime >= startOfDay && l.startTime <= endOfDay && l.endTime);

    const tagAgg = calculateTagAggregation(dayLogs, t('no-tags'));

    const table = getEl(ID_TAG_AGGREGATION_TABLE);
    table.replaceChildren();

    const sortedTags = Object.keys(tagAgg).sort((a, b) => {
        if (a === t('no-tags')) return 1;
        if (b === t('no-tags')) return -1;
        return a.localeCompare(b);
    });

    if (sortedTags.length === 0) {
        const row = createEl('tr');
        const cell = createEl('td');
        cell.textContent = t('no-logs-for-day');
        cell.colSpan = 3;
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        table.appendChild(row);
        return;
    }

    sortedTags.forEach(tag => {
        const row = createEl('tr');

        const nameCell = createEl('td');
        nameCell.className = 'tag-name-cell';
        nameCell.textContent = tag;
        nameCell.title = tag;
        row.appendChild(nameCell);

        const durCell = createEl('td');
        durCell.className = 'tag-duration-cell';
        const ms = tagAgg[tag];
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        durCell.textContent = `${h}:${String(m).padStart(2, '0')}`;
        row.appendChild(durCell);

        const copyCell = createEl('td');
        copyCell.className = 'tag-copy-cell';
        const copyBtn = createEl('button');
        copyBtn.className = 'tag-copy-btn material-symbols-outlined';
        copyBtn.textContent = 'content_paste';
        copyBtn.title = t('btn-copy');
        copyBtn.onclick = () => {
            const text = `${tag} | ${durCell.textContent}`;
            navigator.clipboard.writeText(text);
            showToast(t('toast-copied'));
        };
        copyCell.appendChild(copyBtn);
        row.appendChild(copyCell);

        table.appendChild(row);
    });
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

        choices.forEach(choice => {
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

// --- Alarms ---

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

    const categories = await dbGetAll(STORE_CATEGORIES);
    const workCategories = categories.filter(c => c.name !== SYSTEM_CATEGORY_IDLE && !c.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK));
    const alarms = await dbGetAll(STORE_ALARMS);
    alarms.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    list.replaceChildren();

    alarms.forEach(alarm => {
        const item = createEl('div');
        item.className = 'alarm-item';

        // Row 1
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

        const timeInput = createEl('input');
        timeInput.type = 'time';
        timeInput.className = 'alarm-time';
        timeInput.value = alarm.time || '09:00';

        const confirmLabel = createEl('label');
        confirmLabel.className = 'alarm-confirm-label';
        confirmLabel.title = t('alarm-tooltip-confirmation');
        const confirmIcon = createEl('span');
        confirmIcon.className = 'material-symbols-outlined';
        confirmIcon.textContent = 'task_alt';
        const confirmCheck = createEl('input');
        confirmCheck.type = 'checkbox';
        confirmCheck.className = 'alarm-confirm';
        confirmCheck.checked = alarm.requireConfirmation;
        confirmLabel.appendChild(confirmIcon);
        confirmLabel.appendChild(confirmCheck);

        row1.appendChild(enabledLabel);
        row1.appendChild(timeInput);
        row1.appendChild(confirmLabel);

        // Row 2
        const row2 = createEl('div');
        row2.className = 'alarm-row';
        const msgLabel = createEl('span');
        msgLabel.className = 'alarm-label';
        msgLabel.setAttribute('data-i18n', 'alarm-label-message');
        msgLabel.textContent = t('alarm-label-message');
        const msgInput = createEl('input');
        msgInput.type = 'text';
        msgInput.className = 'alarm-message';
        msgInput.value = alarm.message || '';
        msgInput.placeholder = t('alarm-placeholder-message');
        row2.appendChild(msgLabel);
        row2.appendChild(msgInput);

        // Row 3
        const row3 = createEl('div');
        row3.className = 'alarm-row';
        const actionLabel = createEl('span');
        actionLabel.className = 'alarm-label';
        actionLabel.setAttribute('data-i18n', 'alarm-label-action');
        actionLabel.textContent = t('alarm-label-action');
        const actionSelect = createEl('select');
        actionSelect.className = 'alarm-action';
        ['none', 'stop', 'pause', 'start'].forEach(val => {
            const opt = createEl('option');
            opt.value = val;
            opt.textContent = t(`alarm-action-${val}`);
            opt.setAttribute('data-i18n', `alarm-action-${val}`);
            if (alarm.action === val) opt.selected = true;
            actionSelect.appendChild(opt);
        });
        row3.appendChild(actionLabel);
        row3.appendChild(actionSelect);

        // Row 4
        const row4 = createEl('div');
        row4.className = `alarm-row alarm-category-row ${alarm.action === 'start' ? '' : 'hidden'}`;
        const catLabel = createEl('span');
        catLabel.className = 'alarm-label';
        catLabel.setAttribute('data-i18n', 'alarm-label-category');
        catLabel.textContent = t('alarm-label-category');
        const catSelect = createEl('select');
        catSelect.className = 'alarm-category';
        workCategories.forEach(c => {
            const opt = createEl('option');
            opt.value = c.name;
            opt.textContent = c.name;
            if (alarm.actionCategory === c.name) opt.selected = true;
            catSelect.appendChild(opt);
        });
        row4.appendChild(catLabel);
        row4.appendChild(catSelect);

        item.appendChild(row1);
        item.appendChild(row2);
        item.appendChild(row3);
        item.appendChild(row4);

        const updateAlarm = async () => {
            alarm.enabled = item.querySelector('.alarm-enabled').checked;
            alarm.time = item.querySelector('.alarm-time').value;
            alarm.requireConfirmation = item.querySelector('.alarm-confirm').checked;
            alarm.message = item.querySelector('.alarm-message').value.trim();
            alarm.action = item.querySelector('.alarm-action').value;
            alarm.actionCategory = item.querySelector('.alarm-category').value;

            await dbPut(STORE_ALARMS, alarm);

            const catRow = item.querySelector('.alarm-category-row');
            if (alarm.action === 'start') {
                catRow.classList.remove('hidden');
            } else {
                catRow.classList.add('hidden');
            }

            // Notify background script to update alarms
            broadcastSync('alarms-updated');
            showToast(t('toast-alarm-saved'));
        };

        item.querySelector('.alarm-enabled').onchange = updateAlarm;
        item.querySelector('.alarm-time').onchange = updateAlarm;
        item.querySelector('.alarm-confirm').onchange = updateAlarm;
        item.querySelector('.alarm-message').onchange = updateAlarm;
        item.querySelector('.alarm-action').onchange = updateAlarm;
        item.querySelector('.alarm-category').onchange = updateAlarm;

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
        cyan: '#039be5'
    };
    return codes[color] || '#1976d2';
}

async function updateBackupUI() {
    const config = backupManager.config;
    const hasHandle = !!backupManager.directoryHandle;

    const initContainer = getEl(ID_BACKUP_INIT_CONTAINER);
    const mainContainer = getEl(ID_BACKUP_MAIN_CONTAINER);

    if (hasHandle) {
        initContainer?.classList.add('hidden');
        mainContainer?.classList.remove('hidden');
    } else {
        initContainer?.classList.remove('hidden');
        mainContainer?.classList.add('hidden');
    }

    const dirPath = getEl(ID_BACKUP_DIR_PATH);
    if (dirPath) dirPath.textContent = backupManager.directoryHandle ? backupManager.directoryHandle.name : '-';

    const lastTimeDisplay = getEl(ID_BACKUP_LAST_TIME_DISPLAY);
    if (lastTimeDisplay) {
        lastTimeDisplay.textContent = config.lastBackupTime ? new Date(config.lastBackupTime).toLocaleString() : '-';
    }

    const runBtn = getEl(ID_BACKUP_RUN_BTN);
    const runBtnText = getEl(ID_BACKUP_RUN_BTN_TEXT);
    if (runBtn && runBtnText) {
        if (backupManager.isSyncing) {
            runBtn.disabled = true;
            runBtnText.textContent = t('backup-status-syncing');
        } else {
            runBtn.disabled = false;
            const hasPermission = await backupManager.hasPermission();
            runBtnText.textContent = hasPermission ? t('btn-backup-run') : t('btn-backup-grant-run');
        }
    }

    backupManager.getFileCount().then(count => {
        const fileCountDisplay = getEl(ID_BACKUP_FILE_COUNT_DISPLAY);
        if (fileCountDisplay) fileCountDisplay.textContent = count.toString();
    });
}

async function renderCategoryEditor() {
    const list = getEl(ID_CATEGORY_EDITOR_LIST);
    if (!list) return;
    let categories = await dbGetAll(STORE_CATEGORIES);
    categories = categories.filter(c => c.name !== SYSTEM_CATEGORY_IDLE).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    list.replaceChildren();

    const colors = [
        'primary', 'secondary', 'tertiary', 'error', 'neutral', 'outline',
        'teal', 'green', 'yellow', 'orange', 'pink', 'indigo', 'brown', 'cyan'
    ];

    const lang = getLanguage();

    categories.forEach((cat, idx) => {
        const item = createEl('div');
        const isPageBreak = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);
        item.className = 'category-editor-item' + (isPageBreak ? ' page-break-item' : '');
        item.draggable = true;
        item.dataset.name = cat.name;
        item.dataset.id = cat.id;
        item.dataset.index = idx;

        const getAnimLabel = (anim) => {
            if (typeof anim.metadata.name === 'object') {
                return anim.metadata.name[lang] || anim.metadata.name['en'] || anim.id;
            }
            return anim.metadata.name;
        };

        if (isPageBreak) {
            const row1 = createEl('div');
            row1.className = 'cat-editor-row row-1';
            const dragHandle = createEl('span');
            dragHandle.className = 'material-symbols-outlined drag-handle';
            dragHandle.style.cursor = 'grab';
            dragHandle.textContent = 'drag_indicator';
            dragHandle.title = t('tooltip-drag-handle');
            const pbLabel = createEl('span');
            pbLabel.className = 'page-break-label';
            const pbIcon = createEl('span');
            pbIcon.className = 'material-symbols-outlined';
            pbIcon.textContent = 'insert_page_break';
            const pbText = createEl('span');
            pbText.textContent = t('page-break');
            pbLabel.appendChild(pbIcon);
            pbLabel.appendChild(document.createTextNode(' '));
            pbLabel.appendChild(pbText);
            const deleteBtn = createEl('button');
            deleteBtn.className = 'delete-cat-btn';
            deleteBtn.title = t('tooltip-delete-category');
            const deleteIcon = createEl('span');
            deleteIcon.className = 'material-symbols-outlined';
            deleteIcon.textContent = 'delete';
            deleteBtn.appendChild(deleteIcon);
            row1.appendChild(dragHandle);
            row1.appendChild(pbLabel);
            row1.appendChild(deleteBtn);
            item.appendChild(row1);
        } else {
            const animOptions = [
                { value: 'none', label: t('anim-none'), tooltip: '' },
                { value: 'default', label: t('anim-default'), tooltip: '' },
                ...animations.map(anim => {
                    return {
                        value: anim.id,
                        label: getAnimLabel(anim),
                        tooltip: getAnimationTooltip(anim.metadata, lang)
                    };
                })
            ];

            const row1 = createEl('div');
            row1.className = 'cat-editor-row row-1';
            const dragHandle = createEl('span');
            dragHandle.className = 'material-symbols-outlined drag-handle';
            dragHandle.style.cursor = 'grab';
            dragHandle.textContent = 'drag_indicator';
            dragHandle.title = t('tooltip-drag-handle');
            const nameInput = createEl('input');
            nameInput.type = 'text';
            nameInput.className = 'category-edit-name';
            nameInput.value = cat.name;
            // Also set value attribute for test compatibility (tests/maintenance.spec.js)
            nameInput.setAttribute('value', cat.name);
            const deleteBtn = createEl('button');
            deleteBtn.className = 'delete-cat-btn';
            deleteBtn.title = t('tooltip-delete-category');
            const deleteIcon = createEl('span');
            deleteIcon.className = 'material-symbols-outlined';
            deleteIcon.textContent = 'delete';
            deleteBtn.appendChild(deleteIcon);
            row1.appendChild(dragHandle);
            row1.appendChild(nameInput);
            row1.appendChild(deleteBtn);

            const row2 = createEl('div');
            row2.className = 'cat-editor-row row-2';
            const colorDropdown = createEl('div');
            colorDropdown.className = 'custom-color-dropdown';
            const colorTrigger = createEl('div');
            colorTrigger.className = 'color-dropdown-trigger';
            colorTrigger.style.backgroundColor = getColorCode(cat.color);
            const colorMenu = createEl('div');
            colorMenu.className = 'color-dropdown-menu hidden';
            colors.forEach(color => {
                const colorItem = createEl('div');
                colorItem.className = 'color-dropdown-item' + (color === cat.color ? ' selected' : '');
                colorItem.dataset.color = color;
                colorItem.style.backgroundColor = getColorCode(color);
                colorMenu.appendChild(colorItem);
            });
            colorDropdown.appendChild(colorTrigger);
            colorDropdown.appendChild(colorMenu);

            const animSelect = createEl('select');
            animSelect.className = 'category-edit-animation';
            animOptions.forEach(opt => {
                const optEl = createEl('option');
                optEl.value = opt.value;
                optEl.textContent = opt.label;
                optEl.title = opt.tooltip || '';
                if (cat.animation === opt.value) optEl.selected = true;
                animSelect.appendChild(optEl);
            });
            row2.appendChild(colorDropdown);
            row2.appendChild(animSelect);

            const row3 = createEl('div');
            row3.className = 'cat-editor-row row-3';
            const tagContainer = createEl('div');
            tagContainer.className = 'tag-container';
            const tagList = createEl('div');
            tagList.className = 'tag-list';
            const tagInput = createEl('input');
            tagInput.type = 'text';
            tagInput.className = 'tag-input';
            tagInput.placeholder = t('placeholder-tags');
            tagContainer.appendChild(tagList);
            tagContainer.appendChild(tagInput);
            row3.appendChild(tagContainer);

            item.appendChild(row1);
            item.appendChild(row2);
            item.appendChild(row3);
            item.dataset.name = cat.name;
        }

        if (!isPageBreak) {
            // --- Row 1 Events ---
            const input = item.querySelector('.category-edit-name');
            input.onchange = async () => {
                const newName = input.value.trim();
                if (newName && newName !== cat.name) {
                    if (!isValidCategoryName(newName)) {
                        alert(t('alert-invalid-category', { idle: t('idle-category') }));
                        input.value = cat.name;
                        return;
                    }
                    const oldName = cat.name;
                    const existing = await dbGetByName(STORE_CATEGORIES, newName);
                    if (existing) {
                        alert(t('alert-duplicate-category'));
                        input.value = oldName;
                        return;
                    }
                    const updatedCat = { ...cat, name: newName };
                    await dbPut(STORE_CATEGORIES, updatedCat);

                    const allLogs = await dbGetAll(STORE_LOGS);
                    for (const log of allLogs) {
                        if (log.category === oldName) {
                            log.category = newName;
                            await dbPut(STORE_LOGS, log);
                        }
                    }

                    // If the renamed category is the active task, update it immediately
                    if (activeTask && activeTask.category === oldName) {
                        activeTask.category = newName;
                    }

                    await updateUI();
                    renderCategoryEditor();
                    broadcastSync();
                }
            };

            // --- Row 2 Events (Custom Color Dropdown) ---
            const colorTrigger = item.querySelector('.color-dropdown-trigger');
            const colorMenu = item.querySelector('.color-dropdown-menu');
            colorTrigger.onclick = (e) => {
                e.stopPropagation();
                queryAll('.color-dropdown-menu').forEach(m => { if (m !== colorMenu) m.classList.add('hidden'); });
                colorMenu.classList.toggle('hidden');
            };
            colorMenu.querySelectorAll('.color-dropdown-item').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    cat.color = btn.dataset.color;
                    await dbPut(STORE_CATEGORIES, cat);
                    colorMenu.classList.add('hidden');
                    renderCategoryEditor();
                    renderCategories();
                    await updateUI();
                    broadcastSync();
                };
            });

            const animSelect = item.querySelector('.category-edit-animation');
            animSelect.onchange = async () => {
                cat.animation = animSelect.value;
                await dbPut(STORE_CATEGORIES, cat);
                await updateUI();
                broadcastSync();
            };

            // --- Row 3 Events (Tags) ---
            const tagListEl = item.querySelector('.tag-list');
            const tagInput = item.querySelector('.tag-input');

            const renderTags = () => {
                tagListEl.replaceChildren();
                const tagStr = cat.tags || '';
                const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(Boolean) : [];
                tags.forEach((tag, idx) => {
                    const pill = createEl('span');
                    pill.className = 'tag-pill';
                    const tagText = createEl('span');
                    tagText.className = 'tag-text';
                    tagText.textContent = tag;
                    const tagRemove = createEl('span');
                    tagRemove.className = 'tag-remove material-symbols-outlined';
                    tagRemove.textContent = 'close';
                    tagRemove.dataset.index = idx;
                    pill.appendChild(tagText);
                    pill.appendChild(tagRemove);

                    tagRemove.onclick = async () => {
                        tags.splice(idx, 1);
                        cat.tags = tags.join(',');
                        await dbPut(STORE_CATEGORIES, cat);
                        renderTags();
                        broadcastSync();
                    };
                    tagListEl.appendChild(pill);
                });
            };

            tagInput.onkeydown = async (e) => {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const newTag = tagInput.value.trim().replace(/,/g, '');
                    if (newTag) {
                        const tagStr = cat.tags || '';
                        const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(Boolean) : [];
                        if (!tags.includes(newTag)) {
                            tags.push(newTag);
                            cat.tags = tags.join(',');
                            await dbPut(STORE_CATEGORIES, cat);
                            tagInput.value = '';
                            renderTags();
                            await updateUI();
                            broadcastSync();
                        }
                    }
                }
            };

            renderTags();
        }

        item.querySelector('.delete-cat-btn').onclick = async () => {
            const confirmMsg = isPageBreak ? t('confirm-delete-page-break') : t('confirm-delete-category', { name: cat.name });
            if (await showConfirm(confirmMsg)) {
                await dbDelete(STORE_CATEGORIES, cat.id);
                updateUI();
                renderCategoryEditor();
                broadcastSync();
            }
        };

        item.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', cat.id);
            item.classList.add('dragging');
        };
        item.ondragend = () => item.classList.remove('dragging');

        list.appendChild(item);
    });

    list.ondragover = (e) => {
        e.preventDefault();
        const draggingItem = list.querySelector('.dragging');
        if (!draggingItem) return;
        const siblings = [...list.querySelectorAll('.category-editor-item:not(.dragging)')];
        let nextSibling = siblings.find(sibling => {
            return e.clientY <= sibling.getBoundingClientRect().top + sibling.getBoundingClientRect().height / 2;
        });
        list.insertBefore(draggingItem, nextSibling);
    };

    list.ondrop = async (e) => {
        e.preventDefault();
        const items = [...list.querySelectorAll('.category-editor-item')];
        const currentCategories = await dbGetAll(STORE_CATEGORIES);
        // Map current categories by ID for easy lookup
        const catMap = new Map(currentCategories.map(c => [c.id.toString(), c]));

        for (let i = 0; i < items.length; i++) {
            const id = items[i].dataset.id;
            const cat = catMap.get(id);
            if (cat) {
                cat.order = i;
                await dbPut(STORE_CATEGORIES, cat);
            }
        }
        renderCategories();
        renderCategoryEditor();
        broadcastSync();
    };
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
    categorySection?.addEventListener('wheel', (e) => {
        e.preventDefault();
        dbGetAll(STORE_CATEGORIES).then(categories => {
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
    }, { passive: false });

    // Modals
    const popups = {
        settings: getEl(ID_SETTINGS_POPUP),
        report: getEl(ID_REPORT_MODAL),
        tagAggregation: getEl(ID_TAG_AGGREGATION_MODAL),
        multiChoice: getEl('multi-choice-modal')
    };

    getEl(ID_SETTINGS_TOGGLE)?.addEventListener('click', () => popups.settings?.classList.remove('hidden'));

    queryAll('.close-btn, .report-close-btn, .tag-aggregation-close-btn').forEach(btn => {
        btn.onclick = () => Object.values(popups).forEach(p => p?.classList.add('hidden'));
    });

    window.onclick = (event) => {
        Object.values(popups).forEach(p => { if (event.target === p) p.classList.add('hidden'); });
        // Close custom dropdowns when clicking outside
        if (!event.target.closest('.custom-color-dropdown')) {
            queryAll('.color-dropdown-menu').forEach(m => m.classList.add('hidden'));
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

    [ID_REPORT_FORMAT_SELECT, ID_REPORT_EMOJI_SELECT, ID_REPORT_ENDTIME_SELECT, ID_REPORT_DURATION_SELECT, ID_REPORT_ADJUST_SELECT].forEach(id => {
        getEl(id)?.addEventListener('change', (e) => {
            const key = e.target.dataset.key || id.replace('report-', '').replace('-select', '');
            reportSettings[key] = e.target.value;
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
            const data = [new ClipboardItem({
                [htmlType]: blobHtml,
                [plainType]: blobPlain,
            })];
            await navigator.clipboard.write(data);
        } else {
            await navigator.clipboard.writeText(text);
        }

        showToast(t('toast-copied'));
    });

    // Tabs
    queryAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            queryAll('.tab-btn').forEach(b => b.classList.remove('active'));
            queryAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            const target = getEl(`${btn.dataset.tab}-tab`);
            if (target) target.classList.remove('hidden');
            if (btn.dataset.tab === 'alarms') renderAlarmList();
            if (btn.dataset.tab === 'categories') renderCategoryEditor();
            if (btn.dataset.tab === 'backup') updateBackupUI();
            if (btn.dataset.tab === 'about') updateAboutStats();
        };
    });

    // Backup tab listeners
    const handleDirectorySelection = async () => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await backupManager.setDirectory(handle);
            await backupManager.sync();
            updateBackupUI();
            broadcastSync();
        } catch (err) {
            console.warn('QuickLog-Solo: Directory selection cancelled or failed', err);
        }
    };

    getEl(ID_BACKUP_RUN_INIT_BTN)?.addEventListener('click', handleDirectorySelection);
    getEl(ID_BACKUP_CHANGE_DIR_BTN)?.addEventListener('click', handleDirectorySelection);

    getEl(ID_BACKUP_RUN_BTN)?.addEventListener('click', async () => {
        if (!(await backupManager.hasPermission())) {
            const granted = await backupManager.requestPermission();
            if (!granted) return;
        }
        await backupManager.sync();
        updateBackupUI();
        broadcastSync();
    });

    getEl('advanced-editor-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        const lang = getLanguage();
        const url = new URL(CATEGORY_EDITOR_URL);
        url.searchParams.set('lang', lang);
        url.searchParams.set('from', 'app');
        window.open(url.toString(), '_blank', 'noopener');
    });

    getEl('test-notification-btn')?.addEventListener('click', async () => {
        if (typeof chrome !== 'undefined' && (chrome.notifications || chrome.alarms)) {
            // 1. Immediate notification test
            if (chrome.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'shared/assets/icon128.png',
                    title: t('title'),
                    message: t('test-notification-message') + " (Immediate)",
                    priority: 2
                }, (_id) => {
                    if (chrome.runtime.lastError) {
                        console.error('QuickLog-Solo: Test notification failed:', chrome.runtime.lastError);
                    }
                });
            }

            // 2. Background alarm test (schedules an alarm for 1 minute in the future)
            // Chrome enforces a 1-minute minimum for alarms in packed extensions to prevent abuse.
            if (chrome.alarms) {
                const testAlarmName = 'ql_test_alarm';
                await chrome.alarms.clear(testAlarmName);
                // We use exactly 1.0 minutes to ensure scheduling by the browser
                chrome.alarms.create(testAlarmName, { delayInMinutes: 1.0 });
                showToast("Background test scheduled. Please wait 60s.");
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
            { label: t('backup-btn-abort-investigate'), value: false, class: 'danger-btn' }
        ]);
        return choice;
    };

    // Settings listeners
    getEl(ID_LANGUAGE_SELECT)?.addEventListener('change', async (e) => {
        const lang = e.target.value;
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_LANGUAGE, value: lang });
        setLanguage(lang);
        applyLanguage();

        // Update selectors based on the new language
        updateAnimationSelect();
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

    // Category additions
    getEl(ID_ADD_CATEGORY_BTN_SETTINGS)?.addEventListener('click', async () => {
        const input = getEl(ID_NEW_CATEGORY_NAME_SETTINGS);
        const name = input?.value.trim();
        if (name) {
            if (!isValidCategoryName(name)) {
                alert(t('alert-invalid-category', { idle: t('idle-category') }));
                return;
            }
            const categories = await dbGetAll(STORE_CATEGORIES);
            await dbPut(STORE_CATEGORIES, {
                name,
                color: 'primary',
                order: categories.length,
                tags: ''
            });
            if (input) input.value = '';
            renderCategories();
            renderCategoryEditor();
            broadcastSync();
        }
    });

    getEl('add-page-break-btn')?.addEventListener('click', async () => {
        const categories = await dbGetAll(STORE_CATEGORIES);
        // Ensure unique name for each page break to work with current keyPath:'name'
        const pbName = `${SYSTEM_CATEGORY_PAGE_BREAK}_${Date.now()}`;
        await dbPut(STORE_CATEGORIES, {
            name: pbName,
            order: categories.length
        });
        renderCategories();
        renderCategoryEditor();
        broadcastSync();
    });

    // Category Import/Export (Clipboard)
    getEl(ID_EXPORT_CATEGORIES_BTN)?.addEventListener('click', async () => {
        const categories = await dbGetAll(STORE_CATEGORIES);
        categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const exportData = categories.filter(c => c.name !== SYSTEM_CATEGORY_IDLE);

        // Convert to NDJSON according to schema
        const ndjson = exportData.map(c => {
            const isPageBreak = c.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);
            const entry = {
                kind: SCHEMA_KIND_CATEGORY,
                version: SCHEMA_VERSION_1_0,
                type: isPageBreak ? SCHEMA_TYPE_PAGE_BREAK : SCHEMA_TYPE_CATEGORY
            };
            if (!isPageBreak) {
                entry.name = c.name;
                entry.color = c.color;
                entry.tags = c.tags ? c.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                entry.animation = c.animation || 'default';
            }
            return JSON.stringify(entry);
        }).join('\n');

        try {
            await navigator.clipboard.writeText(ndjson);
            showToast(t('toast-export-success'));
        } catch (err) {
            console.error('Failed to copy categories:', err);
        }
    });

    getEl(ID_IMPORT_CATEGORIES_BTN)?.addEventListener('click', async () => {
        const overlay = getEl('category-list-overlay');
        const list = getEl(ID_CATEGORY_EDITOR_LIST);
        const addBox = getEl('add-category-box-settings');
        const maintenanceBox = getEl('category-maintenance-box-settings');

        const setImporting = (isImporting) => {
            if (isImporting) {
                overlay?.classList.remove('hidden');
                list?.classList.add('disabled-group');
                addBox?.classList.add('disabled-group');
                maintenanceBox?.classList.add('disabled-group');
            } else {
                overlay?.classList.add('hidden');
                list?.classList.remove('disabled-group');
                addBox?.classList.remove('disabled-group');
                maintenanceBox?.classList.remove('disabled-group');
            }
        };

        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;

            // Security: Limit clipboard text size (e.g., 1MB)
            if (text.length > 1024 * 1024) {
                alert(t('alert-import-error') + '\n(Data too large)');
                return;
            }

            const lines = text.split(/\r?\n/).filter(line => line.trim());

            // Security: Limit number of lines
            if (lines.length > 1000) {
                alert(t('alert-import-error') + '\n(Too many items)');
                return;
            }
            const total = lines.length;
            let errorCount = 0;

            const validItems = [];
            for (const line of lines) {
                try {
                    const item = JSON.parse(line);
                    if (validateCategorySchema(item)) {
                        validItems.push(item);
                    } else {
                        console.warn(`QuickLog-Solo: Schema validation failed for line: "${line}"`);
                        errorCount++;
                    }
                } catch (e) {
                    console.warn(`QuickLog-Solo: Failed to parse line during import: "${line}"`, e);
                    errorCount++;
                }
            }

            // Level 1: Fatal Error (Empty file or all lines failed)
            if (total === 0 || (validItems.length === 0 && total > 0)) {
                throw new Error('FATAL_IMPORT_ERROR');
            }

            // Level 2: Partial Error (Some lines failed)
            if (errorCount > 0) {
                const proceed = await showConfirm(t('import-err-partial', { total, errorCount, validCount: validItems.length }));
                if (!proceed) {
                    return;
                }
            }

            const finalItems = validItems;

            const importMode = document.querySelector('input[name="import-mode"]:checked')?.value || 'append';

            if (importMode === 'overwrite') {
                if (!(await showConfirm(t('confirm-import-overwrite')))) {
                    return;
                }
            }

            setImporting(true);
            await dbImportCategories(finalItems, importMode);

            // Artificial delay to ensure visual feedback as per UI standards
            await new Promise(resolve => setTimeout(resolve, IMPORT_FEEDBACK_DELAY_MS));

            showToast(t('toast-cat-imported'));
            renderCategories();
            renderCategoryEditor();
            broadcastSync();
        } catch (err) {
            if (err.message === 'FATAL_IMPORT_ERROR') {
                alert(t('import-err-fatal'));
            } else if (err.name === 'NotAllowedError') {
                console.warn('Clipboard access denied');
                alert(t('alert-import-error') + '\n(Clipboard access denied)');
            } else {
                console.error('Failed to import categories:', err);
                alert(t('alert-import-error'));
            }
        } finally {
            setImporting(false);
        }
    });

    // CSV and Maintenance helpers
    async function performMaintenanceAction(confirmMessage, action) {
        if (await showConfirm(confirmMessage)) {
            if (activeTask) {
                await stopTask();
                updateUI();
            }
            await action();
        }
    }

    getEl(ID_EXPORT_CSV_BTN)?.addEventListener('click', () => {
        performMaintenanceAction(t('confirm-export-csv'), async () => {
            const logs = await dbGetAll(STORE_LOGS);
            let csv = CSV_HEADER;
            logs.forEach(l => { csv += `${l.id},${escapeCsv(l.category)},${l.startTime},${l.endTime}\n`; });
            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
            const a = createEl('a');
            a.href = url;
            a.download = `quicklog_backup_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
        });
    });

    const csvInput = getEl(ID_CSV_FILE_INPUT);
    getEl(ID_IMPORT_CSV_BTN)?.addEventListener('click', () => {
        performMaintenanceAction(t('confirm-import-csv'), async () => {
            csvInput?.click();
        });
    });

    csvInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Security: Limit file size (e.g., 5MB for CSV history)
            if (file.size > 5 * 1024 * 1024) {
                alert(t('alert-import-error') + '\n(File too large)');
                return;
            }

            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '').slice(1);

            // Security: Limit number of lines
            if (lines.length > 50000) {
                alert(t('alert-import-error') + '\n(Too many lines)');
                return;
            }
            if (lines.length === 0) return;

            const existingLogs = await dbGetAll(STORE_LOGS);
            // Optimization: Create a Set of keys for O(1) duplicate lookup
            const existingKeys = new Set(existingLogs.map(l => `${l.category}|${l.startTime}`));
            const importedKeys = new Set(); // To prevent duplicates within the same CSV

            const now = Date.now();
            const FUTURE_BUFFER = 5 * 60 * 1000; // 5 minutes allowance

            const validRows = [];
            let errorCount = 0;
            let duplicateCount = 0;

            for (const line of lines) {
                const parts = parseCsvLine(line);
                if (parts.length < 3) {
                    errorCount++;
                    continue;
                }
                const [, category, startStr, endStr] = parts;
                const startTime = parseInt(startStr, 10);
                const rawEndTime = endStr ? parseInt(endStr, 10) : null;
                const endTime = isNaN(rawEndTime) ? null : rawEndTime;

                // 1. Basic Validation
                if (!category || isNaN(startTime)) {
                    errorCount++;
                    continue;
                }

                // 2. Logical Range Validation
                if (endTime !== null && endTime < startTime) {
                    errorCount++;
                    continue;
                }

                // 3. Future Timestamp Validation
                if (startTime > now + FUTURE_BUFFER) {
                    errorCount++;
                    continue;
                }

                // 4. Duplicate Check (exact match of category and startTime)
                const recordKey = `${category}|${startTime}`;
                if (existingKeys.has(recordKey) || importedKeys.has(recordKey)) {
                    duplicateCount++;
                    continue;
                }

                validRows.push({
                    category,
                    startTime,
                    endTime: endTime
                });
                importedKeys.add(recordKey);
            }

            if (validRows.length === 0) {
                if (duplicateCount > 0 && errorCount === 0) {
                    alert(t('toast-imported') + ` (${duplicateCount} duplicates skipped)`);
                } else {
                    alert(t('import-err-fatal'));
                }
                return;
            }

            if (errorCount > 0) {
                const proceed = await showConfirm(t('import-err-partial', {
                    total: lines.length,
                    errorCount,
                    validCount: validRows.length
                }));
                if (!proceed) return;
            }

            // Optimization: Batch insertion in a single transaction
            await dbAddMultiple(STORE_LOGS, validRows);

            updateUI();
            broadcastSync('reload');
            showToast(t('toast-imported'));
        } catch (err) {
            console.error('QuickLog-Solo: History import failed', err);
            alert(t('alert-import-error'));
        } finally {
            e.target.value = '';
        }
    });

    getEl(ID_CLEAR_LOGS_BTN)?.addEventListener('click', () => {
        performMaintenanceAction(t('confirm-clear-logs'), async () => {
            await dbClear(STORE_LOGS);
            updateUI();
            broadcastSync('reload');
            showToast(t('toast-deleted'));
        });
    });

    getEl(ID_RESET_CAT_SETTINGS_BTN)?.addEventListener('click', () => {
        performMaintenanceAction(t('confirm-reset-all'), async () => {
            await dbClear(STORE_CATEGORIES);
            await dbClear(STORE_SETTINGS);
            broadcastSync('reload');
            location.reload();
        });
    });

    getEl(ID_RESET_SETTINGS_BTN)?.addEventListener('click', () => {
        performMaintenanceAction(t('confirm-reset-settings'), async () => {
            await dbClear(STORE_SETTINGS);
            broadcastSync('reload');
            location.reload();
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('QuickLog-Solo: DOMContentLoaded');
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
        console.log('QuickLog-Solo: Initializing DB...');
        await initDB();
        console.log('QuickLog-Solo: DB Initialized');

        initAnimationEngine();
        await backupManager.init();
        setupBroadcastChannel();
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
        syncTimeout = setTimeout(() => {
            if (document.visibilityState === 'visible') {
                syncState();
            }
        }, 100);
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            delayedSync();
        }
    });
    window.addEventListener('focus', delayedSync);
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
        const newLog = {
            category: testCat,
            startTime: startTime,
            endTime: null,
            resumableCategory: resumable
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
