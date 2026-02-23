// QuickLog-Solo: Core Logic (Vanilla JS)

const DB_NAME = 'QuickLogSoloDB';
const DB_VERSION = 1;

let db;
let activeTask = null;

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
        '開発', '会議', '調査', '事務作業',
        '深い集中(Deep Work)', 'スキルアップ', 'アイデア出し', 'メンタル休憩'
    ];

    const existingCategories = await dbGetAll('categories');
    if (existingCategories.length === 0) {
        for (const cat of initialCategories) {
            await dbPut('categories', { name: cat });
        }
    }

    // Load settings
    const theme = await dbGet('settings', 'theme');
    if (theme) applyTheme(theme.value);

    const accent = await dbGet('settings', 'accent');
    if (accent) applyAccent(accent.value);

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

async function startTask(categoryName) {
    if (activeTask) {
        await stopTask();
    }

    const newLog = {
        category: categoryName,
        startTime: Date.now(),
        endTime: null
    };

    const id = await dbAdd('logs', newLog);
    newLog.id = id;
    activeTask = newLog;
    updateUI();
}

async function stopTask() {
    if (!activeTask) return;

    activeTask.endTime = Date.now();
    await dbPut('logs', activeTask);
    activeTask = null;
    updateUI();
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

async function renderCategories() {
    const categories = await dbGetAll('categories');
    const list = document.getElementById('category-list');
    if (!list) return;
    list.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        if (activeTask && activeTask.category === cat.name) {
            btn.classList.add('active');
        }
        btn.textContent = cat.name;
        btn.onclick = () => startTask(cat.name);
        list.appendChild(btn);
    });
}

async function renderLogs() {
    const allLogs = await dbGetAll('logs');
    const completedLogs = allLogs.filter(l => l.endTime).sort((a, b) => b.startTime - a.startTime);

    const logList = document.getElementById('log-list');
    const extraLogList = document.getElementById('extra-log-list');
    if (!logList || !extraLogList) return;
    logList.innerHTML = '';
    extraLogList.innerHTML = '';

    completedLogs.forEach((log, index) => {
        const li = createLogElement(log);
        if (index < 5) {
            logList.appendChild(li);
        } else {
            extraLogList.appendChild(li);
        }
    });

    const moreBtn = document.getElementById('more-logs-btn');
    if (moreBtn) moreBtn.style.display = completedLogs.length > 5 ? 'block' : 'none';
}

function createLogElement(log) {
    const li = document.createElement('li');
    li.className = 'log-item';

    const start = new Date(log.startTime);
    const end = new Date(log.endTime);
    const durationMin = Math.round((log.endTime - log.startTime) / 60000);

    li.innerHTML = `
        <span class="log-time">${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}</span>
        <span class="log-name">${log.category}</span>
        <span class="log-duration">${durationMin} min</span>
    `;
    return li;
}

function updateUI() {
    renderCategories();
    renderLogs();

    const statusLabel = document.getElementById('status-label');
    const currentTaskName = document.getElementById('current-task-name');
    const stopBtn = document.getElementById('stop-btn');

    if (activeTask) {
        if (statusLabel) statusLabel.textContent = '実行中';
        if (currentTaskName) currentTaskName.textContent = activeTask.category;
        if (stopBtn) stopBtn.disabled = false;
    } else {
        if (statusLabel) statusLabel.textContent = '待機中';
        if (currentTaskName) currentTaskName.textContent = '-';
        if (stopBtn) stopBtn.disabled = true;
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
    showToast();
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
    showToast();
}

function showToast() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    updateUI();

    // Event Listeners
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) stopBtn.onclick = stopTask;

    const addCatBtn = document.getElementById('add-category-btn');
    if (addCatBtn) {
        addCatBtn.onclick = async () => {
            const input = document.getElementById('new-category-name');
            const name = input.value.trim();
            if (name) {
                await dbPut('categories', { name });
                input.value = '';
                renderCategories();
            }
        };
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
