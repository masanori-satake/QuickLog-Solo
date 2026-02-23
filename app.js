if ("serviceWorker" in navigator) { window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js"); }); }
// QuickLog-Solo: Core Logic (Vanilla JS)

const DB_NAME = 'QuickLogSoloDB';
const DB_VERSION = 1;

let db;
let activeTask = null;
let timerInterval = null;

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

// --- Database Logic (Raw IndexedDB) ---

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('logs')) {
                db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('categories')) {
                db.createObjectStore('categories', { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

function dbGet(storeName, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbClear(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbPut(storeName, value) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbAdd(storeName, value) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function initDB() {
    await openDatabase();
    await setupInitialData();
    await cleanupOldLogs();
}

async function setupInitialData() {
    const initialCategories = [
        { name: '💻 開発', color: 'blue', order: 0 },
        { name: '🤝 会議', color: 'orange', order: 1 },
        { name: '🔍 調査', color: 'green', order: 2 },
        { name: '事務作業 📝', color: 'gray', order: 3 },
        { name: '🔥 深い集中(Deep Work)', color: 'red', order: 4 },
        { name: '📚 スキルアップ', color: 'purple', order: 5 },
        { name: '💡 アイデア出し', color: 'teal', order: 6 },
        { name: '☕ メンタル休憩', color: 'orange', order: 7 }
    ];

    let existingCategories = await dbGetAll('categories');
    if (existingCategories.length === 0) {
        for (const cat of initialCategories) {
            await dbPut('categories', cat);
        }
    } else {
        // Migration: Ensure all existing categories have color and order
        for (let i = 0; i < existingCategories.length; i++) {
            let cat = existingCategories[i];
            if (cat.color === undefined || cat.order === undefined) {
                cat.color = cat.color || 'blue';
                cat.order = cat.order !== undefined ? cat.order : i;
                await dbPut('categories', cat);
            }
        }
    }

    // Load settings
    const theme = await dbGet('settings', 'theme');
    if (theme) applyTheme(theme.value);

    const accent = await dbGet('settings', 'accent');
    if (accent) applyAccent(accent.value);

    const font = await dbGet('settings', 'font');
    if (font) applyFont(font.value);

    // Check for active task
    const allLogs = await dbGetAll('logs');
    activeTask = allLogs.find(log => !log.endTime);
}

async function cleanupOldLogs() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const logs = await dbGetAll('logs');
    for (const log of logs) {
        if (log.startTime < thirtyDaysAgo) {
            await dbDelete('logs', log.id);
        }
    }
}

// --- Punch-in/out Logic ---

async function startTask(categoryName, resumableCategory = null) {
    if (activeTask && activeTask.category === categoryName) return;

    if (activeTask) {
        await stopTaskInternal();
    }

    const newLog = {
        category: categoryName,
        startTime: Date.now(),
        endTime: null,
        resumableCategory: resumableCategory
    };

    const id = await dbAdd('logs', newLog);
    newLog.id = id;
    activeTask = newLog;
    updateUI();
}

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
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const el = document.getElementById('elapsed-time');
    const elOverlay = document.getElementById('elapsed-time-overlay');
    if (el) el.textContent = timeStr;
    if (elOverlay) elOverlay.textContent = timeStr;

    // Animation logic
    const msInMinute = elapsed % 60000;
    const minuteCount = Math.floor(elapsed / 60000);
    const percent = (msInMinute / 60000) * 100;

    const overlay = document.getElementById('current-task-display-overlay');
    if (overlay) {
        if (minuteCount % 2 === 0) {
            // Even minute: White -> Accent (Right to Left)
            // Percent 0% (White) -> 100% (Accent)
            // Clip-path inset(top right bottom left)
            overlay.style.clipPath = `inset(0 0 0 ${100 - percent}%)`;
        } else {
            // Odd minute: Accent -> White (Right to Left)
            // Percent 0% (Accent) -> 100% (White)
            // To make White appear from Right, Accent must be clipped from Right.
            overlay.style.clipPath = `inset(0 ${percent}% 0 0)`;
        }
    }
}

async function stopTaskInternal() {
    if (!activeTask) return;
    activeTask.endTime = Date.now();
    const taskToSave = activeTask;
    activeTask = null; // Clear immediately to update UI without lag
    await dbPut('logs', taskToSave);
}

async function pauseTask() {
    if (!activeTask || activeTask.category === '(待機)') return;
    const lastCategory = activeTask.category;
    await stopTaskInternal();
    await startTask('(待機)', lastCategory);
}

async function endTask() {
    if (!activeTask) return;
    if (await showConfirm('本当に作業を終了しますか？')) {
        await stopTaskInternal();
        updateUI();
    }
}

// --- UI Logic ---

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
    body.classList.remove('accent-blue', 'accent-green', 'accent-orange', 'accent-red');
    body.classList.add(`accent-${accent}`);
}

function applyFont(fontValue) {
    document.body.style.setProperty('--font-family', fontValue);
    const select = document.getElementById('font-select');
    if (select) select.value = fontValue;
}

async function renderCategories() {
    let categories = await dbGetAll('categories');
    categories.sort((a, b) => a.order - b.order);
    const list = document.getElementById('category-list');
    if (!list) return;
    list.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
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
}

async function renderLogs() {
    const allLogs = await dbGetAll('logs');
    const categories = await dbGetAll('categories');
    const categoryMap = new Map(categories.map(c => [c.name, c]));

    const completedLogs = allLogs.filter(l => l.endTime).sort((a, b) => b.startTime - a.startTime);

    const logList = document.getElementById('log-list');
    const extraLogList = document.getElementById('extra-log-list');
    if (!logList || !extraLogList) return;
    logList.innerHTML = '';
    extraLogList.innerHTML = '';

    let lastDateStr = "";
    completedLogs.forEach((log, i) => {
        const date = new Date(log.startTime);
        const dateStr = date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });

        if (dateStr !== lastDateStr) {
            const dateHeader = document.createElement('li');
            dateHeader.className = 'log-date-header';
            dateHeader.textContent = dateStr;
            if (i < 5) {
                logList.appendChild(dateHeader);
            } else {
                extraLogList.appendChild(dateHeader);
            }
            lastDateStr = dateStr;
        }

        const li = createLogElement(log, categoryMap);
        if (i < 5) {
            logList.appendChild(li);
        } else {
            extraLogList.appendChild(li);
        }
    });

    const moreBtn = document.getElementById('more-logs-btn');
    if (moreBtn) moreBtn.style.display = completedLogs.length > 5 ? 'block' : 'none';
}

function createLogElement(log, categoryMap) {
    const li = document.createElement('li');
    li.className = 'log-item';

    const start = new Date(log.startTime);
    const durationMs = log.endTime - log.startTime;
    let durationText = "";
    if (durationMs < 60000) {
        durationText = `${Math.round(durationMs / 1000)} sec`;
    } else {
        durationText = `${Math.round(durationMs / 60000)} min`;
    }

    let colorClass = 'dot-gray';
    if (log.category === '(待機)') {
        colorClass = 'dot-idle';
    } else {
        const cat = categoryMap.get(log.category);
        if (cat) colorClass = `dot-${cat.color}`;
    }

    li.innerHTML = `
        <span class="log-time">${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}</span>
        <span class="log-name"><span class="category-dot ${colorClass}"></span>${log.category}</span>
        <span class="log-duration">${durationText}</span>
    `;
    return li;
}

async function updateUI() {
    // Stop timer while updating UI to prevent concurrent modifications
    if (timerInterval) clearInterval(timerInterval);

    renderCategories();
    renderLogs();

    const statusLabel = document.getElementById('status-label');
    const statusLabelOverlay = document.getElementById('status-label-overlay');
    const currentTaskName = document.getElementById('current-task-name');
    const currentTaskNameOverlay = document.getElementById('current-task-name-overlay');
    const pauseBtn = document.getElementById('pause-btn');
    const endBtn = document.getElementById('end-btn');
    const elapsedTime = document.getElementById('elapsed-time');
    const elapsedTimeOverlay = document.getElementById('elapsed-time-overlay');
    const display = document.getElementById('current-task-display');
    const overlay = document.getElementById('current-task-display-overlay');

    if (activeTask) {
        let color = 'blue';
        let isIdle = activeTask.category === '(待機)';

        if (isIdle) {
            color = 'idle';
        } else {
            const cat = await dbGet('categories', activeTask.category);
            if (cat) color = cat.color;
        }

        if (display) {
            display.className = `cat-${color}`;
        }
        if (overlay) {
            overlay.className = `cat-${color}-full`;
        }

        const label = isIdle ? '待機中' : '実行中';
        if (statusLabel) statusLabel.textContent = label;
        if (statusLabelOverlay) statusLabelOverlay.textContent = label;
        if (currentTaskName) currentTaskName.textContent = activeTask.category;
        if (currentTaskNameOverlay) currentTaskNameOverlay.textContent = activeTask.category;

        if (pauseBtn) {
            if (isIdle) {
                pauseBtn.innerHTML = '<span class="btn-text">再開</span><span class="btn-icon">▶️</span>';
                pauseBtn.disabled = !activeTask.resumableCategory;
                pauseBtn.onclick = () => startTask(activeTask.resumableCategory);
            } else {
                pauseBtn.innerHTML = '<span class="btn-text">一時停止</span><span class="btn-icon">⏸️</span>';
                pauseBtn.disabled = false;
                pauseBtn.onclick = pauseTask;
            }
        }
        if (endBtn) {
            endBtn.disabled = false;
        }

        if (elapsedTime) elapsedTime.classList.remove('hidden');
        if (elapsedTimeOverlay) elapsedTimeOverlay.classList.remove('hidden');
        startTimer();
    } else {
        if (display) display.className = '';
        if (overlay) overlay.className = '';
        const label = '停止中';
        if (statusLabel) statusLabel.textContent = label;
        if (statusLabelOverlay) statusLabelOverlay.textContent = label;
        if (currentTaskName) currentTaskName.textContent = '-';
        if (currentTaskNameOverlay) currentTaskNameOverlay.textContent = '-';

        if (pauseBtn) {
            pauseBtn.disabled = true;
            pauseBtn.innerHTML = '<span class="btn-text">一時停止</span><span class="btn-icon">⏸️</span>';
        }
        if (endBtn) endBtn.disabled = true;

        if (elapsedTime) {
            elapsedTime.classList.add('hidden');
            elapsedTime.textContent = '00:00:00';
        }
        if (elapsedTimeOverlay) {
            elapsedTimeOverlay.classList.add('hidden');
            elapsedTimeOverlay.textContent = '00:00:00';
        }
        if (overlay) overlay.style.clipPath = 'inset(0 0 0 100%)';
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

// --- Category Editor & Tab Logic ---

function initTabs() {
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
}

async function renderCategoryEditor() {
    const list = document.getElementById('category-editor-list');
    if (!list) return;
    let categories = await dbGetAll('categories');
    categories = categories.filter(c => c.name !== '(待機)');
    categories.sort((a, b) => a.order - b.order);
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

                // Sync logs
                const allLogs = await dbGetAll('logs');
                for (const log of allLogs) {
                    if (log.category === oldName) {
                        log.category = newName;
                        await dbPut('logs', log);
                    }
                }

                cat.name = newName; // Update local ref
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

        // Drag and Drop
        item.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', cat.name);
            item.classList.add('dragging');
        };
        item.ondragend = () => item.classList.remove('dragging');

        list.appendChild(item);
    });

    // Drag over logic
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
        renderCategoryEditor(); // Refresh to update dataset.name and handles
    };
}

function getColorCode(color) {
    const codes = {
        blue: '#1e40af', green: '#166534', orange: '#9a3412',
        red: '#991b1b', purple: '#6b21a8', teal: '#115e59', gray: '#374151'
    };
    return codes[color] || '#333';
}

// --- Initialization ---

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

document.addEventListener('DOMContentLoaded', async () => {
    await loadVersion();
    await initDB();
    updateUI();
    initTabs();

    // Event Listeners
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.onclick = pauseTask;

    const endBtn = document.getElementById('end-btn');
    if (endBtn) endBtn.onclick = endTask;

    const addCategoryLogic = async (inputId) => {
        const input = document.getElementById(inputId);
        const name = input.value.trim();
        if (name) {
            if (name === '(待機)') {
                alert('「(待機)」はシステム予約済みのカテゴリ名です。');
                return;
            }
            const categories = await dbGetAll('categories');
            const newOrder = categories.length;
            await dbPut('categories', { name, color: 'blue', order: newOrder });
            input.value = '';
            renderCategories();
            renderCategoryEditor();
        }
    };

    const addCatBtnSettings = document.getElementById('add-category-btn-settings');
    if (addCatBtnSettings) {
        addCatBtnSettings.onclick = () => addCategoryLogic('new-category-name-settings');
    }

    const moreLogsBtn = document.getElementById('more-logs-btn');
    if (moreLogsBtn) {
        moreLogsBtn.onclick = () => {
            const extra = document.getElementById('extra-logs');
            const isHidden = extra.classList.contains('hidden');
            extra.classList.toggle('hidden');
            moreLogsBtn.textContent = isHidden ? 'Less...' : 'More...';
        };
    }

    const reportBtn = document.getElementById('copy-report-btn');
    if (reportBtn) reportBtn.onclick = copyReport;

    const aggBtn = document.getElementById('copy-aggregation-btn');
    if (aggBtn) aggBtn.onclick = copyAggregation;

    // Modals
    const infoPopup = document.getElementById('info-popup');
    const infoBtn = document.getElementById('info-btn');
    if (infoBtn && infoPopup) infoBtn.onclick = () => infoPopup.classList.remove('hidden');

    const settingsPopup = document.getElementById('settings-popup');
    const settingsToggle = document.getElementById('settings-toggle');
    if (settingsToggle && settingsPopup) settingsToggle.onclick = () => settingsPopup.classList.remove('hidden');

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.onclick = () => {
            if (infoPopup) infoPopup.classList.add('hidden');
            if (settingsPopup) settingsPopup.classList.add('hidden');
        };
    });

    window.onclick = (event) => {
        if (event.target == infoPopup) infoPopup.classList.add('hidden');
        if (event.target == settingsPopup) settingsPopup.classList.add('hidden');
    };

    // Settings
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.onchange = async (e) => {
            const theme = e.target.value;
            await dbPut('settings', { key: 'theme', value: theme });
            applyTheme(theme);
        };
    }

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
        // Initial set if needed (already called in setupInitialData but select might not have been populated)
        const font = await dbGet('settings', 'font');
        if (font) fontSelect.value = font.value;
    }

    // CSV Export/Import
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) {
        exportBtn.onclick = async () => {
            const logs = await dbGetAll('logs');
            let csv = "id,category,startTime,endTime\n";
            logs.forEach(l => {
                csv += `${l.id},${l.category},${l.startTime},${l.endTime}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quicklog_backup_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
        };
    }

    const importBtn = document.getElementById('import-csv-btn');
    const csvInput = document.getElementById('csv-file-input');

    // Maintenance
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    if (clearLogsBtn) {
        clearLogsBtn.onclick = async () => {
            if (await showConfirm('全てのログを削除しますか？')) {
                await dbClear('logs');
                updateUI();
                showToast('削除が完了しました');
            }
        };
    }

    const resetCatSettingsBtn = document.getElementById('reset-cat-settings-btn');
    if (resetCatSettingsBtn) {
        resetCatSettingsBtn.onclick = async () => {
            if (await showConfirm('カテゴリと各種設定を初期化しますか？\n（ログは維持されます）')) {
                await dbClear('categories');
                await dbClear('settings');
                location.reload();
            }
        };
    }

    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    if (resetSettingsBtn) {
        resetSettingsBtn.onclick = async () => {
            if (await showConfirm('各種設定を初期化しますか？\n（ログとカテゴリは維持されます）')) {
                await dbClear('settings');
                location.reload();
            }
        };
    }

    if (importBtn && csvInput) {
        importBtn.onclick = () => csvInput.click();
        csvInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            const lines = text.split('\n').slice(1);
            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 3) {
                    const [id, category, startTime, endTime] = parts;
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
        };
    }

    console.log('QuickLog-Solo Initialized');
});
