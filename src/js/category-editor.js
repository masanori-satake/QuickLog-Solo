/**
 * QL-Category Editor Logic
 */

import { animations as animationRegistry } from './animation_registry.js';
import { AnimationEngine } from './animations.js';
import { messages } from './messages.js';
import { SYSTEM_CATEGORY_PAGE_BREAK, isValidColor } from './utils.js';
import { dbGetAll, dbImportCategories } from './db.js';

let currentLang = 'en';
let categories = [];
let selectedIndex = -1;
let animationEngine = null;
let currentTheme = 'dark';

// DOM Elements
const categoryListEl = document.getElementById('category-list');
const detailSection = document.getElementById('detail-section');
const editNameInput = document.getElementById('edit-name');
const tagListEl = document.getElementById('tag-list');
const tagInput = document.getElementById('tag-input');
const colorPaletteEl = document.getElementById('color-palette');
const editAnimationSelect = document.getElementById('edit-animation');
const previewNameEl = document.getElementById('preview-name');
const animInfoEl = document.getElementById('animation-info');
const animDescEl = document.getElementById('anim-desc');
const animAuthorEl = document.getElementById('anim-author');
const codeViewEl = document.getElementById('code-view');
const codeModalEl = document.getElementById('code-modal');
const btnShowCode = document.getElementById('btn-show-code');

const addCategoryBtn = document.getElementById('add-category-btn');
const addPageBreakBtn = document.getElementById('add-page-break-btn');
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');
const newStartBtn = document.getElementById('new-start-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const loadBrowserBtn = document.getElementById('load-browser-btn');
const saveBrowserBtn = document.getElementById('save-browser-btn');

const langSelect = document.getElementById('lang-select-editor');
const themeToggle = document.getElementById('theme-toggle');

const COLORS = [
    'primary', 'secondary', 'tertiary', 'error', 'neutral', 'outline',
    'teal', 'green', 'yellow', 'orange', 'pink', 'indigo', 'brown', 'cyan'
];

const COLOR_CODES = {
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

// --- Localization Helper ---
function t(key, params = {}) {
    let msg = (messages[currentLang] && messages[currentLang][key]) || (messages._common && messages._common[key]) || messages.en[key] || key;
    for (const [pKey, pVal] of Object.entries(params)) {
        msg = msg.replace(`{${pKey}}`, pVal);
    }
    return msg;
}

// Initialize
function init() {
    setupLanguage();
    setupTheme();
    setupAnimationEngine();
    setupEventListeners();
    renderColorPalette();
    populateAnimationOptions();

    // Start with default categories
    loadDefaultCategories();
}


function setupTheme() {
    const savedTheme = localStorage.getItem('category-editor-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    themeToggle.checked = (currentTheme === 'dark');
    applyTheme();
}

function applyTheme() {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${currentTheme}`);
}

function setupLanguage() {
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    const prefixes = ['ja', 'de', 'es', 'fr', 'pt', 'ko', 'zh', 'en'];
    let matched = 'en';

    if (langParam && prefixes.includes(langParam)) {
        matched = langParam;
    } else {
        const userLang = navigator.language || navigator.userLanguage;
        for (const prefix of prefixes) {
            if (userLang.startsWith(prefix)) {
                matched = prefix;
                break;
            }
        }
    }
    currentLang = matched;
    langSelect.value = matched;
    updateTranslations();
}

function updateTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}

function setupAnimationEngine() {
    const canvas = document.getElementById('animation-canvas');
    animationEngine = new AnimationEngine(canvas);
    animationRegistry.forEach(anim => {
        animationEngine.register(anim.id, anim.class, anim.id);
    });
    animationEngine.resize();
    window.addEventListener('resize', () => animationEngine.resize());
}

function setupEventListeners() {
    langSelect.addEventListener('change', (e) => {
        currentLang = e.target.value;
        updateTranslations();
        renderCategoryList();
        populateAnimationOptions();
        renderDetail();
    });

    themeToggle.addEventListener('change', () => {
        currentTheme = themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('category-editor-theme', currentTheme);
        applyTheme();

        // Studio style slider requires explicit class update for the body too
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${currentTheme}`);
    });

    addCategoryBtn.addEventListener('click', () => {
        const newCat = {
            name: 'New Category',
            color: 'primary',
            animation: 'default',
            tags: ''
        };
        categories.push(newCat);
        selectedIndex = categories.length - 1;
        renderCategoryList();
        renderDetail();
        updateCodeView();

        // Scroll to bottom
        categoryListEl.scrollTop = categoryListEl.scrollHeight;
    });

    addPageBreakBtn.addEventListener('click', () => {
        const newPB = {
            name: `${SYSTEM_CATEGORY_PAGE_BREAK}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        categories.push(newPB);
        selectedIndex = categories.length - 1;
        renderCategoryList();
        renderDetail();
        updateCodeView();

        // Scroll to bottom
        categoryListEl.scrollTop = categoryListEl.scrollHeight;
    });

    editNameInput.addEventListener('input', (e) => {
        if (selectedIndex === -1) return;
        const name = e.target.value;
        categories[selectedIndex].name = name;
        previewNameEl.textContent = name;
        updateListItem(selectedIndex);
        updateCodeView();
    });

    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tag = tagInput.value.trim().replace(/,/g, '');
            if (tag && selectedIndex !== -1) {
                const currentTags = categories[selectedIndex].tags ? categories[selectedIndex].tags.split(',').map(t => t.trim()) : [];
                if (!currentTags.includes(tag)) {
                    currentTags.push(tag);
                    categories[selectedIndex].tags = currentTags.join(', ');
                    renderTags();
                    updateCodeView();
                }
                tagInput.value = '';
            }
        }
    });

    editAnimationSelect.addEventListener('change', (e) => {
        if (selectedIndex === -1) return;
        categories[selectedIndex].animation = e.target.value;
        updateAnimationInfo();
        updatePreview();
        updateCodeView();
    });

    editAnimationSelect.addEventListener('mouseenter', () => {
        updateAnimationInfo();
    });

    editAnimationSelect.addEventListener('mouseleave', () => {
        // Only hide if it's the 'none' animation or something
    });

    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', handleImport);
    exportBtn.addEventListener('click', handleExport);

    newStartBtn.addEventListener('click', () => {
        if (confirm(t('confirm-load-default'))) {
            loadDefaultCategories();
        }
    });

    clearAllBtn.addEventListener('click', () => {
        if (confirm(t('confirm-clear-all'))) {
            categories = [];
            selectedIndex = -1;
            renderCategoryList();
            renderDetail();
            updateCodeView();
        }
    });

    btnShowCode.addEventListener('click', () => {
        codeModalEl.classList.remove('hidden');
    });

    loadBrowserBtn.addEventListener('click', handleLoadFromBrowser);
    saveBrowserBtn.addEventListener('click', handleSaveToBrowser);

    window.addEventListener('click', (e) => {
        if (e.target === codeModalEl) {
            codeModalEl.classList.add('hidden');
        }
    });

    // Drag and Drop for Reordering
    let dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';

    categoryListEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.category-item.dragging');
        if (!dragging) return;

        const siblings = [...categoryListEl.querySelectorAll('.category-item:not(.dragging)')];
        let nextSibling = siblings.find(sibling => {
            return e.clientY <= sibling.getBoundingClientRect().top + sibling.getBoundingClientRect().height / 2;
        });

        if (nextSibling) {
            categoryListEl.insertBefore(dropIndicator, nextSibling);
        } else {
            categoryListEl.appendChild(dropIndicator);
        }
    });

    categoryListEl.addEventListener('dragenter', (e) => e.preventDefault());

    categoryListEl.addEventListener('dragleave', (e) => {
        if (e.target === categoryListEl && !categoryListEl.contains(e.relatedTarget)) {
            if (dropIndicator.parentNode) dropIndicator.remove();
        }
    });

    categoryListEl.addEventListener('drop', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.category-item.dragging');
        if (!dragging) return;

        if (dropIndicator.parentNode) {
            categoryListEl.insertBefore(dragging, dropIndicator);
            dropIndicator.remove();
        }

        const items = [...categoryListEl.querySelectorAll('.category-item')];
        const newCategories = items.map(item => categories[parseInt(item.dataset.index)]);
        const oldSelected = selectedIndex !== -1 ? categories[selectedIndex] : null;

        categories = newCategories;
        if (oldSelected) {
            selectedIndex = categories.indexOf(oldSelected);
        }
        renderCategoryList();
        updateCodeView();
    });
}

function loadDefaultCategories() {
    const defaultSet = [
        { name: t('init-cat-dev'), color: 'primary', tags: 'dev, code', animation: 'digital_rain' },
        { name: t('init-cat-meeting'), color: 'secondary', tags: 'meeting, sync', animation: 'migrating_birds' },
        { name: t('init-cat-research'), color: 'tertiary', tags: 'research, tech', animation: 'ripple' },
        { name: t('init-cat-admin'), color: 'neutral', tags: 'admin, mail', animation: 'dot_typing' },
        { name: t('init-cat-break'), color: 'outline', tags: 'break, refresh', animation: 'coffee_drip' }
    ];

    categories = defaultSet;
    selectedIndex = 0;
    renderCategoryList();
    renderDetail();
    updateCodeView();
}

function renderCategoryList() {
    categoryListEl.innerHTML = '';
    categories.forEach((cat, idx) => {
        const item = document.createElement('div');
        const isPageBreak = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);
        item.className = 'category-item' + (isPageBreak ? ' page-break' : '') + (idx === selectedIndex ? ' active' : '');
        item.draggable = true;
        item.dataset.index = idx;

        const dragHandle = document.createElement('span');
        dragHandle.className = 'material-symbols-outlined drag-handle';
        dragHandle.textContent = 'drag_indicator';
        item.appendChild(dragHandle);

        if (isPageBreak) {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'cat-name';
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined';
            icon.textContent = 'insert_page_break';
            nameSpan.appendChild(icon);
            nameSpan.appendChild(document.createTextNode(' ' + t('page-break-label')));
            item.appendChild(nameSpan);
        } else {
            const dot = document.createElement('span');
            dot.className = 'cat-dot';
            dot.style.backgroundColor = COLOR_CODES[cat.color || 'primary'];
            item.appendChild(dot);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'cat-name';
            nameSpan.textContent = cat.name;
            item.appendChild(nameSpan);
        }

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn delete-item-btn';
        const deleteIcon = document.createElement('span');
        deleteIcon.className = 'material-symbols-outlined';
        deleteIcon.textContent = 'delete';
        deleteBtn.appendChild(deleteIcon);
        deleteBtn.title = t('delete');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            const confirmMsg = isPageBreak ? t('confirm-delete-page-break') : t('confirm-delete-category', { name: cat.name });
            if (confirm(confirmMsg)) {
                categories.splice(idx, 1);
                if (selectedIndex === idx) selectedIndex = -1;
                else if (selectedIndex > idx) selectedIndex--;
                renderCategoryList();
                renderDetail();
                updateCodeView();
            }
        };
        item.appendChild(deleteBtn);

        item.onclick = () => {
            selectedIndex = idx;
            renderCategoryList();
            renderDetail();
        };

        item.ondragstart = () => item.classList.add('dragging');
        item.ondragend = () => item.classList.remove('dragging');

        categoryListEl.appendChild(item);
    });
}

function updateListItem(idx) {
    const item = categoryListEl.children[idx];
    if (!item) return;
    const cat = categories[idx];
    const nameEl = item.querySelector('.cat-name');
    if (nameEl) {
        nameEl.textContent = '';
        if (cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) {
             const icon = document.createElement('span');
             icon.className = 'material-symbols-outlined';
             icon.textContent = 'insert_page_break';
             nameEl.appendChild(icon);
             nameEl.appendChild(document.createTextNode(' ' + t('page-break-label')));
        } else {
             nameEl.textContent = cat.name;
        }
    }
}

function renderDetail() {
    const previewContainer = document.getElementById('preview-container');
    const previewOverlay = document.querySelector('.preview-overlay-base');

    if (selectedIndex === -1 || selectedIndex >= categories.length) {
        detailSection.classList.remove('hidden');
        previewNameEl.textContent = '';
        animationEngine.stop();
        animInfoEl.classList.add('hidden');
        previewContainer.className = 'preview-container';
        previewOverlay.className = 'preview-overlay-base';
        return;
    }

    const cat = categories[selectedIndex];
    const isPageBreak = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);

    if (isPageBreak) {
        detailSection.classList.add('hidden');
        previewNameEl.textContent = `--- ${t('page-break-label')} ---`;
        updatePreview();
        animInfoEl.classList.add('hidden');
        return;
    }

    detailSection.classList.remove('hidden');
    editNameInput.value = cat.name;
    previewNameEl.textContent = cat.name;
    renderTags();
    updateColorSelection();
    editAnimationSelect.value = cat.animation || 'default';
    updateAnimationInfo();

    // Update preview theme classes
    const colorClass = `cat-${cat.color || 'primary'}`;
    previewContainer.className = `preview-container ${colorClass} anim-active`;
    previewOverlay.className = `preview-overlay-base ${colorClass} anim-active`;

    updatePreview();
}

function updateAnimationInfo() {
    const animId = editAnimationSelect.value;
    if (!animId || animId === 'none') {
        animInfoEl.classList.add('hidden');
        return;
    }

    const effectiveId = animId === 'default' ? 'digital_rain' : animId;
    const anim = animationRegistry.find(a => a.id === effectiveId);

    if (anim && anim.metadata) {
        animInfoEl.classList.remove('hidden');
        const desc = typeof anim.metadata.description === 'object' ?
            (anim.metadata.description[currentLang] || anim.metadata.description['en']) :
            anim.metadata.description;
        animDescEl.textContent = desc || '';

        const author = anim.metadata.author || t('anim-unknown-author');
        animAuthorEl.textContent = `${t('anim-author-label')}: ${author}`;
    } else {
        animInfoEl.classList.add('hidden');
    }
}

function renderTags() {
    tagListEl.innerHTML = '';
    const tags = categories[selectedIndex].tags ? categories[selectedIndex].tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    tags.forEach((tag, idx) => {
        const pill = document.createElement('span');
        pill.className = 'tag-pill';

        const tagText = document.createElement('span');
        tagText.textContent = tag;
        pill.appendChild(tagText);

        const removeBtn = document.createElement('span');
        removeBtn.className = 'material-symbols-outlined tag-remove';
        removeBtn.textContent = 'close';
        pill.appendChild(removeBtn);

        removeBtn.onclick = (e) => {
            e.stopPropagation();
            tags.splice(idx, 1);
            categories[selectedIndex].tags = tags.join(', ');
            renderTags();
            updateCodeView();
        };
        tagListEl.appendChild(pill);
    });
}

function renderColorPalette() {
    colorPaletteEl.innerHTML = '';
    COLORS.forEach(color => {
        const opt = document.createElement('div');
        opt.className = 'color-option';
        opt.style.backgroundColor = COLOR_CODES[color];
        opt.dataset.color = color;

        const check = document.createElement('span');
        check.className = 'material-symbols-outlined';
        check.textContent = 'check';
        opt.appendChild(check);

        opt.onclick = () => {
            if (selectedIndex === -1) return;
            categories[selectedIndex].color = color;
            updateColorSelection();
            updatePreview();
            renderCategoryList();
            updateCodeView();
        };
        colorPaletteEl.appendChild(opt);
    });
}

function updateColorSelection() {
    if (selectedIndex === -1) return;
    const color = categories[selectedIndex].color || 'primary';
    colorPaletteEl.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === color);
    });
}

function populateAnimationOptions() {
    const currentVal = editAnimationSelect.value;
    editAnimationSelect.innerHTML = '';

    const noneOpt = document.createElement('option');
    noneOpt.value = 'none';
    noneOpt.textContent = t('anim-none');
    editAnimationSelect.appendChild(noneOpt);

    const defOpt = document.createElement('option');
    defOpt.value = 'default';
    defOpt.textContent = t('anim-default');
    editAnimationSelect.appendChild(defOpt);

    animationRegistry.forEach(anim => {
        if (anim.devOnly) return; // Skip devOnly animations
        const opt = document.createElement('option');
        opt.value = anim.id;
        opt.textContent = (typeof anim.metadata.name === 'object' ? (anim.metadata.name[currentLang] || anim.metadata.name['en']) : anim.metadata.name) || anim.id;
        editAnimationSelect.appendChild(opt);
    });

    if (currentVal) editAnimationSelect.value = currentVal;
}

function updatePreview() {
    if (!animationEngine) return;
    if (selectedIndex === -1) {
        animationEngine.stop();
        return;
    }
    const cat = categories[selectedIndex];
    const isPageBreak = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);

    if (isPageBreak) {
        animationEngine.stop();
        return;
    }

    const color = COLOR_CODES[cat.color || 'primary'];
    const animation = cat.animation || 'default';

    // Set exclusion areas to match sidebar behavior
    const canvasRect = animationEngine.canvas.getBoundingClientRect();
    const nameRect = document.getElementById('preview-name-heading').getBoundingClientRect();
    const timerRect = document.querySelector('.preview-timer-box').getBoundingClientRect();

    const padding = 12;
    // For small viewport/preview, ensure it doesn't break if elements have 0 size (hidden)
    const x1 = Math.min(nameRect.left || Infinity, timerRect.left || Infinity) - canvasRect.left - padding;
    const y1 = Math.min(nameRect.top || Infinity, timerRect.top || Infinity) - canvasRect.top - padding;
    const x2 = Math.max(nameRect.right || 0, timerRect.right || 0) - canvasRect.left + padding;
    const y2 = Math.max(nameRect.bottom || 0, timerRect.bottom || 0) - canvasRect.top + padding;

    animationEngine.setExclusionAreas([{
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1
    }]);

    animationEngine.start(animation === 'default' ? 'digital_rain' : animation, Date.now(), color);
}

function updateCodeView() {
    const ndjson = categories.map(cat => {
        const item = { ...cat };
        delete item.order;
        delete item.id;
        if (item.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) {
            return JSON.stringify({ type: 'page-break' });
        }
        return JSON.stringify(item);
    }).join('\n');
    codeViewEl.textContent = ndjson;
}

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        const imported = lines.map(l => {
            const data = JSON.parse(l);
            if (data.type === 'page-break') {
                return { name: `${SYSTEM_CATEGORY_PAGE_BREAK}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
            }
            return data;
        });

        categories = imported;
        selectedIndex = categories.length > 0 ? 0 : -1;
        renderCategoryList();
        renderDetail();
        updateCodeView();
        showToast(t('toast-import-success'));
    } catch (err) {
        console.error(err);
        showToast(t('toast-import-failed'));
    }
    importInput.value = '';
}

function handleExport() {
    if (categories.length === 0) {
        showToast(t('toast-no-categories'));
        return;
    }
    const ndjson = categories.map(cat => {
        const item = { ...cat };
        delete item.order;
        delete item.id;
        if (item.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) {
            return JSON.stringify({ type: 'page-break' });
        }
        return JSON.stringify(item);
    }).join('\n');

    const blob = new Blob([ndjson], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quicklog_categories_${new Date().toISOString().slice(0, 10)}.ndjson`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('toast-export-success'));
}

async function handleLoadFromBrowser() {
    if (confirm(t('confirm-load-browser'))) {
        try {
            const browserCategories = await dbGetAll('categories');
            if (browserCategories && browserCategories.length > 0) {
                categories = browserCategories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                selectedIndex = 0;
                renderCategoryList();
                renderDetail();
                updateCodeView();
                showToast(t('toast-load-browser-success'));
            }
        } catch (err) {
            console.error(err);
            showToast(t('toast-load-browser-failed'));
        }
    }
}

async function handleSaveToBrowser() {
    if (categories.length === 0) {
        showToast(t('toast-no-categories'));
        return;
    }
    if (confirm(t('confirm-save-browser'))) {
        try {
            // Prepare categories for DB import format
            const itemsToSave = categories.map(cat => {
                if (cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) {
                    return { type: 'page-break' };
                }
                return {
                    name: cat.name,
                    color: isValidColor(cat.color) ? cat.color : 'primary',
                    tags: cat.tags || '',
                    animation: cat.animation || 'default'
                };
            });

            await dbImportCategories(itemsToSave, 'overwrite');
            showToast(t('toast-save-browser-success'));
        } catch (err) {
            console.error(err);
            showToast(t('toast-save-browser-failed'));
        }
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Start
init();
