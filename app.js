import { initDB, dbGet, dbGetAll, dbPut, dbAdd, dbDelete, dbClear } from './js/db.js';
import { formatDuration, getAnimationState, startTaskLogic, stopTaskLogic, pauseTaskLogic } from './js/logic.js';

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
export let currentCategoryPage = 0;
export const getItemsPerPage = () => {
    return document.body.classList.contains('layout-horizontal') ? 4 : 8;
};

export const setCurrentCategoryPage = (page) => { currentCategoryPage = page; };

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
            document.body.innerHTML = '<div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; font-weight:bold; text-align:center; padding:2rem;">' +
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
            document.getElementById('settings-popup')?.classList.remove('hidden');
        }
    }
};

// --- Task Control ---

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
        const el = document.getElementById(id);
        if (el) el.textContent = timeStr;
    });

    const isPaused = activeTask.category === '(待機)';

    const overlay = document.getElementById('current-task-display-overlay');
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
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark');
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        body.classList.add(isDark ? 'theme-dark' : 'theme-light');
    } else {
        body.classList.add(`theme-${theme}`);
    }
    const select = document.getElementById('theme-select');
    if (select) select.value = theme;
}

function applyAccent(accent) {
    const body = document.body;
    const accentClasses = ['accent-blue', 'accent-green', 'accent-orange', 'accent-red'];
    body.classList.remove(...accentClasses);
    body.classList.add(`accent-${accent}`);
}

function applyFont(fontValue) {
    document.body.style.setProperty('--font-family', fontValue);
    const select = document.getElementById('font-select');
    if (select) select.value = fontValue;
}

export function applyLayout(layout) {
    const body = document.body;
    body.classList.remove('layout-horizontal', 'layout-vertical');

    if (!layout) {
        layout = localStorage.getItem('quicklog_layout') || (window.innerWidth >= 650 ? 'horizontal' : 'vertical');
    }

    localStorage.setItem('quicklog_layout', layout);
    body.classList.add(`layout-${layout}`);

    const btn = document.getElementById('layout-toggle');
    if (btn) {
        const isHorizontal = layout === 'horizontal';
        btn.textContent = isHorizontal ? '↕️' : '↔️';
        btn.title = isHorizontal ? '縦長レイアウトに切り替え' : '横長レイアウトに切り替え';

        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            window.resizeTo(isHorizontal ? 650 : 280, isHorizontal ? 360 : 500);
        }
    }
    updateUI();
}

export async function renderCategories() {
    console.log('QuickLog-Solo: Rendering categories...');
    let categories;
    try {
        categories = await dbGetAll('categories');
    } catch (e) {
        console.error('Failed to get categories:', e);
        return;
    }
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));

    const itemsPerPage = getItemsPerPage();
    const totalPages = Math.ceil(categories.length / itemsPerPage);
    if (currentCategoryPage >= totalPages && totalPages > 0) {
        currentCategoryPage = totalPages - 1;
    }

    const list = document.getElementById('category-list');
    if (!list) return;
    list.innerHTML = '';

    const start = currentCategoryPage * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = categories.slice(start, end);

    pageItems.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-btn cat-${cat.color || 'blue'}`;
        const isActive = activeTask && activeTask.category === cat.name;
        if (isActive) {
            btn.classList.add('active');
            btn.disabled = true;
        }
        btn.textContent = cat.name;
        btn.title = cat.name; // Tooltip
        btn.onclick = () => startTask(cat.name);
        list.appendChild(btn);
    });

    renderPagination(totalPages);
}

export function renderPagination(totalPages) {
    const container = document.getElementById('category-pagination');
    if (!container) return;
    // 1ページのみでも表示してレイアウトを安定させる
    container.classList.remove('hidden');
    container.innerHTML = '';
    const pages = Math.max(1, totalPages);
    for (let i = 0; i < pages; i++) {
        const dot = document.createElement('div');
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

    const logList = document.getElementById('log-list');
    if (!logList) return;
    logList.innerHTML = '';

    let lastDate = '';
    const days = ['日', '月', '火', '水', '木', '金', '土'];

    completedLogs.forEach((log) => {
        const d = new Date(log.startTime);
        const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;

        if (dateStr !== lastDate) {
            const header = document.createElement('li');
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
    const li = document.createElement('li');
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
        <span class="log-name"><span class="category-dot ${colorClass}"></span>${log.category}</span>
        <span class="log-duration">${durationText}</span>
    `;
    return li;
}

export async function updateUI() {
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
        statusLabel: document.getElementById('status-label'),
        statusLabelOverlay: document.getElementById('status-label-overlay'),
        currentTaskName: document.getElementById('current-task-name'),
        currentTaskNameOverlay: document.getElementById('current-task-name-overlay'),
        pauseBtn: document.getElementById('pause-btn'),
        endBtn: document.getElementById('end-btn'),
        elapsedTime: document.getElementById('elapsed-time'),
        elapsedTimeOverlay: document.getElementById('elapsed-time-overlay'),
        display: document.getElementById('current-task-display'),
        overlay: document.getElementById('current-task-display-overlay')
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

        [elements.elapsedTime, elements.elapsedTimeOverlay].forEach(el => { if (el) el.classList.remove('hidden'); });
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
            }
        });
        if (elements.overlay) elements.overlay.style.clipPath = 'inset(0 0 0 100%)';
        document.title = 'QuickLog-Solo';
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
    const toast = document.getElementById('toast');
    if (toast) {
        toast.innerText = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }
}

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

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
    const list = document.getElementById('category-editor-list');
    if (!list) return;
    let categories = await dbGetAll('categories');
    categories = categories.filter(c => c.name !== '(待機)').sort((a, b) => a.order - b.order);
    list.innerHTML = '';

    categories.forEach(cat => {
        const item = document.createElement('div');
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
                <input type="text" class="category-edit-name" value="${cat.name}">
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
        input.onchange = async () => {
            const newName = input.value.trim();
            if (newName && newName !== cat.name) {
                if (newName === '(待機)') {
                    alert('「(待機)」はシステム予約済みのカテゴリ名です。');
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
        const el = document.getElementById('version-display');
        if (el) el.textContent = `v${data.version}`;
    } catch (e) {
        console.error('Failed to load version:', e);
    }
}

function setupEventListeners() {
    document.getElementById('pause-btn')?.addEventListener('click', pauseTask);
    document.getElementById('end-btn')?.addEventListener('click', endTask);
    document.getElementById('copy-report-btn')?.addEventListener('click', copyReport);
    document.getElementById('copy-aggregation-btn')?.addEventListener('click', copyAggregation);

    document.getElementById('layout-toggle')?.addEventListener('click', async () => {
        const currentLayout = document.body.classList.contains('layout-horizontal') ? 'horizontal' : 'vertical';
        const newLayout = currentLayout === 'horizontal' ? 'vertical' : 'horizontal';
        await dbPut('settings', { key: 'layout', value: newLayout });
        applyLayout(newLayout);
    });

    document.getElementById('category-section')?.addEventListener('wheel', async (e) => {
        const categories = await dbGetAll('categories');
        const itemsPerPage = getItemsPerPage();
        const totalPages = Math.ceil(categories.length / itemsPerPage);
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
        settings: document.getElementById('settings-popup')
    };

    document.getElementById('settings-toggle')?.addEventListener('click', () => popups.settings?.classList.remove('hidden'));

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.onclick = () => Object.values(popups).forEach(p => p?.classList.add('hidden'));
    });

    window.onclick = (event) => {
        Object.values(popups).forEach(p => { if (event.target === p) p.classList.add('hidden'); });
    };

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            const target = document.getElementById(`${btn.dataset.tab}-tab`);
            if (target) target.classList.remove('hidden');
            if (btn.dataset.tab === 'categories') renderCategoryEditor();
        };
    });

    // Settings listeners
    document.getElementById('theme-select')?.addEventListener('change', async (e) => {
        const theme = e.target.value;
        await dbPut('settings', { key: 'theme', value: theme });
        applyTheme(theme);
    });

    document.querySelectorAll('.accent-dot').forEach(dot => {
        dot.onclick = async () => {
            const accent = dot.dataset.accent;
            await dbPut('settings', { key: 'accent', value: accent });
            applyAccent(accent);
        };
    });

    const fontSelect = document.getElementById('font-select');
    if (fontSelect) {
        FONTS.forEach(f => {
            const opt = document.createElement('option');
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
    document.getElementById('add-category-btn-settings')?.addEventListener('click', async () => {
        const input = document.getElementById('new-category-name-settings');
        const name = input?.value.trim();
        if (name) {
            if (name === '(待機)') {
                alert('「(待機)」はシステム予約済みのカテゴリ名です。');
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

    document.getElementById('export-csv-btn')?.addEventListener('click', () => {
        performMaintenanceAction('ログデータをCSVとして書き出します。実行中の作業がある場合は終了されます。よろしいですか？', async () => {
            const logs = await dbGetAll('logs');
            let csv = "id,category,startTime,endTime\n";
            logs.forEach(l => { csv += `${l.id},${l.category},${l.startTime},${l.endTime}\n`; });
            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `quicklog_backup_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
        });
    });

    const csvInput = document.getElementById('csv-file-input');
    document.getElementById('import-csv-btn')?.addEventListener('click', () => {
        performMaintenanceAction('CSVファイルからログデータを読み込みます。既存のデータに追記されます。実行中の作業がある場合は終了されます。よろしいですか？', async () => {
            csvInput?.click();
        });
    });

    csvInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const lines = text.split('\n').slice(1);
        for (const line of lines) {
            const parts = line.split(',');
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

    document.getElementById('clear-logs-btn')?.addEventListener('click', () => {
        performMaintenanceAction('全てのログを削除します。実行中の作業がある場合は終了されます。よろしいですか？', async () => {
            await dbClear('logs');
            updateUI();
            showToast('削除が完了しました');
        });
    });

    document.getElementById('reset-cat-settings-btn')?.addEventListener('click', () => {
        performMaintenanceAction('カテゴリと各種設定を初期化します。実行中の作業がある場合は終了されます。よろしいですか？（ログは維持されます）', async () => {
            await dbClear('categories');
            await dbClear('settings');
            location.reload();
        });
    });

    document.getElementById('reset-settings-btn')?.addEventListener('click', () => {
        performMaintenanceAction('各種設定を初期化します。実行中の作業がある場合は終了されます。よろしいですか？（ログとカテゴリは維持されます）', async () => {
            await dbClear('settings');
            location.reload();
        });
    });

    window.addEventListener('resize', () => {
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            const layout = document.body.classList.contains('layout-horizontal') ? 'horizontal' : 'vertical';
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
    const testCat = urlParams.get('test_cat');
    if (testCat) {
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
