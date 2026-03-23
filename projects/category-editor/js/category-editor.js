/**
 * QL-Category Editor Logic
 */

import { AnimationEngine } from '../shared/js/animations.js';
import { animations as animationRegistry } from '../shared/js/animation_registry.js';
import { messages } from '../shared/js/messages.js';
import { SYSTEM_CATEGORY_PAGE_BREAK } from '../shared/js/utils.js';

import { initHistory } from './history.js';
import { initUI } from './ui.js';
import { initDataIO } from './data-io.js';

const state = {
    currentLang: 'en',
    categories: [],
    selectedIndices: [],
    lastSelectedIndex: -1,
    animationEngine: null,
    currentTheme: 'dark',
    historyStack: [],
    redoStack: [],
    isRecordingInput: false,
    inputInitialState: null,

    t: (key, params = {}) => {
        let msg = (messages[state.currentLang] && messages[state.currentLang][key]) || (messages._common && messages._common[key]) || messages.en[key] || key;
        for (const [pKey, pVal] of Object.entries(params)) {
            msg = msg.replace(`{${pKey}}`, pVal);
        }
        return msg;
    },
    showToast: (msg) => {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
};

const elements = {
    categoryListEl: document.getElementById('category-list'),
    detailSection: document.getElementById('detail-section'),
    editNameInput: document.getElementById('edit-name'),
    tagListEl: document.getElementById('tag-list'),
    tagInput: document.getElementById('tag-input'),
    colorPaletteEl: document.getElementById('color-palette'),
    editAnimationSelect: document.getElementById('edit-animation'),
    previewNameEl: document.getElementById('preview-name'),
    animInfoEl: document.getElementById('animation-info'),
    animDescEl: document.getElementById('anim-desc'),
    animAuthorEl: document.getElementById('anim-author'),
    codeViewEl: document.getElementById('code-view'),
    codeModalEl: document.getElementById('code-modal'),
    btnShowCode: document.getElementById('btn-show-code'),
    addCategoryBtn: document.getElementById('add-category-btn'),
    deleteSelectedBtn: document.getElementById('delete-selected-btn'),
    addPageBreakBtn: document.getElementById('add-page-break-btn'),
    importBtn: document.getElementById('import-btn'),
    exportBtn: document.getElementById('export-btn'),
    newStartBtn: document.getElementById('new-start-btn'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    globalTagListEl: document.getElementById('global-tag-list'),
    langSelect: document.getElementById('lang-select-editor'),
    themeToggle: document.getElementById('theme-toggle'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn'),
    openTagReplaceBtn: document.getElementById('open-tag-replace-btn'),
    tagReplaceModalEl: document.getElementById('tag-replace-modal'),
    replaceTableBodyEl: document.getElementById('replace-table-body'),
    tagReplaceBtn: document.getElementById('tag-replace-btn'),
    tagReplaceCloseBtn: document.getElementById('tag-replace-close-btn'),
    closeTagReplaceModalBtn: document.getElementById('close-tag-replace-modal-btn'),
    modalUndoBtn: document.getElementById('modal-undo-btn'),
    modalRedoBtn: document.getElementById('modal-redo-btn')
};

let historyMod, uiMod, dataIoMod;

function init() {
    const urlParams = new URLSearchParams(window.location.search);
    setupLanguage(urlParams);
    setupAppMode(urlParams);
    setupTheme();
    setupAnimationEngine();

    // Module initialization
    window.state = state;
    historyMod = initHistory(state, elements);
    uiMod = initUI(state, elements);
    dataIoMod = initDataIO(state, elements);

    // Cross-module state bridge
    state.recordAction = historyMod.recordAction;
    state.clearHistory = historyMod.clearHistory;
    state.undo = historyMod.undo;
    state.redo = historyMod.redo;
    state.commitInput = historyMod.commitInput;
    state.startInputRecording = historyMod.startInputRecording;

    state.renderCategoryList = uiMod.renderCategoryList;
    state.renderDetail = uiMod.renderDetail;
    state.renderColorPalette = uiMod.renderColorPalette;
    state.renderGlobalTagBox = uiMod.renderGlobalTagBox;
    state.populateAnimationOptions = uiMod.populateAnimationOptions;
    state.updateListItem = uiMod.updateListItem;

    state.updateCodeView = dataIoMod.updateCodeView;

    state.updatePreview = updatePreview;
    state.loadDefaultCategories = loadDefaultCategories;
    state.refreshUIAfterHistoryChange = refreshUIAfterHistoryChange;

    setupEventListeners();

    uiMod.renderColorPalette();
    uiMod.populateAnimationOptions();
    loadDefaultCategories();
    uiMod.renderGlobalTagBox();
    state.clearHistory();
}

function setupTheme() {
    const savedTheme = localStorage.getItem('category-editor-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    state.currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    elements.themeToggle.checked = (state.currentTheme === 'dark');
    applyTheme();
}

function applyTheme() {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${state.currentTheme}`);
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
    state.currentLang = matched;
    elements.langSelect.value = matched;
    updateTranslations();
    updateBackLink();
}

function updateBackLink() {
    const backLink = document.querySelector('.back-link');
    if (backLink) {
        backLink.href = `../web/index.html?lang=${encodeURIComponent(state.currentLang)}`;
    }
}

function updateTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = state.t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = state.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = state.t(key);
    });
}

function setupAnimationEngine() {
    const canvas = document.getElementById('animation-canvas');
    state.animationEngine = new AnimationEngine(canvas);
    animationRegistry.forEach(anim => {
        state.animationEngine.register(anim.id, anim.class, anim.id);
    });
    state.animationEngine.resize();
    window.addEventListener('resize', () => state.animationEngine.resize());
}

function setupEventListeners() {
    elements.langSelect.addEventListener('change', (e) => {
        state.currentLang = e.target.value;

        const url = new URL(window.location);
        url.searchParams.set('lang', state.currentLang);
        window.history.replaceState({}, '', url);

        updateTranslations();
        updateBackLink();
        state.renderCategoryList();
        state.populateAnimationOptions();
        state.renderDetail();
    });

    elements.themeToggle.addEventListener('change', () => {
        state.currentTheme = elements.themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('category-editor-theme', state.currentTheme);
        applyTheme();
        state.renderDetail();
    });

    elements.btnShowCode.addEventListener('click', () => {
        elements.codeModalEl.classList.remove('hidden');
    });

    if (elements.openTagReplaceBtn) {
        elements.openTagReplaceBtn.addEventListener('click', () => {
            if (uiMod.renderTagReplaceModal) uiMod.renderTagReplaceModal();
            elements.tagReplaceModalEl.classList.remove('hidden');
        });
    }

    window.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdKey = isMac ? e.metaKey : e.ctrlKey;

        if (cmdKey && e.key.toLowerCase() === 'z') {
            if (e.shiftKey) {
                state.redo();
            } else {
                state.undo();
            }
            e.preventDefault();
        } else if (cmdKey && e.key.toLowerCase() === 'y') {
            state.redo();
            e.preventDefault();
        }
    });

    window.addEventListener('click', (e) => {
        if (e.target === elements.codeModalEl) {
            elements.codeModalEl.classList.add('hidden');
        }
        const menu = document.querySelector('.category-menu');
        if (menu && !menu.contains(e.target)) {
            menu.remove();
        }
    });
}

function loadDefaultCategories() {
    const defaultSet = [
        { name: state.t('init-cat-dev'), color: 'primary', tags: state.t('init-tag-dev'), animation: 'digital_rain' },
        { name: state.t('init-cat-meeting'), color: 'secondary', tags: state.t('init-tag-meeting'), animation: 'migrating_birds' },
        { name: state.t('init-cat-research'), color: 'tertiary', tags: state.t('init-tag-research'), animation: 'ripple' },
        { name: state.t('init-cat-admin'), color: 'neutral', tags: state.t('init-tag-admin'), animation: 'dot_typing' },
        { name: state.t('init-cat-break'), color: 'outline', tags: state.t('init-tag-break'), animation: 'coffee_drip' }
    ];

    state.categories = defaultSet;
    state.selectedIndices = [0];
    state.lastSelectedIndex = 0;
    state.renderCategoryList();
    state.renderDetail();
    state.renderGlobalTagBox();
    state.updateCodeView();
}

function refreshUIAfterHistoryChange() {
    const prevSelectedIndices = [...state.selectedIndices];
    state.renderCategoryList();

    state.selectedIndices = prevSelectedIndices.filter(idx => idx < state.categories.length);
    if (state.selectedIndices.length === 0 && state.categories.length > 0) {
        state.selectedIndices = [0];
        state.lastSelectedIndex = 0;
    } else if (state.categories.length === 0) {
        state.selectedIndices = [];
        state.lastSelectedIndex = -1;
    }

    state.renderCategoryList();
    state.renderDetail();
    state.renderGlobalTagBox();
    state.updateCodeView();
    historyMod.updateHistoryButtons();
    if (uiMod.updateModalHistoryButtons) uiMod.updateModalHistoryButtons();
}

function updatePreview() {
    if (!state.animationEngine) return;
    if (state.selectedIndices.length === 0) {
        state.animationEngine.stop();
        return;
    }
    const idx = state.selectedIndices[0];
    const cat = state.categories[idx];
    if (!cat) return;

    const isPageBreak = cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);
    const animation = cat.animation || 'default';

    if (isPageBreak || animation === 'none') {
        state.animationEngine.stop();
        return;
    }

    const colorKey = cat.color || 'primary';
    const computedStyle = getComputedStyle(document.body);
    const color = computedStyle.getPropertyValue(`--custom-cat-${colorKey}`).trim() || uiMod.COLOR_CODES[colorKey] || '#1976d2';

    const canvasRect = state.animationEngine.canvas.getBoundingClientRect();
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

    state.animationEngine.setExclusionAreas(exclusionAreas);
    state.animationEngine.start(animation === 'default' ? 'digital_rain' : animation, Date.now(), color);
}

init();
