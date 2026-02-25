import { initDB, dbGet, dbGetAll, dbPut, dbAdd, dbDelete, dbClear } from './js/db.js';
import { formatDuration, getAnimationState, startTaskLogic, stopTaskLogic, pauseTaskLogic } from './js/logic.js';
import { escapeHtml, escapeCsv, parseCsvLine, isValidCategoryName } from './js/utils.js';

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

let activeTask = null;
let timerInterval = null;
let currentCategoryPage = 0;
const ITEMS_PER_PAGE = 8;
let pipWindow = null;

const getEl = (id) => (pipWindow ? pipWindow.document : document).getElementById(id);
const queryAll = (selector) => (pipWindow ? pipWindow.document : document).querySelectorAll(selector);
const getBody = () => (pipWindow ? pipWindow.document : document).body;
const createEl = (tag) => (pipWindow ? pipWindow.document : document).createElement(tag);

const instanceChannel = new BroadcastChannel('quicklog_instance_coordination');

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
    const action = urlParams.get('action');

    let otherInstanceFound = false;
    const pingPromise = new Promise(resolve => {
        const handler = (e) => {
            if (e.data.type === 'PONG') {
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

    instanceChannel.postMessage({ type: 'PING' });
    await pingPromise;

    if (otherInstanceFound) {
        instanceChannel.postMessage({ type: 'FOCUS', action });
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
    if (type === 'PING') {
        instanceChannel.postMessage({ type: 'PONG' });
    } else if (type === 'FOCUS') {
        window.focus();
        if (action === 'settings') {
            getEl('settings-popup')?.classList.remove('hidden');
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
        alert('お使いのブラウザは Document Picture-in-Picture API をサポートしていません。');
        return;
    }

    try {
        const app = getEl('app');

        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 280,
            height: 200,
        });

        // Copy styles
        [...document.styleSheets].forEach((styleSheet) => {
            try {
                if (styleSheet.cssRules) {
                    const style = pipWindow.document.createElement('style');
                    const rules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
                    style.textContent = rules;
                    pipWindow.document.head.appendChild(style);
                }
            } catch (e) {
                const link = pipWindow.document.createElement('link');
                link.rel = 'stylesheet';
                link.href = styleSheet.href;
                pipWindow.document.head.appendChild(link);
            }
        });

        pipWindow.document.body.append(app);

        pipWindow.addEventListener("pagehide", (event) => {
            document.body.append(app);
            pipWindow = null;
            updateUI();
        });

        updateUI();

    } catch (e) {
        console.error('Failed to enter PiP mode:', e);
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
    activeTask = await stopTaskLogic(activeTask);
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

    const elements = ['elapsed-time', 'elapsed-time-overlay'];
    elements.forEach(id => {
        const el = getEl(id);
        if (el) el.textContent = timeStr;
    });

    const isPaused = activeTask.category === '(待機)';

    const overlay = getEl('current-task-display-overlay');
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
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        body.classList.add(isDark ? 'theme-dark' : 'theme-light');
    } else {
        body.classList.add(`theme-${theme}`);
    }
    const select = getEl('theme-select');
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
    const select = getEl('font-select');
    if (select) select.value = fontValue;
}

function applyLayout(layout) {
    const body = getBody();
    body.classList.remove('layout-horizontal', 'layout-vertical');

    if (!layout) {
        layout = localStorage.getItem('quicklog_layout') || (window.innerWidth >= 650 ? 'horizontal' : 'vertical');
    }

    localStorage.setItem('quicklog_layout', layout);
    body.classList.add(`layout-${layout}`);

    const btn = getEl('layout-toggle');
    if (btn) {
        const isHorizontal = layout === 'horizontal';
        btn.textContent = isHorizontal ? '↕️' : '↔️';
        btn.title = isHorizontal ? '縦長レイアウトに切り替え' : '横長レイアウトに切り替え';

        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            window.resizeTo(isHorizontal ? 650 : 280, isHorizontal ? 360 : 500);
        }
    }
}

async function renderCategories() {
    console.log('QuickLog-Solo: Rendering categories...');
    let categories;
    try {
        categories = await dbGetAll('categories');
    } catch (e) {
        console.error('Failed to get categories:', e);
        return;
    }
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));

    const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE);
    if (currentCategoryPage >= totalPages && totalPages > 0) {
        currentCategoryPage = totalPages - 1;
    }

    const list = getEl('category-list');
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
    const container = getEl('category-pagination');
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
        allLogs = await dbGetAll('logs');
        categories = await dbGetAll('categories');
    } catch (e) {
        console.error('Failed to get data for logs:', e);
        return;
    }
    const categoryMap = new Map(categories.map(c => [c.name, c]));
    const completedLogs = allLogs.filter(l => l.endTime).sort((a, b) => b.startTime - a.startTime).slice(0, 5);

    const logList = getEl('log-list');
    if (!logList) return;
    logList.innerHTML = '';

    let lastDate = '';
    const days = ['日', '月', '火', '水', '木', '金', '土'];

    completedLogs.forEach((log) => {
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
    const durationMs = log.endTime - log.startTime;
    const durationText = durationMs < 60000 ? `${Math.round(durationMs / 1000)}s` : `${Math.round(durationMs / 60000)}m`;

    let colorClass = 'dot-gray';
    if (log.category === '(待機)') {
        colorClass = 'dot-idle';
    } else {
        const cat = categoryMap.get(log.category);
        if (cat) colorClass = `dot-${cat.color}`;
    }
    li.innerHTML = `
        <span class="log-time">${startTimeStr}</span>
        <span class="log-name"><span class="category-dot ${colorClass}"></span>${escapeHtml(log.category)}</span>
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
        statusLabel: getEl('status-label'),
        statusLabelOverlay: getEl('status-label-overlay'),
        currentTaskName: getEl('current-task-name'),
        currentTaskNameOverlay: getEl('current-task-name-overlay'),
        pauseBtn: getEl('pause-btn'),
        endBtn: getEl('end-btn'),
        elapsedTime: getEl('elapsed-time'),
        elapsedTimeOverlay: getEl('elapsed-time-overlay'),
        display: getEl('current-task-display'),
        overlay: getEl('current-task-display-overlay')
    };

    if (activeTask) {
        let color = 'blue';
        const isPaused = activeTask.category === '(待機)';

        if (isPaused) {
            color = 'idle';
        } else {
            const cat = await dbGet('categories', activeTask.category);
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
                elements.pauseBtn.onclick = () => startTask(activeTask.resumableCategory);
            } else {
                elements.pauseBtn.innerHTML = '<span class="btn-text">一時停止</span><span class="btn-icon">⏸️</span>';
                elements.pauseBtn.disabled = false;
                elements.pauseBtn.onclick = pauseTask;
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
    const allLogs = await dbGetAll('logs');
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
    const allLogs = await dbGetAll('logs');
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
    const toast = getEl('toast');
    if (toast) {
        toast.innerText = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = getEl('confirm-modal');
        const msgEl = getEl('confirm-message');
        const okBtn = getEl('confirm-ok-btn');
        const cancelBtn = getEl('confirm-cancel-btn');

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
    const list = getEl('category-editor-list');
    if (!list) return;
    let categories = await dbGetAll('categories');
    categories = categories.filter(c => c.name !== '(待機)').sort((a, b) => a.order - b.order);
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
                    alert('無効なカテゴリ名です。（50文字以内、「(待機)」は使用不可）');
                    input.value = cat.name;
                    return;
                }
                const oldName = cat.name;
                const existing = await dbGet('categories', newName);
                if (existing) {
                    alert('同名のカテゴリが既に存在します。');
                    input.value = oldName;
                    return;
                }
                const updatedCat = { ...cat, name: newName };
                await dbDelete('categories', oldName);
                await dbPut('categories', updatedCat);

                const allLogs = await dbGetAll('logs');
                for (const log of allLogs) {
                    if (log.category === oldName) {
                        log.category = newName;
                        await dbPut('logs', log);
                    }
                }
                updateUI();
                renderCategoryEditor();
            }
        };

        item.querySelectorAll('.color-preset').forEach(btn => {
            btn.onclick = async () => {
                cat.color = btn.dataset.color;
                await dbPut('categories', cat);
                renderCategoryEditor();
                renderCategories();
            };
        });

        item.querySelector('.delete-cat-btn').onclick = async () => {
            if (await showConfirm(`カテゴリ「${cat.name}」を削除しますか？\n（過去のログからはカテゴリ色が消えます）`)) {
                await dbDelete('categories', cat.name);
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
            const cat = await dbGet('categories', name);
            if (cat) {
                cat.order = i;
                await dbPut('categories', cat);
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
        const el = getEl('version-display');
        if (el) el.textContent = `v${data.version}`;
    } catch (e) {
        console.error('Failed to load version:', e);
    }
}

function setupEventListeners() {
    getEl('pause-btn')?.addEventListener('click', pauseTask);
    getEl('end-btn')?.addEventListener('click', endTask);
    getEl('pip-toggle')?.addEventListener('click', togglePiP);
    getEl('copy-report-btn')?.addEventListener('click', copyReport);
    getEl('copy-aggregation-btn')?.addEventListener('click', copyAggregation);

    getEl('layout-toggle')?.addEventListener('click', async () => {
        const currentLayout = getBody().classList.contains('layout-horizontal') ? 'horizontal' : 'vertical';
        const newLayout = currentLayout === 'horizontal' ? 'vertical' : 'horizontal';
        await dbPut('settings', { key: 'layout', value: newLayout });
        applyLayout(newLayout);
    });

    getEl('category-section')?.addEventListener('wheel', async (e) => {
        const categories = await dbGetAll('categories');
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
        settings: getEl('settings-popup')
    };

    getEl('settings-toggle')?.addEventListener('click', () => popups.settings?.classList.remove('hidden'));

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
    getEl('theme-select')?.addEventListener('change', async (e) => {
        const theme = e.target.value;
        await dbPut('settings', { key: 'theme', value: theme });
        applyTheme(theme);
    });

    queryAll('.accent-dot').forEach(dot => {
        dot.onclick = async () => {
            const accent = dot.dataset.accent;
            await dbPut('settings', { key: 'accent', value: accent });
            applyAccent(accent);
        };
    });

    const fontSelect = getEl('font-select');
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
            await dbPut('settings', { key: 'font', value: fontValue });
            applyFont(fontValue);
        };
    }

    // Category additions
    getEl('add-category-btn-settings')?.addEventListener('click', async () => {
        const input = getEl('new-category-name-settings');
        const name = input?.value.trim();
        if (name) {
            if (!isValidCategoryName(name)) {
                alert('無効なカテゴリ名です。（50文字以内、「(待機)」は使用不可）');
                return;
            }
            const categories = await dbGetAll('categories');
            await dbPut('categories', { name, color: 'blue', order: categories.length });
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

    getEl('export-csv-btn')?.addEventListener('click', () => {
        performMaintenanceAction('ログデータをCSVとして書き出します。実行中の作業がある場合は終了されます。よろしいですか？', async () => {
            const logs = await dbGetAll('logs');
            let csv = "id,category,startTime,endTime\n";
            logs.forEach(l => { csv += `${l.id},${escapeCsv(l.category)},${l.startTime},${l.endTime}\n`; });
            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
            const a = createEl('a');
            a.href = url;
            a.download = `quicklog_backup_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
        });
    });

    const csvInput = getEl('csv-file-input');
    getEl('import-csv-btn')?.addEventListener('click', () => {
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
                    await dbPut('logs', {
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

    getEl('clear-logs-btn')?.addEventListener('click', () => {
        performMaintenanceAction('全てのログを削除します。実行中の作業がある場合は終了されます。よろしいですか？', async () => {
            await dbClear('logs');
            updateUI();
            showToast('削除が完了しました');
        });
    });

    getEl('reset-cat-settings-btn')?.addEventListener('click', () => {
        performMaintenanceAction('カテゴリと各種設定を初期化します。実行中の作業がある場合は終了されます。よろしいですか？（ログは維持されます）', async () => {
            await dbClear('categories');
            await dbClear('settings');
            location.reload();
        });
    });

    getEl('reset-settings-btn')?.addEventListener('click', () => {
        performMaintenanceAction('各種設定を初期化します。実行中の作業がある場合は終了されます。よろしいですか？（ログとカテゴリは維持されます）', async () => {
            await dbClear('settings');
            location.reload();
        });
    });

    window.addEventListener('resize', () => {
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            const layout = getBody().classList.contains('layout-horizontal') ? 'horizontal' : 'vertical';
            window.resizeTo(layout === 'horizontal' ? 650 : 280, layout === 'horizontal' ? 360 : 500);
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
    } catch (e) {
        console.error('Failed to load version:', e);
    }

    try {
        console.log('QuickLog-Solo: Initializing DB...');
        const settings = await initDB();
        console.log('QuickLog-Solo: DB Initialized', settings);
        activeTask = settings.activeTask;

        applyTheme(settings.theme || 'system');
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
    const testLayout = urlParams.get('test_layout');
    if (testLayout === 'horizontal' || testLayout === 'vertical') {
        await dbPut('settings', { key: 'layout', value: testLayout });
        applyLayout(testLayout);
    }

    // テスト用のタスク開始: ?test_cat=Dev&test_elapsed=60000&test_resumable=Dev
    let testCat = urlParams.get('test_cat');
    if (testCat) {
        if (testCat.length > 50) testCat = testCat.substring(0, 50);
        const elapsed = parseInt(urlParams.get('test_elapsed') || '0');
        const resumable = urlParams.get('test_resumable');
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
        const id = await dbAdd('logs', newLog);
        newLog.id = id;
        activeTask = newLog;

        // URLをクリーンアップして再読み込み時にループしないようにする
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }
}
