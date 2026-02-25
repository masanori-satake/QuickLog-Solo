import {
    initDB, dbGet, dbGetAll, dbPut, dbAdd, dbDelete, dbClear,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS,
    SETTING_KEY_THEME, SETTING_KEY_ACCENT, SETTING_KEY_FONT, SETTING_KEY_LAYOUT
} from './js/db.js';
import { formatDuration, getAnimationState, startTaskLogic, stopTaskLogic, pauseTaskLogic } from './js/logic.js';
import { escapeHtml, escapeCsv, parseCsvLine, isValidCategoryName, SYSTEM_CATEGORY_IDLE, isStoragePersisted, requestStoragePersistence } from './js/utils.js';

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").then((reg) => {
            console.log('QuickLog-Solo: SW registered', reg);
        }).catch((err) => {
            console.error('QuickLog-Solo: SW registration failed', err);
        });
    });
}

// QuickLog-Solo: Main Application Entry

// Constants
const LAYOUT_HORIZONTAL = 'horizontal';
const LAYOUT_VERTICAL = 'vertical';

const THEME_SYSTEM = 'system';

const MSG_TYPE_PING = 'PING';
const MSG_TYPE_PONG = 'PONG';
const MSG_TYPE_FOCUS = 'FOCUS';

const URL_PARAM_ACTION = 'action';
const URL_PARAM_TEST_LAYOUT = 'test_layout';
const URL_PARAM_TEST_CAT = 'test_cat';
const URL_PARAM_TEST_ELAPSED = 'test_elapsed';
const URL_PARAM_TEST_RESUMABLE = 'test_resumable';

const ACTION_SETTINGS = 'settings';

const LOCAL_STORAGE_KEY_LAYOUT = 'quicklog_layout';
const CHANNEL_NAME = 'quicklog_instance_coordination';

const ITEMS_PER_PAGE = 8;
const MAX_LOGS_DISPLAY = 5;
const TOAST_DURATION_MS = 2000;

const WINDOW_WIDTH_HORIZONTAL = 650;
const WINDOW_HEIGHT_HORIZONTAL = 360;
const WINDOW_WIDTH_VERTICAL = 280;
const WINDOW_HEIGHT_VERTICAL = 500;

const CSV_HEADER = "id,category,startTime,endTime\n";

const ID_APP = 'app';
const ID_SETTINGS_POPUP = 'settings-popup';
const ID_SETTINGS_TOGGLE = 'settings-toggle';
const ID_THEME_SELECT = 'theme-select';
const ID_FONT_SELECT = 'font-select';
const ID_LAYOUT_TOGGLE = 'layout-toggle';
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
const ID_STORAGE_PERSISTENCE_DISPLAY = 'storage-persistence-display';
const ID_CATEGORY_EDITOR_LIST = 'category-editor-list';
const ID_NEW_CATEGORY_NAME_SETTINGS = 'new-category-name-settings';
const ID_PIP_TOGGLE = 'pip-toggle';
const ID_COPY_REPORT_BTN = 'copy-report-btn';
const ID_COPY_AGGREGATION_BTN = 'copy-aggregation-btn';
const ID_CATEGORY_SECTION = 'category-section';
const ID_ADD_CATEGORY_BTN_SETTINGS = 'add-category-btn-settings';
const ID_EXPORT_CSV_BTN = 'export-csv-btn';
const ID_IMPORT_CSV_BTN = 'import-csv-btn';
const ID_CSV_FILE_INPUT = 'csv-file-input';
const ID_CLEAR_LOGS_BTN = 'clear-logs-btn';
const ID_RESET_CAT_SETTINGS_BTN = 'reset-cat-settings-btn';
const ID_RESET_SETTINGS_BTN = 'reset-settings-btn';

let activeTask = null;
let timerInterval = null;
let currentCategoryPage = 0;
let pipWindow = null;
let originalBounds = null;

const getEl = (id) => (pipWindow ? pipWindow.document : document).getElementById(id);
const queryAll = (selector) => (pipWindow ? pipWindow.document : document).querySelectorAll(selector);
const getBody = () => (pipWindow ? pipWindow.document : document).body;
const createEl = (tag) => (pipWindow ? pipWindow.document : document).createElement(tag);

const instanceChannel = new BroadcastChannel(CHANNEL_NAME);

const FONTS = [
    { name: '標準', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    { name: 'メイリオ', value: '"Meiryo", sans-serif' },
    { name: '游ゴシック', value: '"Yu Gothic", "YuGothic", sans-serif' },
    { name: 'ヒラギノ角ゴ', value: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif' },
    { name: 'MS Pゴシック', value: '"MS PGothic", sans-serif' },
    { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Courier New', value: '"Courier New", monospace' },
    { name: 'Impact', value: 'Impact, charcoal, sans-serif' },
    { name: 'Comic Sans MS', value: '"Comic Sans MS", cursive, sans-serif' }
];

// --- Single-Instance Coordination ---
(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get(URL_PARAM_ACTION);

    let otherInstanceFound = false;
    const pingPromise = new Promise(resolve => {
        const handler = (e) => {
            if (e.data.type === MSG_TYPE_PONG) {
                otherInstanceFound = true;
                resolve();
            }
        };
        instanceChannel.addEventListener('message', handler);
        setTimeout(() => {
            instanceChannel.removeEventListener('message', handler);
            resolve();
        }, 500);
    });

    instanceChannel.postMessage({ type: MSG_TYPE_PING });
    await pingPromise;

    if (otherInstanceFound) {
        instanceChannel.postMessage({ type: MSG_TYPE_FOCUS, action });
        window.close();
        document.addEventListener('DOMContentLoaded', () => {
            getBody().innerHTML = '<div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; font-weight:bold; text-align:center; padding:2rem;">' +
                '<div>既に QuickLog-Solo が起動しています。</div>' +
                '<div style="font-size:0.8rem; margin-top:1rem; color:gray;">既存のウィンドウを確認してください。</div>' +
                '</div>';
        });
        throw new Error('Duplicate instance detected.');
    }
})();

instanceChannel.onmessage = (event) => {
    const { type, action } = event.data;
    if (type === MSG_TYPE_PING) {
        instanceChannel.postMessage({ type: MSG_TYPE_PONG });
    } else if (type === MSG_TYPE_FOCUS) {
        window.focus();
        if (action === ACTION_SETTINGS) {
            getEl(ID_SETTINGS_POPUP)?.classList.remove('hidden');
        }
    }
};

// --- Task Control ---

async function togglePiP() {
    if (pipWindow) {
        pipWindow.close();
        return;
    }

    if (!('documentPictureInPicture' in window)) {
        return;
    }

    try {
        const app = getEl(ID_APP);

        // Record original window state
        originalBounds = {
            width: window.outerWidth,
            height: window.outerHeight,
            left: window.screenX,
            top: window.screenY
        };

        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 280,
            height: 200,
        });

        // Apply compact layout to PiP window
        pipWindow.document.body.classList.add('layout-pip');

        // Copy styles
        [...document.styleSheets].forEach((styleSheet) => {
            try {
                if (styleSheet.cssRules) {
                    const style = pipWindow.document.createElement('style');
                    const rules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
                    style.textContent = rules;
                    pipWindow.document.head.appendChild(style);
                }
            } catch {
                const link = pipWindow.document.createElement('link');
                link.rel = 'stylesheet';
                link.href = styleSheet.href;
                pipWindow.document.head.appendChild(link);
            }
        });

        pipWindow.document.body.append(app);

        // Shrink parent window
        window.resizeTo(200, 100);

        pipWindow.addEventListener('pagehide', () => {
            document.body.append(app);
            pipWindow = null;

            // Restore parent window
            if (originalBounds) {
                window.resizeTo(originalBounds.width, originalBounds.height);
                window.moveTo(originalBounds.left, originalBounds.top);
                originalBounds = null;
            }

            updateUI();
        });

        updateUI();

    } catch (err) {
        console.error('Failed to enter PiP mode:', err);
    }
}

function initPipSupport() {
    const pipBtn = getEl(ID_PIP_TOGGLE);
    if (!pipBtn) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isSupported = 'documentPictureInPicture' in window;

    if (!isSupported) {
        pipBtn.disabled = true;
        pipBtn.title = 'お使いのブラウザはピン留め機能をサポートしていません。';
    } else if (!isStandalone) {
        pipBtn.disabled = true;
        pipBtn.title = 'ピン留め機能はPWAとしてインストール後に利用可能です。';
    }
}

async function startTask(categoryName, resumableCategory = null) {
    activeTask = await startTaskLogic(categoryName, activeTask, resumableCategory);
    updateUI();
}

async function pauseTask() {
    activeTask = await pauseTaskLogic(activeTask);
    updateUI();
}

async function stopTask() {
    activeTask = await stopTaskLogic(activeTask, true);
}

async function endTask() {
    if (!activeTask) return;
    if (await showConfirm('本当に作業を終了しますか？')) {
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
    if (overlay) {
        if (isPaused) {
            overlay.style.clipPath = 'inset(0 100% 0 0)';
        } else {
            const anim = getAnimationState(activeTask.startTime);
            overlay.style.clipPath = anim.inset;
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

function applyAccent(accent) {
    const body = getBody();
    const accentClasses = ['accent-blue', 'accent-green', 'accent-orange', 'accent-red'];
    body.classList.remove(...accentClasses);
    body.classList.add(`accent-${accent}`);
}

function applyFont(fontValue) {
    getBody().style.setProperty('--font-family', fontValue);
    const select = getEl(ID_FONT_SELECT);
    if (select) select.value = fontValue;
}

function applyLayout(layout) {
    const body = getBody();
    body.classList.remove('layout-horizontal', 'layout-vertical');

    if (!layout) {
        layout = localStorage.getItem(LOCAL_STORAGE_KEY_LAYOUT) || (window.innerWidth >= WINDOW_WIDTH_HORIZONTAL ? LAYOUT_HORIZONTAL : LAYOUT_VERTICAL);
    }

    localStorage.setItem(LOCAL_STORAGE_KEY_LAYOUT, layout);
    body.classList.add(`layout-${layout}`);

    const btn = getEl(ID_LAYOUT_TOGGLE);
    if (btn) {
        const isHorizontal = layout === LAYOUT_HORIZONTAL;
        btn.textContent = isHorizontal ? '↕️' : '↔️';
        btn.title = isHorizontal ? '縦長レイアウトに切り替え' : '横長レイアウトに切り替え';

        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            window.resizeTo(isHorizontal ? WINDOW_WIDTH_HORIZONTAL : WINDOW_WIDTH_VERTICAL, isHorizontal ? WINDOW_HEIGHT_HORIZONTAL : WINDOW_HEIGHT_VERTICAL);
        }
    }
}

async function renderCategories() {
    console.log('QuickLog-Solo: Rendering categories...');
    let categories;
    try {
        categories = await dbGetAll(STORE_CATEGORIES);
    } catch (e) {
        console.error('Failed to get categories:', e);
        return;
    }
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));

    const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE);
    if (currentCategoryPage >= totalPages && totalPages > 0) {
        currentCategoryPage = totalPages - 1;
    }

    const list = getEl(ID_CATEGORY_LIST);
    if (!list) return;
    list.innerHTML = '';

    const start = currentCategoryPage * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = categories.slice(start, end);

    pageItems.forEach(cat => {
        const btn = createEl('button');
        btn.className = `category-btn cat-${cat.color || 'blue'}`;
        const isActive = activeTask && activeTask.category === cat.name;
        if (isActive) {
            btn.classList.add('active');
            btn.disabled = true;
        }
        btn.textContent = cat.name;
        btn.onclick = () => startTask(cat.name);
        list.appendChild(btn);
    });

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const container = getEl(ID_CATEGORY_PAGINATION);
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = '';
    const displayPages = Math.max(1, totalPages);
    for (let i = 0; i < displayPages; i++) {
        const dot = createEl('div');
        dot.className = 'page-dot' + (i === currentCategoryPage ? ' active' : '');
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
    const days = ['日', '月', '火', '水', '木', '金', '土'];

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
        // 停止時は開始時刻を隠し、終了時刻のみを表示
        timeRangeHtml = `<span class="log-time"><span style="visibility:hidden">${startTimeStr}</span>-${endTimeStr}</span>`;
    } else if (log.endTime) {
        // 通常の完了
        timeRangeHtml = `<span class="log-time">${startTimeStr}-${endTimeStr}</span>`;
    } else {
        // 実行中（終了時刻の場所に開始時刻と同じ長さの空白を確保してレイアウトを揃える）
        timeRangeHtml = `<span class="log-time">${startTimeStr}-<span style="visibility:hidden">${startTimeStr}</span></span>`;
    }

    const durationMs = log.endTime ? log.endTime - log.startTime : 0;
    let durationText = '';
    if (log.endTime && !log.isManualStop) {
        durationText = durationMs < 60000 ? `${Math.round(durationMs / 1000)}s` : `${Math.round(durationMs / 60000)}m`;
    }

    let colorClass = 'dot-gray';
    let displayName = log.category;

    if (log.isManualStop) {
        colorClass = 'dot-red';
        displayName = '終了';
    } else if (log.category === SYSTEM_CATEGORY_IDLE) {
        colorClass = 'dot-idle';
    } else {
        const cat = categoryMap.get(log.category);
        if (cat) colorClass = `dot-${cat.color}`;
    }

    li.innerHTML = `
        ${timeRangeHtml}
        <span class="log-name"><span class="category-dot ${colorClass}"></span>${escapeHtml(displayName)}</span>
        <span class="log-duration">${durationText}</span>
    `;
    return li;
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
        let color = 'blue';
        const isPaused = activeTask.category === SYSTEM_CATEGORY_IDLE;

        if (isPaused) {
            color = 'idle';
        } else {
            const cat = await dbGet(STORE_CATEGORIES, activeTask.category);
            if (cat) color = cat.color;
        }

        if (elements.display) elements.display.className = `cat-${color}`;
        if (elements.overlay) elements.overlay.className = `cat-${color}-full`;

        const label = isPaused ? '⏸' : '▶';
        const statusClass = isPaused ? 'status-paused' : 'status-running';
        [elements.statusLabel, elements.statusLabelOverlay].forEach(el => {
            if (el) {
                el.textContent = label;
                el.className = statusClass;
                if (isPaused) {
                    el.classList.add('blink');
                } else {
                    el.classList.remove('blink');
                }
            }
        });
        [elements.currentTaskName, elements.currentTaskNameOverlay].forEach(el => { if (el) el.textContent = activeTask.category; });

        if (elements.pauseBtn) {
            if (isPaused) {
                elements.pauseBtn.innerHTML = '<span class="btn-text">再開</span><span class="btn-icon">▶️</span>';
                elements.pauseBtn.disabled = !activeTask.resumableCategory;
            } else {
                elements.pauseBtn.innerHTML = '<span class="btn-text">一時停止</span><span class="btn-icon">⏸️</span>';
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
    } else {
        if (elements.display) elements.display.className = '';
        if (elements.overlay) elements.overlay.className = '';
        [elements.statusLabel, elements.statusLabelOverlay].forEach(el => {
            if (el) {
                el.textContent = '⏹';
                el.className = 'status-stopped';
            }
        });
        [elements.currentTaskName, elements.currentTaskNameOverlay].forEach(el => { if (el) el.textContent = '-'; });

        if (elements.pauseBtn) {
            elements.pauseBtn.disabled = true;
            elements.pauseBtn.innerHTML = '<span class="btn-text">一時停止</span><span class="btn-icon">⏸️</span>';
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
        if (!pipWindow) document.title = 'QuickLog-Solo';
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
    showToast('コピーしました！');
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
    showToast('コピーしました！');
}

function showToast(message = "完了しました！") {
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
    const codes = {
        blue: '#1e40af', green: '#166534', orange: '#9a3412',
        red: '#991b1b', purple: '#6b21a8', teal: '#115e59', gray: '#374151'
    };
    return codes[color] || '#333';
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

        const colors = ['blue', 'green', 'orange', 'red', 'purple', 'teal', 'gray'];
        const colorPresetsHtml = colors.map(color => `
            <button class="color-preset ${color === cat.color ? 'selected' : ''}"
                    style="background-color: ${getColorCode(color)}"
                    data-color="${color}"></button>
        `).join('');

        item.innerHTML = `
            <div class="cat-editor-row">
                <span class="drag-handle">☰</span>
                <input type="text" class="category-edit-name">
                <button class="delete-cat-btn" title="削除">×</button>
            </div>
            <div class="cat-editor-row">
                <div class="color-presets" style="margin-left: 1.5rem;">
                    ${colorPresetsHtml}
                </div>
            </div>
        `;

        // Event listeners
        const input = item.querySelector('.category-edit-name');
        input.value = cat.name;
        input.onchange = async () => {
            const newName = input.value.trim();
            if (newName && newName !== cat.name) {
                if (!isValidCategoryName(newName)) {
                    alert(`無効なカテゴリ名です。（50文字以内、「${SYSTEM_CATEGORY_IDLE}」は使用不可）`);
                    input.value = cat.name;
                    return;
                }
                const oldName = cat.name;
                const existing = await dbGet(STORE_CATEGORIES, newName);
                if (existing) {
                    alert('同名のカテゴリが既に存在します。');
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
            }
        };

        item.querySelectorAll('.color-preset').forEach(btn => {
            btn.onclick = async () => {
                cat.color = btn.dataset.color;
                await dbPut(STORE_CATEGORIES, cat);
                renderCategoryEditor();
                renderCategories();
            };
        });

        item.querySelector('.delete-cat-btn').onclick = async () => {
            if (await showConfirm(`カテゴリ「${cat.name}」を削除しますか？\n（過去のログからはカテゴリ色が消えます）`)) {
                await dbDelete(STORE_CATEGORIES, cat.name);
                updateUI();
                renderCategoryEditor();
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

async function initStoragePersistence() {
    const isPersisted = await isStoragePersisted();
    if (isPersisted) {
        updatePersistenceUI(true);
        return;
    }

    const granted = await requestStoragePersistence();
    updatePersistenceUI(granted);

    if (!granted) {
        console.warn('QuickLog-Solo: Storage persistence was denied.');
        showConfirm('ストレージの保護（永続化）が拒否されました。ブラウザの空き容量が不足すると、古いデータが自動的に削除される可能性があります。PWAとしてインストールするか、アプリを頻繁に使用することで改善される場合があります。').then(() => {});
    }
}

function updatePersistenceUI(isPersisted) {
    const el = getEl(ID_STORAGE_PERSISTENCE_DISPLAY);
    if (el) {
        el.textContent = isPersisted ? '✅ 保護されています' : '⚠️ 一時的（自動削除の可能性あり）';
        el.style.color = isPersisted ? '#166534' : '#b91c1c';
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
    getEl(ID_PIP_TOGGLE)?.addEventListener('click', togglePiP);
    getEl(ID_COPY_REPORT_BTN)?.addEventListener('click', copyReport);
    getEl(ID_COPY_AGGREGATION_BTN)?.addEventListener('click', copyAggregation);

    getEl(ID_LAYOUT_TOGGLE)?.addEventListener('click', async () => {
        const currentLayout = getBody().classList.contains('layout-horizontal') ? LAYOUT_HORIZONTAL : LAYOUT_VERTICAL;
        const newLayout = currentLayout === LAYOUT_HORIZONTAL ? LAYOUT_VERTICAL : LAYOUT_HORIZONTAL;
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_LAYOUT, value: newLayout });
        applyLayout(newLayout);
    });

    getEl(ID_CATEGORY_SECTION)?.addEventListener('wheel', async (e) => {
        const categories = await dbGetAll(STORE_CATEGORIES);
        const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE);
        if (totalPages <= 1) return;

        if (e.deltaY > 0) {
            if (currentCategoryPage < totalPages - 1) {
                currentCategoryPage++;
                renderCategories();
            }
        } else if (e.deltaY < 0) {
            if (currentCategoryPage > 0) {
                currentCategoryPage--;
                renderCategories();
            }
        }
        e.preventDefault();
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
    getEl(ID_THEME_SELECT)?.addEventListener('change', async (e) => {
        const theme = e.target.value;
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_THEME, value: theme });
        applyTheme(theme);
    });

    queryAll('.accent-dot').forEach(dot => {
        dot.onclick = async () => {
            const accent = dot.dataset.accent;
            await dbPut(STORE_SETTINGS, { key: SETTING_KEY_ACCENT, value: accent });
            applyAccent(accent);
        };
    });

    const fontSelect = getEl(ID_FONT_SELECT);
    if (fontSelect) {
        FONTS.forEach(f => {
            const opt = createEl('option');
            opt.value = f.value;
            opt.textContent = f.name;
            opt.style.fontFamily = f.value;
            fontSelect.appendChild(opt);
        });
        fontSelect.onchange = async (e) => {
            const fontValue = e.target.value;
            await dbPut(STORE_SETTINGS, { key: SETTING_KEY_FONT, value: fontValue });
            applyFont(fontValue);
        };
    }

    // Category additions
    getEl(ID_ADD_CATEGORY_BTN_SETTINGS)?.addEventListener('click', async () => {
        const input = getEl(ID_NEW_CATEGORY_NAME_SETTINGS);
        const name = input?.value.trim();
        if (name) {
            if (!isValidCategoryName(name)) {
                alert(`無効なカテゴリ名です。（50文字以内、「${SYSTEM_CATEGORY_IDLE}」は使用不可）`);
                return;
            }
            const categories = await dbGetAll(STORE_CATEGORIES);
            await dbPut(STORE_CATEGORIES, { name, color: 'blue', order: categories.length });
            if (input) input.value = '';
            renderCategories();
            renderCategoryEditor();
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
        performMaintenanceAction('ログデータをCSVとして書き出します。実行中の作業がある場合は終了されます。よろしいですか？', async () => {
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
        performMaintenanceAction('CSVファイルからログデータを読み込みます。既存のデータに追記されます。実行中の作業がある場合は終了されます。よろしいですか？', async () => {
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
        alert('インポートが完了しました。');
    });

    getEl(ID_CLEAR_LOGS_BTN)?.addEventListener('click', () => {
        performMaintenanceAction('全てのログを削除します。実行中の作業がある場合は終了されます。よろしいですか？', async () => {
            await dbClear(STORE_LOGS);
            updateUI();
            showToast('削除が完了しました');
        });
    });

    getEl(ID_RESET_CAT_SETTINGS_BTN)?.addEventListener('click', () => {
        performMaintenanceAction('カテゴリと各種設定を初期化します。実行中の作業がある場合は終了されます。よろしいですか？（ログは維持されます）', async () => {
            await dbClear(STORE_CATEGORIES);
            await dbClear(STORE_SETTINGS);
            location.reload();
        });
    });

    getEl(ID_RESET_SETTINGS_BTN)?.addEventListener('click', () => {
        performMaintenanceAction('各種設定を初期化します。実行中の作業がある場合は終了されます。よろしいですか？（ログとカテゴリは維持されます）', async () => {
            await dbClear(STORE_SETTINGS);
            location.reload();
        });
    });

    window.addEventListener('resize', () => {
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            const layout = getBody().classList.contains('layout-horizontal') ? LAYOUT_HORIZONTAL : LAYOUT_VERTICAL;
            window.resizeTo(layout === LAYOUT_HORIZONTAL ? WINDOW_WIDTH_HORIZONTAL : WINDOW_WIDTH_VERTICAL, layout === LAYOUT_HORIZONTAL ? WINDOW_HEIGHT_HORIZONTAL : WINDOW_HEIGHT_VERTICAL);
        }
    });

    window.addEventListener('beforeunload', (event) => {
        if (activeTask) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('QuickLog-Solo: DOMContentLoaded');
    try {
        await loadVersion();
        await initStoragePersistence();
        initPipSupport();
    } catch (e) {
        console.error('Failed to load version:', e);
    }

    try {
        console.log('QuickLog-Solo: Initializing DB...');
        const settings = await initDB();
        console.log('QuickLog-Solo: DB Initialized', settings);
        activeTask = settings.activeTask;

        applyTheme(settings.theme || THEME_SYSTEM);
        applyAccent(settings.accent || 'blue');
        applyFont(settings.font || FONTS[0].value);
        applyLayout(settings.layout);

        setupEventListeners();
        await handleTestParameters();
        await updateUI();
    } catch (e) {
        console.error('Failed to initialize application:', e);
        alert('アプリの初期化に失敗しました。ページを再読み込みしてください。');
    }

    console.log('QuickLog-Solo Initialized');
});

async function handleTestParameters() {
    const urlParams = new URLSearchParams(window.location.search);

    // テスト用のレイアウト指定: ?test_layout=horizontal|vertical
    const testLayout = urlParams.get(URL_PARAM_TEST_LAYOUT);
    if (testLayout === LAYOUT_HORIZONTAL || testLayout === LAYOUT_VERTICAL) {
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_LAYOUT, value: testLayout });
        applyLayout(testLayout);
    }

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
