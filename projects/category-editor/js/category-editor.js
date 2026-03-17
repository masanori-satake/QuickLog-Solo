/**
 * QL-Category Editor Logic
 */

import { animations as animationRegistry } from '../shared/js/animation_registry.js';
import { AnimationEngine } from '../shared/js/animations.js';
import { messages } from '../shared/js/messages.js';
import { SYSTEM_CATEGORY_PAGE_BREAK } from '../shared/js/utils.js';

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
const newStartBtn = document.getElementById('new-start-btn');
const clearAllBtn = document.getElementById('clear-all-btn');

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
    const urlParams = new URLSearchParams(window.location.search);
    setupLanguage(urlParams);
    setupAppMode(urlParams);
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

function setupAppMode(urlParams) {
    if (urlParams.get('from') === 'app') {
        const backLink = document.querySelector('.back-link');
        if (backLink) backLink.classList.add('hidden');
    }
}

function setupLanguage(urlParams) {
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
    updateBackLink();
}

function updateBackLink() {
    const backLink = document.querySelector('.back-link');
    if (backLink) {
        backLink.href = `../web/index.html?lang=${encodeURIComponent(currentLang)}`;
    }
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

        const url = new URL(window.location);
        url.searchParams.set('lang', currentLang);
        window.history.replaceState({}, '', url);

        updateTranslations();
        updateBackLink();
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

        // Full UI refresh to ensure theme variables are picked up and dataset is consistent
        renderDetail();
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
        renderDetail();
        updateCodeView();
    });

    editAnimationSelect.addEventListener('mouseenter', () => {
        updateAnimationInfo();
    });

    editAnimationSelect.addEventListener('mouseleave', () => {
        // Only hide if it's the 'none' animation or something
    });

    importBtn.addEventListener('click', handleImport);
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

    window.addEventListener('click', (e) => {
        if (e.target === codeModalEl) {
            codeModalEl.classList.add('hidden');
        }
        // Close category menu if clicking elsewhere
        const menu = document.querySelector('.category-menu');
        if (menu && !menu.contains(e.target)) {
            menu.remove();
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
        const dragIdx = parseInt(dragging.dataset.index);
        const dragItem = categories[dragIdx];

        const newCategories = items.map(item => categories[parseInt(item.dataset.index)]);

        categories = newCategories;
        selectedIndex = categories.indexOf(dragItem);
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
            nameSpan.title = cat.name;
            item.appendChild(nameSpan);
        }

        if (isPageBreak) {
            // Delete button for Page Break
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'icon-btn delete-item-btn';
            const deleteIcon = document.createElement('span');
            deleteIcon.className = 'material-symbols-outlined';
            deleteIcon.textContent = 'delete';
            deleteBtn.appendChild(deleteIcon);
            deleteBtn.title = t('delete');
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                categories.splice(idx, 1);
                if (selectedIndex === idx) selectedIndex = -1;
                else if (selectedIndex > idx) selectedIndex--;
                renderCategoryList();
                renderDetail();
                updateCodeView();
            };
            item.appendChild(deleteBtn);
        } else {
            // More button for regular categories
            const moreBtn = document.createElement('button');
            moreBtn.className = 'icon-btn more-item-btn';
            const moreIcon = document.createElement('span');
            moreIcon.className = 'material-symbols-outlined';
            moreIcon.textContent = 'more_vert';
            moreBtn.appendChild(moreIcon);
            moreBtn.onclick = (e) => {
                e.stopPropagation();
                showCategoryMenu(e, idx);
            };
            item.appendChild(moreBtn);
        }

        item.onclick = () => {
            selectedIndex = idx;
            renderCategoryList();
            renderDetail();
        };

        item.ondragstart = () => {
            item.classList.add('dragging');
            // Close any open menu when dragging starts
            const menu = document.querySelector('.category-menu');
            if (menu) menu.remove();
        };
        item.ondragend = () => item.classList.remove('dragging');

        categoryListEl.appendChild(item);
    });
}

function showCategoryMenu(e, idx) {
    // Remove any existing menu
    const existingMenu = document.querySelector('.category-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'category-menu';

    const duplicateBtn = document.createElement('button');
    const duplicateIcon = document.createElement('span');
    duplicateIcon.className = 'material-symbols-outlined';
    duplicateIcon.textContent = 'content_copy';
    duplicateBtn.appendChild(duplicateIcon);
    duplicateBtn.appendChild(document.createTextNode(' ' + t('duplicate')));
    duplicateBtn.onclick = (event) => {
        event.stopPropagation();
        duplicateCategory(idx);
        menu.remove();
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete';
    const deleteIcon = document.createElement('span');
    deleteIcon.className = 'material-symbols-outlined';
    deleteIcon.textContent = 'delete';
    deleteBtn.appendChild(deleteIcon);
    deleteBtn.appendChild(document.createTextNode(' ' + t('delete')));
    deleteBtn.onclick = (event) => {
        event.stopPropagation();
        const cat = categories[idx];
        if (confirm(t('confirm-delete-category', { name: cat.name }))) {
            categories.splice(idx, 1);
            if (selectedIndex === idx) selectedIndex = -1;
            else if (selectedIndex > idx) selectedIndex--;
            renderCategoryList();
            renderDetail();
            updateCodeView();
        }
        menu.remove();
    };

    menu.appendChild(duplicateBtn);
    menu.appendChild(deleteBtn);

    // Position the menu
    document.body.appendChild(menu);
    const rect = e.currentTarget.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY}px`;
    menu.style.left = `${rect.right - menu.offsetWidth + window.scrollX}px`;
}

function duplicateCategory(idx) {
    const original = categories[idx];
    const baseName = original.name.replace(/\s*\(\d+\)$/, '').trim();

    // Find the next available number
    let maxNum = 0;
    const pattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\((\\d+)\\)$`);

    categories.forEach(cat => {
        const match = cat.name.match(pattern);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNum) maxNum = num;
        }
    });

    const newName = `${baseName} (${maxNum + 1})`;
    const newCat = { ...original, name: newName };

    categories.splice(idx + 1, 0, newCat);
    selectedIndex = idx + 1;
    renderCategoryList();
    renderDetail();
    updateCodeView();
}

function updateListItem(idx) {
    const item = categoryListEl.children[idx];
    if (!item) return;
    const cat = categories[idx];
    const nameEl = item.querySelector('.cat-name');
    if (nameEl) {
        nameEl.textContent = '';
        nameEl.title = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK) ? '' : cat.name;
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

/**
 * Utility to clean up all category color classes from an element.
 * @param {HTMLElement} el
 */
function clearCategoryClasses(el) {
    if (!el) return;
    const classes = Array.from(el.classList).filter(c => c.startsWith('cat-'));
    classes.forEach(c => el.classList.remove(c));
    // Specifically remove any potential residual background color if needed
}

function renderDetail() {
    try {
        const previewOverlay = document.getElementById('preview-overlay-base');
        const previewContainer = document.getElementById('preview-container');

        if (!previewOverlay || !previewContainer) return;

        // Definitive cleanup of legacy classes to prevent interference from m3-theme.css solid rules
        clearCategoryClasses(previewOverlay);
        clearCategoryClasses(previewContainer);

        if (selectedIndex === -1 || selectedIndex >= categories.length) {
            detailSection.classList.add('hidden');
            previewNameEl.textContent = '';
            if (animationEngine) animationEngine.stop();
            animInfoEl.classList.add('hidden');
            previewOverlay.classList.remove('anim-active');
            previewContainer.classList.remove('anim-active');
            return;
        }

        const cat = categories[selectedIndex];
        const isPageBreak = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);

        detailSection.classList.remove('hidden');
        const previewSection = document.querySelector('.preview-section');

        if (isPageBreak) {
            if (previewSection) previewSection.classList.add('hidden');
            editNameInput.value = ` ${t('page-break-label')}`;
            editNameInput.disabled = true;
            tagInput.disabled = true;
            editAnimationSelect.disabled = true;

            // Clear tags and color selection for Page Break
            tagListEl.innerHTML = '';
            colorPaletteEl.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
                opt.style.pointerEvents = 'none';
                opt.style.opacity = '0.5';
            });

            previewNameEl.textContent = `--- ${t('page-break-label')} ---`;
            previewOverlay.classList.remove('anim-active');
            previewContainer.classList.remove('anim-active');
            updatePreview();
            animInfoEl.classList.add('hidden');
            return;
        }

        if (previewSection) previewSection.classList.remove('hidden');
        editNameInput.disabled = false;
        tagInput.disabled = false;
        editAnimationSelect.disabled = false;
        colorPaletteEl.querySelectorAll('.color-option').forEach(opt => {
            opt.style.pointerEvents = 'auto';
            opt.style.opacity = '1';
        });

        editNameInput.value = cat.name;
        previewNameEl.textContent = cat.name;
        renderTags();
        updateColorSelection();
        editAnimationSelect.value = cat.animation || 'default';
        updateAnimationInfo();

        // Update preview theme classes (Aligned with app.js architecture)
        const color = cat.color || 'primary';
        const animation = cat.animation || 'default';
        const animActive = animation !== 'none';

        if (animActive) {
            previewOverlay.classList.add('anim-active');
            previewOverlay.classList.add(`cat-${color}`);
            previewContainer.classList.add('anim-active');
        } else {
            previewOverlay.classList.remove('anim-active');
            previewContainer.classList.remove('anim-active');
        }

        updatePreview();
    } catch {
        // Render detail failed
    }
}

function updateAnimationInfo() {
    const animId = editAnimationSelect.value;
    animInfoEl.classList.remove('hidden');

    if (!animId || animId === 'none') {
        animDescEl.textContent = '';
        animAuthorEl.innerHTML = '&nbsp;'; // Maintain height even when empty
        return;
    }

    const effectiveId = animId === 'default' ? 'digital_rain' : animId;
    const anim = animationRegistry.find(a => a.id === effectiveId);

    if (anim && anim.metadata) {
        const desc = typeof anim.metadata.description === 'object' ?
            (anim.metadata.description[currentLang] || anim.metadata.description['en']) :
            anim.metadata.description;
        animDescEl.textContent = desc || '';

        const author = anim.metadata.author || t('anim-unknown-author');
        animAuthorEl.textContent = `${t('anim-author-label')}: ${author}`;
    } else {
        animDescEl.textContent = '';
        animAuthorEl.innerHTML = '&nbsp;';
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
            renderDetail();
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
    const animation = cat.animation || 'default';

    if (isPageBreak || animation === 'none') {
        animationEngine.stop();
        return;
    }

    // Use theme-aware color from CSS variables
    const colorKey = cat.color || 'primary';
    const computedStyle = getComputedStyle(document.body);
    const color = computedStyle.getPropertyValue(`--custom-cat-${colorKey}`).trim() || COLOR_CODES[colorKey] || '#1976d2';

    // Set exclusion areas to match sidebar behavior
    const canvasRect = animationEngine.canvas.getBoundingClientRect();

    const exclusionAreas = [];
    const paddingX = 4;
    const paddingY = 2;

    const previewName = document.getElementById('preview-name');
    const timerLabel = document.getElementById('preview-status-label');
    const timerElapsed = document.getElementById('preview-elapsed');

    [previewName, timerLabel, timerElapsed].forEach(el => {
        if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                exclusionAreas.push({
                    x: rect.left - canvasRect.left - paddingX,
                    y: rect.top - canvasRect.top - paddingY,
                    width: rect.width + (paddingX * 2),
                    height: rect.height + (paddingY * 2)
                });
            }
        }
    });

    animationEngine.setExclusionAreas(exclusionAreas);
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

async function handleImport() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) return;

        const lines = text.split('\n').filter(l => l.trim());
        const imported = lines.map(l => {
            const data = JSON.parse(l);
            if (data.type === 'page-break') {
                return { name: `${SYSTEM_CATEGORY_PAGE_BREAK}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
            }
            // Normalize data to ensure all fields exist, matching app.js behavior
            return {
                name: data.name || 'Imported Category',
                color: data.color || 'primary',
                tags: data.tags || '',
                animation: data.animation || 'default'
            };
        });

        categories = imported;
        selectedIndex = categories.length > 0 ? 0 : -1;
        renderCategoryList();
        renderDetail();
        updateCodeView();
        showToast(t('toast-import-success'));
    } catch (err) {
        console.error(err);
        if (err.name === 'NotAllowedError') {
             console.warn('Clipboard access denied');
        } else {
             showToast(t('toast-import-failed'));
        }
    }
}

async function handleExport() {
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

    try {
        await navigator.clipboard.writeText(ndjson);
        showToast(t('toast-export-success'));
    } catch (err) {
        console.error('Failed to copy categories:', err);
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
