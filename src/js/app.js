import {
    initDB, getCurrentAppState, dbGet, dbGetAll, dbPut, dbAdd, dbDelete, dbClear,
    setDatabaseName, DB_NAME,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS,
    SETTING_KEY_THEME, SETTING_KEY_FONT, SETTING_KEY_ANIMATION, SETTING_KEY_LANGUAGE
} from './db.js';
import { t, setLanguage, getLanguage, applyLanguage, detectBrowserLanguage } from './i18n.js';
import { formatDuration, formatLogDuration, startTaskLogic, stopTaskLogic, pauseTaskLogic } from './logic.js';
import { escapeHtml, escapeCsv, parseCsvLine, isValidCategoryName, SYSTEM_CATEGORY_IDLE } from './utils.js';
import { AnimationEngine } from './animations.js';
import { animations } from './animation_registry.js';

// QuickLog-Solo: Main Application Entry

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
const ID_ELAPSED_TIME_OVERLAY = 'elapsed-time-overlay';
const ID_STATUS_LABEL = 'status-label';
const ID_STATUS_LABEL_OVERLAY = 'status-label-overlay';
const ID_CURRENT_TASK_NAME = 'current-task-name';
const ID_CURRENT_TASK_NAME_OVERLAY = 'current-task-name-overlay';
const ID_PAUSE_BTN = 'pause-btn';
const ID_END_BTN = 'end-btn';
const ID_CURRENT_TASK_DISPLAY = 'current-task-display';
const ID_CURRENT_TASK_DISPLAY_OVERLAY = 'current-task-display-overlay';
const ID_TOAST = 'toast';
const ID_CONFIRM_MODAL = 'confirm-modal';
const ID_CONFIRM_MESSAGE = 'confirm-message';
const ID_CONFIRM_OK_BTN = 'confirm-ok-btn';
const ID_CONFIRM_CANCEL_BTN = 'confirm-cancel-btn';
const ID_VERSION_DISPLAY = 'version-display';
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
const ID_CATEGORY_FILE_INPUT = 'category-file-input';
const ID_CLEAR_LOGS_BTN = 'clear-logs-btn';
const ID_RESET_CAT_SETTINGS_BTN = 'reset-cat-settings-btn';
const ID_RESET_SETTINGS_BTN = 'reset-settings-btn';

let activeTask = null;
let timerInterval = null;
let syncChannel = null;
let syncTimeout = null;
let currentCategoryPage = 0;
let currentAnimationType = 'matrix_code';
let lastCategoryRenderData = null;
let animationEngine = null;
let currentActiveAnimation = null;
let isAppInitialized = false;

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
    const cat = await dbGet(STORE_CATEGORIES, categoryName);
    const color = cat ? cat.color : null;
    const meta = cat ? (cat.meta || '') : '';
    activeTask = await startTaskLogic(categoryName, activeTask, resumableCategory, color, meta);
    updateUI();
    broadcastSync();
}

async function pauseTask() {
    if (syncTimeout) clearTimeout(syncTimeout);
    activeTask = await pauseTaskLogic(activeTask);
    updateUI();
    broadcastSync();
}

async function stopTask() {
    if (syncTimeout) clearTimeout(syncTimeout);
    activeTask = await stopTaskLogic(activeTask, true);
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

function updateTimer() {
    if (!activeTask) {
        if (timerInterval) clearInterval(timerInterval);
        return;
    }

    const elapsed = Date.now() - activeTask.startTime;
    const timeStr = formatDuration(elapsed).toString();

    const elements = [ID_ELAPSED_TIME, ID_ELAPSED_TIME_OVERLAY];
    elements.forEach(id => {
        const el = getEl(id);
        if (el) el.textContent = timeStr;
    });

    const isPaused = activeTask.category === SYSTEM_CATEGORY_IDLE;

    const overlay = getEl(ID_CURRENT_TASK_DISPLAY_OVERLAY);

    if (isPaused) {
        if (overlay) overlay.style.clipPath = 'inset(0 100% 0 0)';
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

    const overlay = getEl(ID_CURRENT_TASK_DISPLAY_OVERLAY);
    const display = getEl(ID_CURRENT_TASK_DISPLAY);

    // All animations are now canvas-based for consistency
    if (overlay) overlay.style.clipPath = 'inset(0 100% 0 0)';

    if (animationEngine && activeTask && activeTask.category !== SYSTEM_CATEGORY_IDLE && activeAnimation !== 'none') {
        const colorCode = getColorCode(color);
        const animStateKey = `${activeAnimation}-${activeTask.startTime}-${colorCode}`;
        if (currentActiveAnimation !== animStateKey) {
            animationEngine.start(activeAnimation, activeTask.startTime, colorCode);
            currentActiveAnimation = animStateKey;
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

async function renderCategories() {
    let categories;
    try {
        categories = await dbGetAll(STORE_CATEGORIES);
    } catch (e) {
        console.error('Failed to get categories:', e);
        return;
    }
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));

    const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE) || 1;
    if (currentCategoryPage >= totalPages) currentCategoryPage = totalPages - 1;

    const start = currentCategoryPage * ITEMS_PER_PAGE;
    const pageCategories = categories.slice(start, start + ITEMS_PER_PAGE);

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
    list.innerHTML = '';

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
    container.innerHTML = '';

    for (let i = 0; i < totalPages; i++) {
        const dot = createEl('div');
        dot.className = 'pagination-dot' + (i === currentCategoryPage ? ' active' : '');
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
    logList.innerHTML = '';

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

    let timeRangeHtml;
    if (log.isManualStop) {
        timeRangeHtml = `<span class="log-time"><span style="visibility:hidden">${startTimeStr}</span>-${endTimeStr}</span>`;
    } else if (log.endTime) {
        timeRangeHtml = `<span class="log-time">${startTimeStr}-${endTimeStr}</span>`;
    } else {
        timeRangeHtml = `<span class="log-time">${startTimeStr}-<span style="visibility:hidden">${startTimeStr}</span></span>`;
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

    const metaHtml = (log.meta) ? `<span class="log-meta">[${escapeHtml(log.meta)}]</span>` : '';

    li.innerHTML = `
        ${timeRangeHtml}
        <span class="log-name"><span class="category-dot ${colorClass}"></span>${escapeHtml(displayName)}${metaHtml}</span>
        <span class="log-duration">${durationText}</span>
    `;
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
        animations.forEach(anim => {
            animationEngine.register(anim.id, anim.class, anim.id);
        });
        animationEngine.resize();
        updateAnimationExclusionAreas();
        window.addEventListener('resize', () => {
            animationEngine.resize();
            updateAnimationExclusionAreas();
        });
    }
}

function setupBroadcastChannel() {
    syncChannel = new BroadcastChannel(`${SYNC_CHANNEL_NAME}_${DB_NAME}`);
    syncChannel.onmessage = (event) => {
        console.log('QuickLog-Solo: Received sync message', event.data);
        if (event.data.type === 'reload') {
            location.reload();
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
}

async function syncState() {
    if (!isAppInitialized) return;
    const state = await getCurrentAppState();
    activeTask = state.activeTask;

    const lang = state.language || 'auto';
    setLanguage(lang);
    applyLanguage();

    applyTheme(state.theme || THEME_SYSTEM);

    const langSelect = getEl(ID_LANGUAGE_SELECT);
    if (langSelect) langSelect.value = state.language || 'auto';

    // Update Animation options
    currentAnimationType = state.animation || 'matrix_code';
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
        const cat = await dbGet(STORE_CATEGORIES, activeTask.category);
        color = cat ? cat.color : (activeTask.color || 'primary');
        categoryAnimation = cat ? (cat.animation || 'default') : 'default';
    }
    applyAnimation(state.animation || 'matrix_code', categoryAnimation, color);

    await updateUI();

    // Settings popup logic: Refresh category editor if the categories tab is active
    const settingsPopup = getEl(ID_SETTINGS_POPUP);
    if (settingsPopup && !settingsPopup.classList.contains('hidden')) {
        const categoriesTab = getEl('categories-tab');
        if (categoriesTab && !categoriesTab.classList.contains('hidden')) {
            await renderCategoryEditor();
        }
    }
}

function updateAnimationSelect() {
    const animSelect = getEl(ID_ANIMATION_SELECT);
    if (animSelect) {
        const currentLang = getLanguage();
        animSelect.innerHTML = '';

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
            if (anim.metadata.description) {
                if (typeof anim.metadata.description === 'object') {
                    opt.title = anim.metadata.description[currentLang] || anim.metadata.description['en'] || '';
                } else {
                    opt.title = anim.metadata.description;
                }
            }
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

        fontSelect.innerHTML = '';
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
        statusLabelOverlay: getEl(ID_STATUS_LABEL_OVERLAY),
        currentTaskName: getEl(ID_CURRENT_TASK_NAME),
        currentTaskNameOverlay: getEl(ID_CURRENT_TASK_NAME_OVERLAY),
        pauseBtn: getEl(ID_PAUSE_BTN),
        endBtn: getEl(ID_END_BTN),
        elapsedTime: getEl(ID_ELAPSED_TIME),
        elapsedTimeOverlay: getEl(ID_ELAPSED_TIME_OVERLAY),
        display: getEl(ID_CURRENT_TASK_DISPLAY),
        overlay: getEl(ID_CURRENT_TASK_DISPLAY_OVERLAY)
    };

    if (activeTask) {
        let color;
        let categoryAnimation;
        const isPaused = activeTask.category === SYSTEM_CATEGORY_IDLE;

        if (isPaused) {
            color = 'neutral';
        } else {
            const cat = await dbGet(STORE_CATEGORIES, activeTask.category);
            color = cat ? cat.color : (activeTask.color || 'primary');
            categoryAnimation = cat ? cat.animation : 'default';
        }

        if (elements.display) elements.display.className = `cat-${color}`;
        if (elements.overlay) elements.overlay.className = `cat-${color}-full`;

        const iconName = isPaused ? 'pause' : 'play_arrow';
        const statusClass = isPaused ? 'status-paused' : 'status-running';
        [elements.statusLabel, elements.statusLabelOverlay].forEach(el => {
            if (el) {
                el.textContent = iconName;
                el.className = `material-symbols-outlined ${statusClass}`;
                if (isPaused) {
                    el.classList.add('blink');
                } else {
                    el.classList.remove('blink');
                }
            }
        });
        const displayCategoryName = isPaused ? t('idle-category') : activeTask.category;
        const nameElements = [getEl('current-task-name-text'), getEl('current-task-name-text-overlay')];
        nameElements.forEach(el => { if (el) el.textContent = displayCategoryName; });

        if (elements.pauseBtn) {
            if (isPaused) {
                elements.pauseBtn.innerHTML = `<span class="material-symbols-outlined btn-icon">play_arrow</span><span class="btn-text">${t('resume')}</span>`;
                elements.pauseBtn.disabled = !activeTask.resumableCategory;
            } else {
                elements.pauseBtn.innerHTML = `<span class="material-symbols-outlined btn-icon">pause</span><span class="btn-text">${t('pause')}</span>`;
                elements.pauseBtn.disabled = false;
            }
        }
        if (elements.endBtn) elements.endBtn.disabled = false;

        [elements.elapsedTime, elements.elapsedTimeOverlay].forEach(el => {
            if (el) {
                el.classList.remove('hidden');
                el.style.visibility = isPaused ? 'hidden' : 'visible';
            }
        });
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
        if (elements.overlay) elements.overlay.className = '';
        [elements.statusLabel, elements.statusLabelOverlay].forEach(el => {
            if (el) {
                el.textContent = 'stop';
                el.className = 'material-symbols-outlined status-stopped';
            }
        });
        const nameElements = [getEl('current-task-name-text'), getEl('current-task-name-text-overlay')];
        nameElements.forEach(el => { if (el) el.textContent = '-'; });

        if (elements.pauseBtn) {
            elements.pauseBtn.disabled = true;
            elements.pauseBtn.innerHTML = `<span class="material-symbols-outlined btn-icon">pause</span><span class="btn-text">${t('pause')}</span>`;
        }
        if (elements.endBtn) elements.endBtn.disabled = true;

        [elements.elapsedTime, elements.elapsedTimeOverlay].forEach(el => {
            if (el) {
                el.classList.add('hidden');
                el.textContent = '00:00:00';
                el.style.visibility = 'visible';
            }
        });
        if (elements.overlay) elements.overlay.style.clipPath = 'inset(0 0 0 100%)';
        document.title = 'QuickLog-Solo';
    }
}

// --- Action Logic ---

async function copyReport() {
    const allLogs = await dbGetAll(STORE_LOGS);
    const today = new Date().setHours(0,0,0,0);
    const todayLogs = allLogs.filter(l => l.startTime >= today && l.endTime);

    let text = "";
    todayLogs.forEach(l => {
        const start = new Date(l.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        text += `${start} | ${l.category}\n`;
    });

    navigator.clipboard.writeText(text);
    showToast(t('toast-copied'));
}

async function copyAggregation() {
    const allLogs = await dbGetAll(STORE_LOGS);
    const today = new Date().setHours(0,0,0,0);
    const todayLogs = allLogs.filter(l => l.startTime >= today && l.endTime);

    const agg = {};
    todayLogs.forEach(l => {
        const dur = (l.endTime - l.startTime) / 60000;
        agg[l.category] = (agg[l.category] || 0) + dur;
    });

    let text = "";
    for (const cat in agg) {
        text += `${cat} | ${Math.round(agg[cat])} min\n`;
    }

    navigator.clipboard.writeText(text);
    showToast(t('toast-copied'));
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

async function renderCategoryEditor() {
    const list = getEl(ID_CATEGORY_EDITOR_LIST);
    if (!list) return;
    let categories = await dbGetAll(STORE_CATEGORIES);
    categories = categories.filter(c => c.name !== SYSTEM_CATEGORY_IDLE).sort((a, b) => a.order - b.order);
    list.innerHTML = '';

    categories.forEach(cat => {
        const item = createEl('div');
        item.className = 'category-editor-item';
        item.draggable = true;
        item.dataset.name = cat.name;

        const colors = [
            'primary', 'secondary', 'tertiary', 'error', 'neutral', 'outline',
            'teal', 'green', 'yellow', 'orange', 'pink', 'indigo', 'brown', 'cyan'
        ];
        const colorPresetsHtml = colors.map(color => `
            <button class="color-preset ${color === cat.color ? 'selected' : ''}"
                    style="background-color: ${getColorCode(color)}"
                    data-color="${color}"></button>
        `).join('');

        const lang = getEl(ID_LANGUAGE_SELECT)?.value === 'auto' ? detectBrowserLanguage() : getEl(ID_LANGUAGE_SELECT)?.value || 'en';
        const getAnimLabel = (anim) => {
            if (typeof anim.metadata.name === 'object') {
                return anim.metadata.name[lang] || anim.metadata.name['en'] || anim.id;
            }
            return anim.metadata.name;
        };

        const animOptions = [
            { value: 'none', label: t('anim-none'), description: '' },
            { value: 'default', label: t('anim-default'), description: '' },
            ...animations.map(anim => {
                let desc = '';
                if (anim.metadata.description) {
                    desc = (typeof anim.metadata.description === 'object')
                        ? (anim.metadata.description[lang] || anim.metadata.description['en'] || '')
                        : anim.metadata.description;
                }
                return { value: anim.id, label: getAnimLabel(anim), description: desc };
            })
        ];

        const animSelectHtml = `
            <select class="category-edit-animation" style="flex: 1; font-size: 0.75rem; padding: 2px 4px; border-radius: 4px;">
                ${animOptions.map(opt => `<option value="${opt.value}" ${cat.animation === opt.value ? 'selected' : ''} title="${escapeHtml(opt.description)}">${escapeHtml(opt.label)}</option>`).join('')}
            </select>
        `;

        item.innerHTML = `
            <div class="cat-editor-row">
                <span class="material-symbols-outlined drag-handle" style="cursor: grab;">drag_indicator</span>
                <input type="text" class="category-edit-name" value="${escapeHtml(cat.name)}">
                <button class="delete-cat-btn" title="${t('delete')}" style="border:none; background:none; padding:0; display:flex; align-items:center; justify-content:center;">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
            <div class="cat-editor-row" style="margin-top: 0.5rem; align-items: center;">
                <div class="color-presets" style="margin-left: 2rem; flex: 1;">
                    ${colorPresetsHtml}
                </div>
                <input type="text" class="category-edit-meta" value="${escapeHtml(cat.meta || '')}" data-i18n-placeholder="placeholder-meta" placeholder="${t('placeholder-meta')}" style="width: 120px; font-size: 0.75rem; margin-right: 0.5rem;">
                ${animSelectHtml}
            </div>
        `;

        // Event listeners
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
                const existing = await dbGet(STORE_CATEGORIES, newName);
                if (existing) {
                    alert(t('alert-duplicate-category'));
                    input.value = oldName;
                    return;
                }
                const updatedCat = { ...cat, name: newName };
                await dbDelete(STORE_CATEGORIES, oldName);
                await dbPut(STORE_CATEGORIES, updatedCat);

                const allLogs = await dbGetAll(STORE_LOGS);
                for (const log of allLogs) {
                    if (log.category === oldName) {
                        log.category = newName;
                        await dbPut(STORE_LOGS, log);
                    }
                }
                updateUI();
                renderCategoryEditor();
                broadcastSync();
            }
        };

        item.querySelectorAll('.color-preset').forEach(btn => {
            btn.onclick = async () => {
                cat.color = btn.dataset.color;
                await dbPut(STORE_CATEGORIES, cat);
                renderCategoryEditor();
                renderCategories();
                broadcastSync();
            };
        });

        const animSelect = item.querySelector('.category-edit-animation');
        animSelect.onchange = async () => {
            cat.animation = animSelect.value;
            await dbPut(STORE_CATEGORIES, cat);
            broadcastSync();
        };

        const metaInput = item.querySelector('.category-edit-meta');
        metaInput.onchange = async () => {
            cat.meta = metaInput.value.trim();
            await dbPut(STORE_CATEGORIES, cat);
            broadcastSync();
        };

        item.querySelector('.delete-cat-btn').onclick = async () => {
            if (await showConfirm(t('confirm-delete-category', { name: cat.name }))) {
                await dbDelete(STORE_CATEGORIES, cat.name);
                updateUI();
                renderCategoryEditor();
                broadcastSync();
            }
        };

        item.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', cat.name);
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
        for (let i = 0; i < items.length; i++) {
            const name = items[i].dataset.name;
            const cat = await dbGet(STORE_CATEGORIES, name);
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
    getEl(ID_COPY_REPORT_BTN)?.addEventListener('click', copyReport);
    getEl(ID_COPY_AGGREGATION_BTN)?.addEventListener('click', copyAggregation);

    // Category Wheel Pagination
    const categorySection = getEl(ID_CATEGORY_SECTION);
    categorySection?.addEventListener('wheel', (e) => {
        e.preventDefault();
        dbGetAll(STORE_CATEGORIES).then(categories => {
            const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE) || 1;
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
        settings: getEl(ID_SETTINGS_POPUP)
    };

    getEl(ID_SETTINGS_TOGGLE)?.addEventListener('click', () => popups.settings?.classList.remove('hidden'));

    queryAll('.close-btn').forEach(btn => {
        btn.onclick = () => Object.values(popups).forEach(p => p?.classList.add('hidden'));
    });

    window.onclick = (event) => {
        Object.values(popups).forEach(p => { if (event.target === p) p.classList.add('hidden'); });
    };

    // Tabs
    queryAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            queryAll('.tab-btn').forEach(b => b.classList.remove('active'));
            queryAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            const target = getEl(`${btn.dataset.tab}-tab`);
            if (target) target.classList.remove('hidden');
            if (btn.dataset.tab === 'categories') renderCategoryEditor();
        };
    });

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
        broadcastSync();
    });


    const fontSelect = getEl(ID_FONT_SELECT);
    if (fontSelect) {
        updateFontSelect();
        fontSelect.onchange = async (e) => {
            const fontValue = e.target.value;
            await dbPut(STORE_SETTINGS, { key: SETTING_KEY_FONT, value: fontValue });
            applyFont(fontValue);
            broadcastSync();
        };
    }

    const animSelect = getEl(ID_ANIMATION_SELECT);
    if (animSelect) {
        updateAnimationSelect();

        animSelect.onchange = async (e) => {
            const animType = e.target.value;
            currentAnimationType = animType;
            await dbPut(STORE_SETTINGS, { key: SETTING_KEY_ANIMATION, value: animType });
            await updateUI();
            broadcastSync();
        };
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
            await dbPut(STORE_CATEGORIES, { name, color: 'primary', order: categories.length });
            if (input) input.value = '';
            renderCategories();
            renderCategoryEditor();
            broadcastSync();
        }
    });

    // Category Import/Export
    getEl(ID_EXPORT_CATEGORIES_BTN)?.addEventListener('click', async () => {
        const categories = await dbGetAll(STORE_CATEGORIES);
        // Exclude system idle category from export just in case it's in the store (it shouldn't be, but good to be safe)
        const exportData = categories.filter(c => c.name !== SYSTEM_CATEGORY_IDLE);
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = createEl('a');
        a.href = url;
        a.download = `quicklog_categories_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    });

    const categoryFileInput = getEl(ID_CATEGORY_FILE_INPUT);
    getEl(ID_IMPORT_CATEGORIES_BTN)?.addEventListener('click', () => {
        categoryFileInput?.click();
    });

    categoryFileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedCategories = JSON.parse(text);

            if (!Array.isArray(importedCategories)) {
                throw new Error('Invalid format: expected an array of categories.');
            }

            const importMode = document.querySelector('input[name="import-mode"]:checked')?.value || 'append';

            if (importMode === 'overwrite') {
                if (await showConfirm(t('confirm-import-overwrite'))) {
                    await dbClear(STORE_CATEGORIES);
                } else {
                    categoryFileInput.value = '';
                    return;
                }
            }

            const currentCategories = await dbGetAll(STORE_CATEGORIES);
            let maxOrder = currentCategories.reduce((max, c) => Math.max(max, c.order || 0), -1);

            for (const cat of importedCategories) {
                if (cat.name && isValidCategoryName(cat.name)) {
                    // Check for duplicates in append mode
                    if (importMode === 'append') {
                        const existing = await dbGet(STORE_CATEGORIES, cat.name);
                        if (existing) continue;
                    }

                    await dbPut(STORE_CATEGORIES, {
                        name: cat.name,
                        color: cat.color || 'primary',
                        order: cat.order !== undefined ? cat.order : ++maxOrder
                    });
                }
            }

            categoryFileInput.value = '';
            showToast(t('toast-cat-imported'));
            renderCategories();
            renderCategoryEditor();
            broadcastSync();
        } catch (err) {
            console.error('Failed to import categories:', err);
            alert(t('alert-import-error'));
            categoryFileInput.value = '';
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
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '').slice(1);
        for (const line of lines) {
            const parts = parseCsvLine(line);
            if (parts.length >= 3) {
                const [, category, startTime, endTime] = parts;
                if (category && startTime) {
                    await dbPut(STORE_LOGS, {
                        category,
                        startTime: parseInt(startTime),
                        endTime: endTime ? parseInt(endTime) : null
                    });
                }
            }
        }
        updateUI();
        broadcastSync('reload');
        alert(t('toast-imported'));
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
        console.log(`QuickLog-Solo: Using custom database: ${dbParam}`);
        setDatabaseName(dbParam);
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
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }
}
