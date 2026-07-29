/**
 * QL-Animation Maker Integrated Logic
 */

import { messages } from '../shared/js/messages.js';
import { initDB, dbGetAll, dbPut, STORE_CATEGORIES, DB_NAME, SYNC_CHANNEL_NAME } from '../shared/js/db.js';
import {
    getCustomAnimationMetadataMap as sharedGetCustomAnimationMetadataMap,
    setCustomAnimationMetadataMap as sharedSetCustomAnimationMetadataMap,
} from '../shared/js/utils/storage.js';
import { AnimationEngine } from '../shared/js/animations.js';
import {
    saveAnimationBlob as idbSaveAnimationBlob,
    getAnimationBlob as idbGetAnimationBlob,
    deleteAnimationBlob as idbDeleteAnimationBlob,
    initAnimationDraftDB,
    saveAnimationDraftBlob,
    getAnimationDraftBlob,
    getAllAnimationDraftRecords,
    deleteAnimationDraftBlob,
    clearAnimationDraftDB,
} from '../shared/js/idb_storage.js';

const broadcastChannel = new BroadcastChannel(`${SYNC_CHANNEL_NAME}_${DB_NAME}`);

function broadcastSync(type = 'sync') {
    broadcastChannel.postMessage({ type });
}

// Color Codes (same as Category Editor)
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
    cyan: '#039be5',
    'retro-lcd': '#9bbc0f',
    'retro-crt': '#33ff33',
    'retro-nixie': '#ff5500',
};

const COLORS = Object.keys(COLOR_CODES);

// State
const state = {
    currentLang: 'en',
    currentTheme: 'dark',
    customAnimations: {}, // ID -> metadata
    selectedId: null,
    loadedId: null,
    selectionToken: 0,

    // Loaded GIF Frame Data
    gifFrames: [], // Array of { bitmap, duration }
    totalDuration: 0,
    isPlaying: true,
    virtualElapsedMs: 0,
    lastFrameTime: 0,
    gifWidth: 0,
    gifHeight: 0,
    gifBlob: null,
    gifFileName: null,

    // Active edit properties
    focusX: 0,
    focusY: 0,
    targetHeight: 100,
    currentScale: 1.0,
    maxWidth: 2030,
    scaleWithHeight: true,
    invert: false,
    exclusionStrategy: 'freedom',
    overflowBehavior: 'repeat',
    previewColor: 'primary',
    brightness: 1.0,
    animationEngine: null,

    // Interaction dragging state
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartFocusX: 0,
    dragStartFocusY: 0,

    // Drag-to-reorder list index
    draggedIndex: null,

    getMsg: (key) =>
        (messages[state.currentLang] && messages[state.currentLang][key]) ||
        (messages._common && messages._common[key]) ||
        messages.en[key] ||
        key,
};

// DOM Elements
const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    langSelect: document.getElementById('lang-select-maker'),
    animationList: document.getElementById('animation-list'),
    addAnimBtn: document.getElementById('add-anim-btn'),

    // Workspace & Placeholders
    noSelectionCard: document.getElementById('no-selection-card'),
    editorWorkspace: document.getElementById('editor-workspace'),

    // Metadata
    metaName: document.getElementById('meta-name'),
    metaAuthor: document.getElementById('meta-author'),
    metaDesc: document.getElementById('meta-desc'),

    // Preview
    canvas: document.getElementById('animation-canvas'),
    previewContainer: document.getElementById('preview-container'),
    boundaryTop: document.querySelector('.boundary-top'),
    boundaryBottom: document.querySelector('.boundary-bottom'),
    btnScaleDown: document.getElementById('btn-scale-down'),
    btnScaleUp: document.getElementById('btn-scale-up'),
    btnScaleReset: document.getElementById('btn-scale-reset'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    previewColorPalette: document.getElementById('preview-color-palette'),

    // Settings
    rawCanvas: document.getElementById('raw-canvas'),
    rawPreviewContainer: document.getElementById('raw-preview-container'),
    rawBoundaryTop: document.querySelector('.raw-boundary-top'),
    rawBoundaryBottom: document.querySelector('.raw-boundary-bottom'),
    dropZone: document.getElementById('drop-zone'),
    gifFileInput: document.getElementById('gif-file-input'),
    gifInfoBox: document.getElementById('gif-info-box'),
    gifFileNameSpan: document.getElementById('gif-file-name'),
    gifDimensionsSpan: document.getElementById('gif-dimensions'),
    gifFramesSpan: document.getElementById('gif-frames'),

    configExclusionStrategy: document.getElementById('config-exclusion-strategy'),
    configOverflow: document.getElementById('config-overflow'),
    configMaxWidth: document.getElementById('config-max-width'),
    configScaleHeight: document.getElementById('config-scale-height'),
    configInvert: document.getElementById('config-invert'),
    configBrightness: document.getElementById('config-brightness'),
    configBrightnessValue: document.getElementById('config-brightness-value'),

    // Monitor Specs
    monFocus: document.getElementById('mon-focus'),
    monScale: document.getElementById('mon-scale'),
    monTargetHeight: document.getElementById('mon-target-height'),

    // Data Transfer
    btnImport: document.getElementById('import-anim-btn'),
    qlanimFileInput: document.getElementById('qlanim-file-input'),
    dragInstruction: document.getElementById('drag-instruction-overlay'),

    alertModal: document.getElementById('alert-modal'),
    alertModalText: document.getElementById('alert-modal-text'),
    alertModalCloseBtn: document.getElementById('alert-modal-close-btn'),
};

// Debounce timer for input-driven saves
let saveDebounceTimer = null;

// Draft memory states
let draftMetadataMap = null;
let draftBlobs = new Map(); // ID -> Blob (including null)

// Storage Tiering Helpers
async function getCustomAnimationMetadataMap() {
    if (draftMetadataMap) {
        return draftMetadataMap;
    }
    const map = await sharedGetCustomAnimationMetadataMap();
    // Deep clone to draft map
    draftMetadataMap = JSON.parse(JSON.stringify(map));
    return draftMetadataMap;
}

async function setCustomAnimationMetadataMap(map) {
    draftMetadataMap = map;
}

/**
 * Saves an animation Blob and its rendering configuration to draft storage.
 * @param {string} id - The animation identifier.
 * @param {Blob|null} blob - The animation Blob to save.
 * @param {Object} renderSpec - The animation rendering configuration.
 * @param {Object} config - The animation settings.
 */
async function saveAnimationBlob(id, blob, renderSpec, config) {
    if (draftMetadataMap && draftMetadataMap[id]) {
        draftMetadataMap[id].payload = { renderSpec };
        draftMetadataMap[id].config = config;
    }
    draftBlobs.set(id, blob);
    await saveAnimationDraftBlob(id, blob, renderSpec, config);
}

/**
 * Retrieves an animation Blob from draft storage, falling back to production storage when needed.
 * @param {string} id - The animation identifier.
 * @return {Promise<Blob|null>} The animation Blob, or `null` if it cannot be found.
 */
async function getAnimationBlob(id) {
    if (draftBlobs.has(id)) {
        return draftBlobs.get(id);
    }
    let blob = await getAnimationDraftBlob(id);
    if (!blob) {
        blob = await idbGetAnimationBlob(id);
    }
    draftBlobs.set(id, blob);
    return blob;
}

/**
 * Deletes a custom animation blob from draft storage.
 * @param {string} id - The animation identifier.
 */
async function deleteAnimationBlob(id) {
    draftBlobs.set(id, null);
    await deleteAnimationDraftBlob(id);
}

/**
 * Initializes the draft animation database and populates it with existing custom animations from production storage.
 */
async function initDraftState() {
    await initAnimationDraftDB();
    await clearAnimationDraftDB();

    // Populate Draft DB with existing custom animations from Production DB
    const map = await getCustomAnimationMetadataMap();
    const keys = Object.keys(map);
    for (const id of keys) {
        const prodBlob = await idbGetAnimationBlob(id);
        const meta = map[id];
        if (meta) {
            await saveAnimationDraftBlob(id, prodBlob, meta.payload?.renderSpec, meta.config);
        }
    }
}

// Direct Storage write for metadata map
async function saveProductionMetadataMap(map) {
    await sharedSetCustomAnimationMetadataMap(map);
}

function setupTypography(appState) {
    if (appState) {
        if (appState.font) {
            document.body.style.setProperty('--font-family', appState.font);
        }
        if (appState.fontWeight) {
            const weights = {
                normal: '400',
                medium: '500',
                bold: '700',
                heavy: '900',
            };
            const val = weights[appState.fontWeight];
            if (val) {
                document.body.style.setProperty('--font-weight-custom', val);
            }
        }
    }
}

/**
 * Initialize storage, localization, theme, event listeners, animation rendering, and the animation list.
 */
async function init() {
    const appState = await initDB();
    await initDraftState();
    setupTypography(appState);
    setupLanguage();
    setupTheme();
    setupEventListeners();
    setupAnimationEngine();
    await loadAnimationsList();
    setupAnimationLoop();
    updateBoundaryLines();
}

function setupTheme() {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    if (themeParam && (themeParam === 'light' || themeParam === 'dark')) {
        localStorage.setItem('maker-theme', themeParam);
    }

    const savedTheme = localStorage.getItem('maker-theme') || localStorage.getItem('studio-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    state.currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    elements.themeToggle.checked = state.currentTheme === 'dark';
    applyTheme();
}

function applyTheme() {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${state.currentTheme}`);
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

    state.currentLang = matched;
    elements.langSelect.value = matched;
    updateTranslations();
}

function updateTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        el.textContent = state.getMsg(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
        const key = el.getAttribute('data-i18n-title');
        el.title = state.getMsg(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = state.getMsg(key);
    });

    if (elements.btnPlayPause) {
        const titleKey = state.isPlaying ? 'tooltip-pause' : 'tooltip-play';
        elements.btnPlayPause.setAttribute('data-i18n-title', titleKey);
        elements.btnPlayPause.title = state.getMsg(titleKey);
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showAlert(msg) {
    elements.alertModalText.textContent = msg;
    elements.alertModal.classList.remove('hidden');
}

function getSelectedBoundaryHeight() {
    const selected = document.querySelector('input[name="boundary-height"]:checked');
    return selected ? parseInt(selected.value) : 100;
}

function updateBoundaryLines() {
    const H = getSelectedBoundaryHeight();
    const topY = (150 - H) / 2;
    const bottomY = topY + H;

    elements.boundaryTop.style.top = `${topY}px`;
    elements.boundaryBottom.style.top = `${bottomY}px`;

    elements.rawBoundaryTop.style.top = `${topY}px`;
    elements.rawBoundaryBottom.style.top = `${bottomY}px`;

    if (state.animationEngine) {
        state.animationEngine.simulatedHeight = H;
        state.animationEngine.resize();
    }

    triggerRedraw();
}

function getScaleFactor() {
    if (state.scaleWithHeight) {
        const H = getSelectedBoundaryHeight();
        return state.currentScale * (H / 100);
    }
    return state.currentScale;
}

function resolveDeduplicatedName(name, existingNames) {
    let finalName = name || state.getMsg('placeholder-meta-name') || 'Unassigned';
    const namesSet = new Set(existingNames);
    if (namesSet.has(finalName)) {
        let suffix = 1;
        let candidateName = `${finalName} (${suffix})`;
        while (namesSet.has(candidateName)) {
            suffix++;
            candidateName = `${finalName} (${suffix})`;
        }
        finalName = candidateName;
    }
    return finalName;
}

/**
 * Loads custom animations, rebuilds the animation list, and synchronizes the selected animation with the workspace.
 */
async function loadAnimationsList() {
    state.customAnimations = await getCustomAnimationMetadataMap();

    // Sort custom animations by sequence order
    let sortedKeys = Object.keys(state.customAnimations).sort((a, b) => {
        const orderA = state.customAnimations[a].order ?? 0;
        const orderB = state.customAnimations[b].order ?? 0;
        return orderA - orderB;
    });

    elements.animationList.replaceChildren();

    if (sortedKeys.length === 0) {
        state.selectedId = null;
        state.loadedId = null;
        elements.noSelectionCard.classList.remove('hidden');
        elements.editorWorkspace.classList.add('hidden');
        if (state.animationEngine) {
            state.animationEngine.stop();
        }
        state.gifFrames.forEach((f) => {
            if (f.bitmap && typeof f.bitmap.close === 'function') {
                f.bitmap.close();
            }
        });
        state.gifFrames = [];
        state.totalDuration = 0;
        state.gifBlob = null;
        return;
    }

    sortedKeys.forEach((id, idx) => {
        const meta = state.customAnimations[id];
        const item = document.createElement('div');
        item.className = 'category-item' + (id === state.selectedId ? ' active' : '');
        item.draggable = true;
        item.dataset.id = id;
        item.dataset.index = idx;

        const dragHandle = document.createElement('span');
        dragHandle.className = 'material-symbols-outlined drag-handle';
        dragHandle.textContent = 'drag_indicator';
        item.appendChild(dragHandle);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'cat-name';
        nameSpan.textContent = meta.name || state.getMsg('placeholder-meta-name');
        nameSpan.title = meta.name;
        item.appendChild(nameSpan);

        // Delete/Actions Button
        const moreBtn = document.createElement('button');
        moreBtn.className = 'icon-btn more-item-btn';
        const moreIcon = document.createElement('span');
        moreIcon.className = 'material-symbols-outlined';
        moreIcon.textContent = 'more_vert';
        moreBtn.appendChild(moreIcon);
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            showItemMenu(e, id);
        };
        item.appendChild(moreBtn);

        item.onclick = () => selectAnimation(id);

        // Drag events
        item.ondragstart = () => {
            item.classList.add('dragging');
            state.draggedIndex = idx;
        };
        item.ondragend = () => {
            item.classList.remove('dragging');
            state.draggedIndex = null;
        };

        elements.animationList.appendChild(item);
    });

    if (!state.selectedId && sortedKeys.length > 0) {
        await selectAnimation(sortedKeys[0]);
    } else if (state.selectedId) {
        // Just refresh workspace UI with current selected
        await selectAnimation(state.selectedId);
    }
}

// --- Modal Dialog Helpers for Creation, Names Renaming, and Import Collisions ---
function hideM3Dialog() {
    const modal = document.getElementById('m3-dialog-modal');
    modal.classList.add('hidden');
    // Clear dynamic structures
    document.getElementById('m3-dialog-options-container').replaceChildren();
    document.getElementById('m3-dialog-error').style.display = 'none';
    document.getElementById('m3-dialog-error').textContent = '';
    // Restore normal visibility for footer and input
    document.getElementById('m3-dialog-footer').style.display = 'flex';
    document.getElementById('m3-dialog-input').style.display = 'block';
}

function showM3CreateDialog() {
    const modal = document.getElementById('m3-dialog-modal');
    const title = document.getElementById('m3-dialog-title').querySelector('span:last-child');
    const prompt = document.getElementById('m3-dialog-prompt');
    const input = document.getElementById('m3-dialog-input');
    const error = document.getElementById('m3-dialog-error');
    const okBtn = document.getElementById('m3-dialog-ok-btn');
    const cancelBtn = document.getElementById('m3-dialog-cancel-btn');

    title.textContent = state.getMsg('btn-add-custom-anim');
    prompt.textContent = state.getMsg('placeholder-meta-name') + ':';
    input.value = state.getMsg('placeholder-meta-name');
    input.style.display = 'block';
    error.style.display = 'none';
    error.textContent = '';

    modal.classList.remove('hidden');
    input.focus();
    input.select();

    okBtn.onclick = async () => {
        const nameVal = input.value.trim();
        if (!nameVal) {
            error.style.display = 'block';
            error.textContent = state.getMsg('maker-error-name-empty');
            return;
        }

        const map = await getCustomAnimationMetadataMap();
        const existingNames = Object.values(map).map((m) => m.name);
        if (existingNames.includes(nameVal)) {
            error.style.display = 'block';
            error.textContent = state.getMsg('maker-error-name-duplicate');
            return;
        }

        const newId = crypto.randomUUID();
        map[newId] = {
            name: nameVal,
            description: '',
            author: state.getMsg('anim-unknown-author'),
            order: Object.keys(map).length,
            revision: 1,
            config: {
                exclusionStrategy: 'freedom',
            },
            payload: {
                renderSpec: {
                    focusX: 0,
                    focusY: 0,
                    targetHeight: 100,
                    maxWidth: 2030,
                    scaleWithHeight: true,
                    overflowBehavior: 'repeat',
                    previewColor: 'primary',
                },
            },
        };

        await setCustomAnimationMetadataMap(map);
        await saveAnimationBlob(newId, null, map[newId].payload.renderSpec, map[newId].config);

        state.selectedId = newId;
        await loadAnimationsList();
        hideM3Dialog();
    };

    cancelBtn.onclick = () => {
        hideM3Dialog();
    };
}

async function showM3NameEditDialog(id) {
    const modal = document.getElementById('m3-dialog-modal');
    const title = document.getElementById('m3-dialog-title').querySelector('span:last-child');
    const prompt = document.getElementById('m3-dialog-prompt');
    const input = document.getElementById('m3-dialog-input');
    const error = document.getElementById('m3-dialog-error');
    const okBtn = document.getElementById('m3-dialog-ok-btn');
    const cancelBtn = document.getElementById('m3-dialog-cancel-btn');

    title.textContent = state.getMsg('history-edit-title');
    prompt.textContent = state.getMsg('placeholder-meta-name') + ':';

    const map = await getCustomAnimationMetadataMap();
    const currentName = map[id]?.name || '';
    input.value = currentName;
    input.style.display = 'block';
    error.style.display = 'none';
    error.textContent = '';

    modal.classList.remove('hidden');
    input.focus();
    input.select();

    okBtn.onclick = async () => {
        const nameVal = input.value.trim();
        if (!nameVal) {
            error.style.display = 'block';
            error.textContent = state.getMsg('maker-error-name-empty');
            return;
        }

        const map = await getCustomAnimationMetadataMap();
        const existingNames = Object.keys(map)
            .filter((k) => k !== id)
            .map((k) => map[k].name);

        if (existingNames.includes(nameVal)) {
            error.style.display = 'block';
            error.textContent = state.getMsg('maker-error-name-duplicate');
            return;
        }

        map[id].name = nameVal;
        await setCustomAnimationMetadataMap(map);
        elements.metaName.value = nameVal;

        if (id === state.selectedId) {
            state.gifFileName = nameVal ? `${nameVal}.gif` : 'animation.gif';
            if (elements.gifFileNameSpan) {
                elements.gifFileNameSpan.textContent = state.gifFileName;
            }
        }

        // Refresh list labels
        const listItems = elements.animationList.querySelectorAll('.category-item');
        listItems.forEach((item) => {
            if (item.dataset.id === id) {
                const nameSpan = item.querySelector('.cat-name');
                if (nameSpan) nameSpan.textContent = nameVal;
            }
        });

        await saveCurrentChanges();
        hideM3Dialog();
    };

    cancelBtn.onclick = () => {
        hideM3Dialog();
    };
}

async function handleCustomAnimationImport(data, blob) {
    const map = await getCustomAnimationMetadataMap();
    const existingEntry = Object.entries(map).find(([_, m]) => m.name === data.metadata?.name);

    if (existingEntry) {
        const [existingId, existingMeta] = existingEntry;
        // Collision detected: prompt user
        showM3ImportCollisionDialog(data, blob, existingId, existingMeta);
    } else {
        // No collision: normal import
        await proceedWithImport(data, blob, data.metadata?.name);
    }
}

function showM3ImportCollisionDialog(data, blob, existingId, existingMeta) {
    const modal = document.getElementById('m3-dialog-modal');
    const title = document.getElementById('m3-dialog-title').querySelector('span:last-child');
    const prompt = document.getElementById('m3-dialog-prompt');
    const input = document.getElementById('m3-dialog-input');
    const error = document.getElementById('m3-dialog-error');
    const footer = document.getElementById('m3-dialog-footer');
    const container = document.getElementById('m3-dialog-options-container');

    title.textContent = state.getMsg('custom-anim-import');
    prompt.textContent =
        state.currentLang === 'ja'
            ? `同じ名前「${existingMeta.name}」のカスタムアニメーションが存在します。選択してください：`
            : `A custom animation named "${existingMeta.name}" already exists. Please choose:`;

    input.style.display = 'none';
    error.style.display = 'none';
    error.textContent = '';
    footer.style.display = 'none'; // Custom choices buttons used instead

    container.replaceChildren();

    const overwriteBtn = document.createElement('button');
    overwriteBtn.className = 'primary-btn';
    overwriteBtn.style.width = '100%';
    overwriteBtn.textContent = state.currentLang === 'ja' ? '上書き' : 'Overwrite';
    overwriteBtn.onclick = async () => {
        // Overwrite mode: Reuse existing ID but set new properties & binary Blob
        const map = await getCustomAnimationMetadataMap();
        map[existingId] = {
            ...map[existingId],
            description: data.metadata?.description || '',
            author: data.metadata?.author || 'User',
            revision: (map[existingId].revision || 0) + 1,
            config: data.config || { exclusionStrategy: 'freedom' },
            payload: {
                renderSpec: data.payload?.renderSpec || {
                    focusX: 0,
                    focusY: 0,
                    targetHeight: 100,
                    maxWidth: 2030,
                    scaleWithHeight: true,
                    overflowBehavior: 'repeat',
                    previewColor: 'primary',
                },
            },
        };

        await saveAnimationBlob(existingId, blob, map[existingId].payload.renderSpec, map[existingId].config);
        await setCustomAnimationMetadataMap(map);

        state.selectedId = existingId;
        await loadAnimationsList();
        hideM3Dialog();
        showToast(state.getMsg('toast-custom-anim-imported') || 'Imported successfully!');
    };

    const renameBtn = document.createElement('button');
    renameBtn.className = 'secondary-btn';
    renameBtn.style.width = '100%';
    renameBtn.textContent = state.currentLang === 'ja' ? '名前を変更してインポート' : 'Rename & Import';
    renameBtn.onclick = () => {
        showM3ImportRenameSubDialog(data, blob);
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'secondary-btn';
    cancelBtn.style.width = '100%';
    cancelBtn.textContent = state.getMsg('confirm-cancel');
    cancelBtn.onclick = () => {
        hideM3Dialog();
    };

    container.appendChild(overwriteBtn);
    container.appendChild(renameBtn);
    container.appendChild(cancelBtn);

    modal.classList.remove('hidden');
}

function showM3ImportRenameSubDialog(data, blob) {
    const title = document.getElementById('m3-dialog-title').querySelector('span:last-child');
    const prompt = document.getElementById('m3-dialog-prompt');
    const input = document.getElementById('m3-dialog-input');
    const error = document.getElementById('m3-dialog-error');
    const container = document.getElementById('m3-dialog-options-container');

    container.replaceChildren(); // Remove the multi choices buttons

    title.textContent = state.getMsg('custom-anim-import');
    prompt.textContent = state.currentLang === 'ja' ? '新しい名前を入力してください：' : 'Please enter a new name:';

    const currentName = data.metadata?.name || '';
    input.value = currentName;
    input.style.display = 'block';
    input.focus();
    input.select();

    const okBtn = document.getElementById('m3-dialog-ok-btn');
    const cancelBtn = document.getElementById('m3-dialog-cancel-btn');

    okBtn.onclick = async () => {
        const nameVal = input.value.trim();
        if (!nameVal) {
            error.style.display = 'block';
            error.textContent = state.getMsg('maker-error-name-empty');
            return;
        }

        const map = await getCustomAnimationMetadataMap();
        const existingNames = Object.values(map).map((m) => m.name);

        if (existingNames.includes(nameVal)) {
            error.style.display = 'block';
            error.style.color = 'var(--md-sys-color-error)';
            error.textContent = state.getMsg('maker-error-name-duplicate');
            return;
        }

        await proceedWithImport(data, blob, nameVal);
        hideM3Dialog();
    };

    cancelBtn.onclick = () => {
        hideM3Dialog();
    };
}

async function proceedWithImport(data, blob, finalName) {
    const map = await getCustomAnimationMetadataMap();
    const newId = crypto.randomUUID();

    map[newId] = {
        name: finalName,
        description: data.metadata?.description || '',
        author: data.metadata?.author || 'User',
        order: Object.keys(map).length,
        revision: 1,
        config: data.config || { exclusionStrategy: 'freedom' },
        payload: {
            renderSpec: data.payload?.renderSpec || {
                focusX: 0,
                focusY: 0,
                targetHeight: 100,
                maxWidth: 2030,
                scaleWithHeight: true,
                overflowBehavior: 'repeat',
                previewColor: 'primary',
            },
        },
    };

    await saveAnimationBlob(newId, blob, map[newId].payload.renderSpec, map[newId].config);
    await setCustomAnimationMetadataMap(map);

    state.selectedId = newId;
    await loadAnimationsList();
    showToast(state.getMsg('toast-custom-anim-imported') || 'Imported successfully!');
}

/**
 * Exports the custom animation with the specified ID as a packaged .qlanim file.
 *
 * @param {string} id - The ID of the custom animation to export.
 */
async function exportAnimation(id) {
    const map = await getCustomAnimationMetadataMap();
    const meta = map[id];
    if (!meta) return;

    const blob = await getAnimationBlob(id);
    if (!blob) {
        showAlert('Please import a GIF file first before exporting!');
        return;
    }

    try {
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.onabort = () => reject(new Error('FileReader aborted'));
            reader.readAsDataURL(blob);
        });

        const qlanim = {
            format: 'quicklog-animation-package',
            formatVersion: '1.0',
            id: id,
            metadata: {
                name: meta.name,
                description: meta.description || '',
                author: meta.author || 'User',
            },
            config: meta.config || { exclusionStrategy: 'freedom' },
            payload: {
                imageData: base64,
                renderSpec: meta.payload.renderSpec,
            },
        };

        const text = JSON.stringify(qlanim, null, 2);
        const downloadBlob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(downloadBlob);
        const a = document.createElement('a');
        a.href = url;
        const defaultName = (meta.name || 'custom_animation').toLowerCase().replace(/\s+/g, '_');
        a.download = `${defaultName}.qlanim`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        showAlert('Failed to export the animation file: ' + err.message);
    }
}

function showItemMenu(e, id) {
    const existing = document.querySelector('.category-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'category-menu';

    const dupBtn = document.createElement('button');
    dupBtn.className = 'menu-action-btn';
    const dupIcon = document.createElement('span');
    dupIcon.className = 'material-symbols-outlined';
    dupIcon.textContent = 'content_copy';
    dupBtn.appendChild(dupIcon);
    dupBtn.appendChild(document.createTextNode(' ' + state.getMsg('duplicate')));
    dupBtn.onclick = async (event) => {
        event.stopPropagation();
        menu.remove();
        await duplicateAnimation(id);
    };

    const exportBtn = document.createElement('button');
    exportBtn.className = 'menu-action-btn';
    const exportIcon = document.createElement('span');
    exportIcon.className = 'material-symbols-outlined';
    exportIcon.textContent = 'download';
    exportBtn.appendChild(exportIcon);
    exportBtn.appendChild(document.createTextNode(' ' + state.getMsg('custom-anim-export')));
    exportBtn.onclick = async (event) => {
        event.stopPropagation();
        menu.remove();
        await exportAnimation(id);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'menu-action-btn delete';
    const delIcon = document.createElement('span');
    delIcon.className = 'material-symbols-outlined';
    delIcon.textContent = 'delete';
    delBtn.appendChild(delIcon);
    delBtn.appendChild(document.createTextNode(' ' + state.getMsg('delete')));
    delBtn.onclick = async (event) => {
        event.stopPropagation();
        menu.remove();
        if (confirm(state.getMsg('confirm-delete-custom-anim').replace('{name}', state.customAnimations[id].name))) {
            await deleteAnimation(id);
        }
    };

    menu.appendChild(dupBtn);
    menu.appendChild(exportBtn);
    menu.appendChild(delBtn);

    document.body.appendChild(menu);
    const rect = e.currentTarget.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY}px`;
    menu.style.left = `${rect.right - menu.offsetWidth + window.scrollX}px`;
}

// Duplicate
async function duplicateAnimation(id) {
    const map = await getCustomAnimationMetadataMap();
    if (!map[id]) return;

    const source = map[id];
    const newId = crypto.randomUUID();

    const existingNames = Object.values(map).map((m) => m.name);
    const finalName = resolveDeduplicatedName(source.name, existingNames);

    map[newId] = {
        ...JSON.parse(JSON.stringify(source)),
        name: finalName,
        order: Object.keys(map).length,
        revision: 1,
    };

    await setCustomAnimationMetadataMap(map);

    const sourceBlob = await getAnimationBlob(id);
    await saveAnimationBlob(newId, sourceBlob, map[newId].payload.renderSpec, map[newId].config);

    state.selectedId = newId;
    await loadAnimationsList();
}

/**
 * Delete a custom animation and update the remaining animation order.
 * @param {string} id - The identifier of the animation to delete.
 */
async function deleteAnimation(id) {
    const map = await getCustomAnimationMetadataMap();
    delete map[id];

    // Reorder indices
    Object.keys(map)
        .sort((a, b) => (map[a].order ?? 0) - (map[b].order ?? 0))
        .forEach((k, idx) => {
            map[k].order = idx;
        });

    await setCustomAnimationMetadataMap(map);
    await deleteAnimationBlob(id);

    if (state.selectedId === id) {
        state.selectedId = null;
    }
    if (state.loadedId === id) {
        state.loadedId = null;
    }

    await loadAnimationsList();
}

// List Drag & Drop Sort
elements.animationList.ondragover = (e) => {
    e.preventDefault();
    const draggingItem = elements.animationList.querySelector('.category-item.dragging');
    if (!draggingItem) return;

    const siblings = [...elements.animationList.querySelectorAll('.category-item:not(.dragging)')];
    let nextSibling = siblings.find((sibling) => {
        return e.clientY <= sibling.getBoundingClientRect().top + sibling.getBoundingClientRect().height / 2;
    });
    elements.animationList.insertBefore(draggingItem, nextSibling);
};

elements.animationList.ondrop = async (e) => {
    e.preventDefault();
    const items = [...elements.animationList.querySelectorAll('.category-item')];
    const map = await getCustomAnimationMetadataMap();

    items.forEach((item, idx) => {
        const id = item.dataset.id;
        if (map[id]) {
            map[id].order = idx;
        }
    });

    await setCustomAnimationMetadataMap(map);
    await loadAnimationsList();
};

/**
 * Selects an animation and loads its metadata and GIF into the editor workspace.
 * Saves pending changes for the previously loaded animation before switching.
 * @param {string} id - The identifier of the animation to select.
 */
async function selectAnimation(id) {
    if (elements.dragInstruction) {
        elements.dragInstruction.classList.remove('fade-out');
    }

    if (state.loadedId === id && !elements.editorWorkspace.classList.contains('hidden')) {
        // If clicking the currently active/selected animation and the workspace is already visible, do nothing and keep unsaved changes!
        return;
    }

    state.selectionToken = (state.selectionToken || 0) + 1;
    const currentToken = state.selectionToken;

    // If there is a currently loaded animation, save any unsaved changes before switching!
    if (state.loadedId && state.loadedId !== id) {
        if (saveDebounceTimer) {
            clearTimeout(saveDebounceTimer);
            saveDebounceTimer = null;
        }
        await saveCurrentChanges(false, state.loadedId);
        if (state.selectionToken !== currentToken) return;
    }

    state.selectedId = id;
    state.loadedId = id;
    const meta = state.customAnimations[id];
    if (!meta) return;

    elements.noSelectionCard.classList.add('hidden');
    elements.editorWorkspace.classList.remove('hidden');

    // Remove active style on all and add to current
    elements.animationList.querySelectorAll('.category-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.id === id);
    });

    // Populate Fields
    elements.metaName.value = meta.name || '';
    elements.metaAuthor.value = meta.author || '';
    elements.metaDesc.value = meta.description || '';

    const spec = meta.payload?.renderSpec || {};
    state.focusX = spec.focusX !== undefined ? spec.focusX : 0;
    state.focusY = spec.focusY !== undefined ? spec.focusY : 0;
    state.targetHeight = spec.targetHeight || 100;
    state.currentScale = 100 / state.targetHeight;
    state.maxWidth = spec.maxWidth || 2030;
    state.scaleWithHeight = spec.scaleWithHeight !== undefined ? spec.scaleWithHeight : true;
    state.invert = spec.invert !== undefined ? spec.invert : false;
    state.overflowBehavior = spec.overflowBehavior || 'repeat';
    state.exclusionStrategy = meta.config?.exclusionStrategy || 'freedom';
    state.previewColor = spec.previewColor || 'primary';
    state.brightness = spec.brightness !== undefined ? spec.brightness : 1.0;

    // Populate Inputs
    elements.configExclusionStrategy.value = state.exclusionStrategy;
    elements.configOverflow.checked = state.overflowBehavior === 'repeat';
    elements.configMaxWidth.value = state.maxWidth;
    elements.configScaleHeight.checked = state.scaleWithHeight;
    elements.configInvert.checked = state.invert;
    elements.configBrightness.value = state.brightness;
    elements.configBrightnessValue.textContent = state.brightness.toFixed(1);

    renderColorPalette();
    updatePreviewModeStyles();

    // Reset frame lists & fetch from IndexedDB
    state.gifFrames.forEach((f) => {
        if (f.bitmap && typeof f.bitmap.close === 'function') {
            f.bitmap.close();
        }
    });
    state.gifFrames = [];
    state.totalDuration = 0;
    state.gifFileName = null;
    state.gifWidth = 0;
    state.gifHeight = 0;

    const blob = await getAnimationBlob(id);
    if (state.selectionToken !== currentToken) return;

    if (blob) {
        state.gifBlob = blob;
        state.gifFileName = meta.name ? `${meta.name}.gif` : 'animation.gif';
        elements.dropZone.style.opacity = '0';
        elements.dropZone.style.pointerEvents = 'none';
        elements.rawPreviewContainer.setAttribute('tabindex', '0');
        await parseGif(blob);
        if (state.selectionToken !== currentToken) return;
    } else {
        state.gifBlob = null;
        elements.dropZone.style.opacity = '1';
        elements.dropZone.style.pointerEvents = 'auto';
        elements.rawPreviewContainer.removeAttribute('tabindex');
        elements.gifInfoBox.classList.add('hidden');
    }

    updateMonitor();
    triggerRedraw();

    // Initialize AnimationEngine for the newly selected item if playing
    if (state.isPlaying && state.gifFrames.length > 0 && state.animationEngine) {
        const colorCode = COLOR_CODES[state.previewColor] || '#1976d2';
        const startTime = Date.now() - state.virtualElapsedMs;
        state.animationEngine.start(state.selectedId, startTime, colorCode);
    }
}

// Colors presets palette rendering
function renderColorPalette() {
    elements.previewColorPalette.replaceChildren();
    COLORS.forEach((color) => {
        const opt = document.createElement('div');
        opt.className = 'color-option' + (color === state.previewColor ? ' selected' : '');
        opt.style.backgroundColor = COLOR_CODES[color];
        opt.dataset.color = color;

        const check = document.createElement('span');
        check.className = 'material-symbols-outlined';
        check.textContent = 'check';
        opt.appendChild(check);

        opt.onclick = async () => {
            state.previewColor = color;
            renderColorPalette();
            await saveCurrentChanges();
            triggerRedraw();
        };

        elements.previewColorPalette.appendChild(opt);
    });
}

/**
 * Saves the active animation's metadata, render settings, and GIF blob to draft storage.
 *
 * When `isApply` is `true`, also applies all draft animations and deletions to production storage and broadcasts the update.
 *
 * @param {boolean} [isApply=false] - Whether to apply the draft changes to production storage.
 * @param {string|null} [targetId=null] - The ID of the custom animation to save. If null, defaults to state.selectedId.
 * @returns {Promise<boolean>} `true` if changes were saved, `false` if no animation is selected or the selected animation does not exist.
 */
async function saveCurrentChanges(isApply = false, targetId = null) {
    const activeId = targetId || state.selectedId;
    if (activeId) {
        const map = await getCustomAnimationMetadataMap();
        if (map[activeId]) {
            // Map Metadata updates
            map[activeId].name = elements.metaName.value.trim() || state.getMsg('placeholder-meta-name');
            map[activeId].author = elements.metaAuthor.value.trim() || state.getMsg('anim-unknown-author');
            map[activeId].description = elements.metaDesc.value.trim();

            state.exclusionStrategy = elements.configExclusionStrategy.value;
            map[activeId].config = {
                exclusionStrategy: state.exclusionStrategy,
            };

            state.maxWidth = parseInt(elements.configMaxWidth.value) || 2030;
            state.scaleWithHeight = elements.configScaleHeight.checked;
            state.invert = elements.configInvert.checked;
            state.overflowBehavior = elements.configOverflow.checked ? 'repeat' : 'categoryColor';
            state.brightness = parseFloat(elements.configBrightness.value) || 1.0;

            map[activeId].payload = {
                renderSpec: {
                    focusX: Math.round(state.focusX),
                    focusY: Math.round(state.focusY),
                    targetHeight: Math.round(state.targetHeight),
                    maxWidth: state.maxWidth,
                    scaleWithHeight: state.scaleWithHeight,
                    invert: state.invert,
                    overflowBehavior: state.overflowBehavior,
                    previewColor: state.previewColor,
                    brightness: state.brightness,
                },
            };

            // Increment revision to track changes
            map[activeId].revision = (map[activeId].revision || 0) + 1;

            await setCustomAnimationMetadataMap(map);

            // Save Blob and configs to IndexedDB
            await saveAnimationBlob(activeId, state.gifBlob, map[activeId].payload.renderSpec, map[activeId].config);
            triggerRedraw();

            // Refresh only the labels in list view without resetting workspace selection
            const listItems = elements.animationList.querySelectorAll('.category-item');
            listItems.forEach((item) => {
                if (item.dataset.id === activeId) {
                    const nameSpan = item.querySelector('.cat-name');
                    if (nameSpan) nameSpan.textContent = map[activeId].name;
                }
            });

            // Re-initialize local AnimationEngine to reflect changes in real time in the downsampled preview section
            if (
                state.isPlaying &&
                state.animationEngine &&
                state.gifFrames.length > 0 &&
                activeId === state.selectedId
            ) {
                const colorCode = COLOR_CODES[state.previewColor] || '#1976d2';
                const startTime = Date.now() - state.virtualElapsedMs;
                state.animationEngine.start(state.selectedId, startTime, colorCode);
            }
        }
    }

    if (isApply === true) {
        // Direct production save
        const productionMap = {};
        // Retrieve original from shared storage
        const origMap = await sharedGetCustomAnimationMetadataMap();

        // Apply all modifications and deletions from draftMetadataMap
        // Any keys in draftMetadataMap but not in origMap are added or updated.
        // Any keys in origMap but not in draftMetadataMap are deleted.
        const keysInDraft = Object.keys(draftMetadataMap || {});
        const keysInOrig = Object.keys(origMap);

        // Delete removed animations from IndexedDB production blobs
        for (const id of keysInOrig) {
            if (!draftMetadataMap || !draftMetadataMap[id]) {
                await idbDeleteAnimationBlob(id);
                // Also Cascade update categories to 'none' in production DB
                const categories = await dbGetAll(STORE_CATEGORIES);
                for (const cat of categories) {
                    if (cat.animation === id) {
                        cat.animation = 'none';
                        await dbPut(STORE_CATEGORIES, cat);
                    }
                }
            }
        }

        // Save updated custom metadata and Blobs to production DB
        const draftRecords = await getAllAnimationDraftRecords();
        for (const record of draftRecords) {
            const id = record.id;
            if (draftMetadataMap && draftMetadataMap[id]) {
                productionMap[id] = draftMetadataMap[id];
                await idbSaveAnimationBlob(
                    id,
                    record.blob || null,
                    draftMetadataMap[id].payload?.renderSpec,
                    draftMetadataMap[id].config
                );
            }
        }

        // Defensive fallback for any keys in draft metadata map not written yet
        for (const id of keysInDraft) {
            if (!productionMap[id] && draftMetadataMap && draftMetadataMap[id]) {
                productionMap[id] = draftMetadataMap[id];
                await idbSaveAnimationBlob(
                    id,
                    null,
                    draftMetadataMap[id].payload?.renderSpec,
                    draftMetadataMap[id].config
                );
            }
        }

        await saveProductionMetadataMap(productionMap);

        broadcastSync('sync');
    }
    return true;
}

// Debounced version for text input handlers
function debouncedSaveCurrentChanges() {
    if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
    }
    saveDebounceTimer = setTimeout(() => {
        saveCurrentChanges();
    }, 400);
}

// Parse GIF frames using Native ImageDecoder
async function parseGif(blob) {
    try {
        if (typeof ImageDecoder === 'undefined') {
            showAlert(state.getMsg('alert-invalid-qlanim') + ' (ImageDecoder API is not supported.)');
            return;
        }

        const buffer = await blob.arrayBuffer();
        const decoder = new ImageDecoder({ data: buffer, type: 'image/gif' });

        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        if (!track) throw new Error('Selected track is null.');

        const frameCount = track.frameCount;
        if (frameCount <= 0) throw new Error('Invalid frame count.');

        let accumulatedDuration = 0;
        const parsedFrames = [];

        for (let i = 0; i < frameCount; i++) {
            const result = await decoder.decode({ frameIndex: i });
            const videoFrame = result.image;
            const bitmap = await createImageBitmap(videoFrame);

            if (i === 0) {
                state.gifWidth = videoFrame.codedWidth;
                state.gifHeight = videoFrame.codedHeight;
                // If focusX and focusY are zero, default to center of the GIF
                if (state.focusX === 0 && state.focusY === 0) {
                    state.focusX = state.gifWidth / 2;
                    state.focusY = state.gifHeight / 2;
                }
            }

            videoFrame.close();

            let duration = (videoFrame.duration || 100000) / 1000;
            if (duration <= 0) duration = 100;

            parsedFrames.push({ bitmap, duration });
            accumulatedDuration += duration;
        }

        state.gifFrames = parsedFrames;
        state.totalDuration = accumulatedDuration;

        // Update info UI
        elements.gifFileNameSpan.textContent = state.gifFileName || 'animation.gif';
        elements.gifDimensionsSpan.textContent = `${state.gifWidth} x ${state.gifHeight} px`;
        elements.gifFramesSpan.textContent = `${state.gifFrames.length} frames`;
        elements.gifInfoBox.classList.remove('hidden');

        updateMonitor();
        triggerRedraw();
    } catch (err) {
        console.error('GIF Parsing failed:', err);
        showAlert(state.getMsg('alert-invalid-qlanim') + ' (' + err.message + ')');
    }
}

function updateMonitor() {
    if (elements.monFocus) {
        elements.monFocus.textContent = `(${Math.round(state.focusX)}, ${Math.round(state.focusY)})`;
    }
    elements.monScale.textContent = getScaleFactor().toFixed(2);
    elements.monTargetHeight.textContent = Math.round(state.targetHeight);
}

function setupAnimationEngine() {
    const canvas = document.getElementById('animation-canvas');
    if (canvas) {
        state.animationEngine = new AnimationEngine(canvas);
        state.animationEngine.isDraft = true;
        updatePreviewExclusionAreas();
        window.addEventListener('resize', () => {
            if (state.animationEngine) {
                state.animationEngine.resize();
                updatePreviewExclusionAreas();
            }
        });
    }
}

function updatePreviewExclusionAreas() {
    if (!state.animationEngine) return;
    const canvas = document.getElementById('animation-canvas');
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const exclusionAreas = [];
    const paddingX = 4;
    const paddingY = 2;

    const previewName = document.getElementById('preview-name');
    const timerLabel = document.getElementById('preview-status-label');
    const timerElapsed = document.getElementById('preview-elapsed');

    [previewName, timerLabel, timerElapsed].forEach((el) => {
        if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                exclusionAreas.push({
                    x: rect.left - canvasRect.left - paddingX,
                    y: rect.top - canvasRect.top - paddingY,
                    width: rect.width + paddingX * 2,
                    height: rect.height + paddingY * 2,
                });
            }
        }
    });

    state.animationEngine.setExclusionAreas(exclusionAreas);
}

function updateDownsampledPreview() {
    if (!state.animationEngine || !state.selectedId) return;

    updatePreviewExclusionAreas();

    // Only update color without restarting the worker
    if (state.isPlaying && state.gifFrames.length > 0) {
        const colorCode = COLOR_CODES[state.previewColor] || '#1976d2';
        state.animationEngine.color = colorCode;
    } else {
        state.animationEngine.stop();
    }
}

// Canvas Drawing Loop
function setupAnimationLoop() {
    state.lastFrameTime = performance.now();

    function tick(now) {
        requestAnimationFrame(tick);

        if (state.selectedId && state.gifFrames.length > 0) {
            if (state.isPlaying) {
                const delta = now - state.lastFrameTime;
                state.virtualElapsedMs += delta;
            }
            state.lastFrameTime = now;
            drawRawFrames();
        } else {
            drawEmptyCanvas();
        }
    }
    requestAnimationFrame(tick);
}

function triggerRedraw() {
    if (state.selectedId && state.gifFrames.length > 0) {
        drawRawFrames();
    }
    updateDownsampledPreview();
}

function handleBrightnessChange(value) {
    state.brightness = parseFloat(value) || 1.0;
    elements.configBrightnessValue.textContent = state.brightness.toFixed(1);
    triggerRedraw();
    debouncedSaveCurrentChanges();
}

function drawEmptyCanvas() {
    if (state.animationEngine) {
        state.animationEngine.stop();
    }
    // Settings Canvas: Standard black background
    const rawCtx = elements.rawCanvas.getContext('2d');
    const rW = (elements.rawCanvas.width = elements.rawPreviewContainer.clientWidth);
    const rH = (elements.rawCanvas.height = elements.rawPreviewContainer.clientHeight);
    rawCtx.fillStyle = '#111111';
    rawCtx.fillRect(0, 0, rW, rH);
}

function updatePreviewModeStyles() {
    const container = elements.previewContainer;
    const overlay = document.getElementById('preview-overlay-base');
    if (!container) return;

    // Remove all classes first
    container.classList.remove('retro-lcd', 'retro-crt', 'retro-nixie', 'anim-active');
    if (overlay) {
        overlay.classList.remove('retro-lcd', 'retro-crt', 'retro-nixie', 'anim-active');
        overlay.removeAttribute('style');
    }

    const col = state.previewColor;
    if (col === 'retro-lcd') {
        container.classList.add('retro-lcd', 'anim-active');
        if (overlay) overlay.classList.add('retro-lcd', 'anim-active');
    } else if (col === 'retro-crt') {
        container.classList.add('retro-crt', 'anim-active');
        if (overlay) overlay.classList.add('retro-crt', 'anim-active');
    } else if (col === 'retro-nixie') {
        container.classList.add('retro-nixie', 'anim-active');
        if (overlay) overlay.classList.add('retro-nixie', 'anim-active');
    } else {
        container.classList.add('anim-active');
        if (overlay) {
            overlay.classList.add('anim-active');
            const hexColor = COLOR_CODES[col] || '#1976d2';
            overlay.style.backgroundColor = `color-mix(in srgb, ${hexColor}, transparent 95%)`;
            overlay.style.color = hexColor;
        }
    }
}

function drawRawFrames() {
    const W = elements.previewContainer.clientWidth;
    const H = elements.previewContainer.clientHeight; // 150

    elements.rawCanvas.width = W;
    elements.rawCanvas.height = H;

    updatePreviewModeStyles();

    const rawCtx = elements.rawCanvas.getContext('2d');

    const frame = getActiveFrame();
    if (!frame || !frame.bitmap) return;

    const S = getScaleFactor();
    const scaledW = frame.bitmap.width * S;
    const scaledH = frame.bitmap.height * S;

    const destX = W / 2 - state.focusX * S;
    const destY = H / 2 - state.focusY * S;

    const scaledMaxW = state.maxWidth * S;
    const clipLeft = W / 2 - scaledMaxW / 2;

    // ==========================================
    // 1. Draw Raw Canvas (ドット等の加工なし)
    // ==========================================
    rawCtx.fillStyle = '#111111';
    rawCtx.fillRect(0, 0, W, H);

    rawCtx.save();
    // Apply brightness adjustment to raw preview
    if (state.brightness !== undefined && state.brightness !== 1.0) {
        rawCtx.filter = `brightness(${state.brightness})`;
    }

    // Horizontally clip raw preview to maxWidth matching GenericGifAnimation!
    rawCtx.beginPath();
    rawCtx.rect(clipLeft, 0, scaledMaxW, H);
    rawCtx.clip();

    // Fill underlay background: always pure white (#ffffff) to ensure proper positive/negative inversion colors under difference blend
    rawCtx.fillStyle = '#ffffff';
    rawCtx.fillRect(clipLeft, 0, scaledMaxW, H);

    if (state.overflowBehavior === 'repeat' && scaledW > 0) {
        rawCtx.drawImage(frame.bitmap, destX, destY, scaledW, scaledH);
        let rightX = destX + scaledW;
        while (rightX < clipLeft + scaledMaxW) {
            rawCtx.drawImage(frame.bitmap, rightX, destY, scaledW, scaledH);
            rightX += scaledW;
        }
        let leftX = destX - scaledW;
        while (leftX + scaledW > clipLeft) {
            rawCtx.drawImage(frame.bitmap, leftX, destY, scaledW, scaledH);
            leftX -= scaledW;
        }
    } else {
        rawCtx.drawImage(frame.bitmap, destX, destY, scaledW, scaledH);
    }

    // Apply positive/negative inversion dynamically on raw canvas using GPU-accelerated difference blending
    if (state.invert) {
        rawCtx.globalCompositeOperation = 'difference';
        rawCtx.fillStyle = '#ffffff';
        rawCtx.fillRect(clipLeft, 0, scaledMaxW, H);
    }
    rawCtx.restore();

    // Render dimmed transparent overlays for outer inactive zones
    rawCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    const activeHeight = getSelectedBoundaryHeight();
    const topY = (H - activeHeight) / 2;
    rawCtx.fillRect(0, 0, W, topY);
    rawCtx.fillRect(0, topY + activeHeight, W, H - (topY + activeHeight));
    rawCtx.fillRect(0, topY, clipLeft, activeHeight);
    rawCtx.fillRect(clipLeft + scaledMaxW, topY, W - (clipLeft + scaledMaxW), activeHeight);

    // Draw active width borders
    rawCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    rawCtx.lineWidth = 1;
    rawCtx.strokeRect(clipLeft, topY, scaledMaxW, activeHeight);
}

function getActiveFrame() {
    if (state.gifFrames.length === 0) return null;
    const currentMs = state.virtualElapsedMs % state.totalDuration;
    let runningSum = 0;
    for (let i = 0; i < state.gifFrames.length; i++) {
        runningSum += state.gifFrames[i].duration;
        if (currentMs < runningSum) {
            return state.gifFrames[i];
        }
    }
    return state.gifFrames[0];
}

// Mouse dragging directly on Canvas to adjust focus
function handleMouseDown(e) {
    if (state.gifFrames.length === 0) return;
    state.isDragging = true;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.dragStartFocusX = state.focusX;
    state.dragStartFocusY = state.focusY;

    if (elements.dragInstruction) {
        elements.dragInstruction.classList.add('fade-out');
    }
}

function handleMouseMove(e) {
    if (!state.isDragging) return;
    const dx = e.clientX - state.dragStartX;
    const dy = e.clientY - state.dragStartY;
    const S = getScaleFactor();

    // Update focus coordinates
    state.focusX = state.dragStartFocusX - dx / S;
    state.focusY = state.dragStartFocusY - dy / S;

    // Bounds limit to image dimensions
    state.focusX = Math.max(0, Math.min(state.gifWidth, state.focusX));
    state.focusY = Math.max(0, Math.min(state.gifHeight, state.focusY));

    updateMonitor();
    triggerRedraw();
}

async function handleMouseUp() {
    if (state.isDragging) {
        state.isDragging = false;
        await saveCurrentChanges();
    }
}

function resetAnimationSettings() {
    state.focusX = 0;
    state.focusY = 0;
    state.targetHeight = 100;
    state.currentScale = 1.0;
    state.maxWidth = 2030;
    state.scaleWithHeight = true;
    state.invert = false;
    state.exclusionStrategy = 'freedom';
    state.overflowBehavior = 'repeat';
    state.previewColor = 'primary';
    state.brightness = 1.0;

    // Update Inputs in UI
    elements.configExclusionStrategy.value = state.exclusionStrategy;
    elements.configOverflow.checked = state.overflowBehavior === 'repeat';
    elements.configMaxWidth.value = state.maxWidth;
    elements.configScaleHeight.checked = state.scaleWithHeight;
    elements.configInvert.checked = state.invert;
    elements.configBrightness.value = state.brightness;
    elements.configBrightnessValue.textContent = state.brightness.toFixed(1);

    renderColorPalette();
    updatePreviewModeStyles();
    updateMonitor();
}

/**
 * Register event listeners for animation editing, preview interaction, playback, file handling, and UI controls.
 */
function setupEventListeners() {
    window.addEventListener('click', (e) => {
        const menu = document.querySelector('.category-menu');
        if (menu && !menu.contains(e.target)) {
            menu.remove();
        }
    });

    elements.langSelect.addEventListener('change', (e) => {
        state.currentLang = e.target.value;
        const url = new URL(window.location);
        url.searchParams.set('lang', state.currentLang);
        window.history.replaceState({}, '', url);
        updateTranslations();
        updateBoundaryLines();
    });

    elements.themeToggle.addEventListener('change', () => {
        state.currentTheme = elements.themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('maker-theme', state.currentTheme);
        applyTheme();
    });

    elements.addAnimBtn.addEventListener('click', () => {
        showM3CreateDialog();
    });

    // Click to select file on dropZone (when no GIF loaded) or simple click on rawPreviewContainer (when GIF loaded)
    let clickStartX = 0;
    let clickStartY = 0;

    elements.rawPreviewContainer.addEventListener('mousedown', (e) => {
        clickStartX = e.clientX;
        clickStartY = e.clientY;
    });

    // Prevent default dragstart on container or child elements to allow smooth mouse dragging without invoking native drag operations
    elements.rawPreviewContainer.addEventListener('dragstart', (e) => {
        e.preventDefault();
    });

    elements.rawPreviewContainer.addEventListener('click', (e) => {
        const dx = Math.abs(e.clientX - clickStartX);
        const dy = Math.abs(e.clientY - clickStartY);
        if (dx < 5 && dy < 5 && state.gifBlob) {
            elements.gifFileInput.click();
        }
    });

    // Keyboard accessibility for rawPreviewContainer when GIF is loaded
    elements.rawPreviewContainer.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && state.gifBlob) {
            e.preventDefault();
            elements.gifFileInput.click();
        }
    });

    elements.dropZone.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.gifFileInput.click();
    });

    elements.gifFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const meta = state.selectedId ? state.customAnimations[state.selectedId] : null;
            state.gifFileName = meta && meta.name ? `${meta.name}.gif` : file.name;
            state.gifBlob = file;
            elements.dropZone.style.opacity = '0';
            elements.dropZone.style.pointerEvents = 'none';
            elements.rawPreviewContainer.setAttribute('tabindex', '0');
            resetAnimationSettings();
            await parseGif(file);
            await saveCurrentChanges();
        }
    });

    // Ensure we only show the drop overlay when actual files are dragged from outside.
    elements.rawPreviewContainer.addEventListener('dragover', (e) => {
        const isFile = e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files');
        if (isFile) {
            e.preventDefault();
            elements.dropZone.style.opacity = '1';
            elements.dropZone.style.pointerEvents = 'auto';
            elements.dropZone.classList.add('dragover');
        }
    });

    elements.rawPreviewContainer.addEventListener('dragleave', (e) => {
        const rect = elements.rawPreviewContainer.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
            if (state.gifBlob) {
                elements.dropZone.style.opacity = '0';
                elements.dropZone.style.pointerEvents = 'none';
            }
            elements.dropZone.classList.remove('dragover');
        }
    });

    elements.rawPreviewContainer.addEventListener('drop', async (e) => {
        const isFile = e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files');
        if (isFile) {
            e.preventDefault();
            elements.dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files?.[0];
            if (file && file.type === 'image/gif') {
                const isValid = await validateGifBlob(file);
                if (!isValid) {
                    showAlert('Please drop a valid .gif image file!');
                    return;
                }
                elements.dropZone.style.opacity = '0';
                elements.dropZone.style.pointerEvents = 'none';
                const meta = state.selectedId ? state.customAnimations[state.selectedId] : null;
                state.gifFileName = meta && meta.name ? `${meta.name}.gif` : file.name;
                state.gifBlob = file;
                elements.rawPreviewContainer.setAttribute('tabindex', '0');
                resetAnimationSettings();
                await parseGif(file);
                await saveCurrentChanges();
            } else {
                // If there's an existing gif, make sure the overlay goes back to hidden
                if (state.gifBlob) {
                    elements.dropZone.style.opacity = '0';
                    elements.dropZone.style.pointerEvents = 'none';
                }
                showAlert('Please drop a valid .gif image file!');
            }
        }
    });

    // Translation drag handlers on rawPreviewContainer
    elements.rawPreviewContainer.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Touch translation drag support
    elements.rawPreviewContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            const mockEvent = {
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY,
            };
            handleMouseDown(mockEvent);
        }
    });
    window.addEventListener('touchmove', (e) => {
        if (state.isDragging && e.touches.length === 1) {
            const mockEvent = {
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY,
            };
            handleMouseMove(mockEvent);
        }
    });
    window.addEventListener('touchend', handleMouseUp);

    // Boundary Lines radio options
    document.querySelectorAll('input[name="boundary-height"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            updateBoundaryLines();
            updateMonitor();
        });
    });

    // Zoom scale adjustment buttons
    elements.btnScaleUp.addEventListener('click', async () => {
        if (state.scaleWithHeight) {
            state.targetHeight = Math.max(10, state.targetHeight - 10);
            state.currentScale = 100 / state.targetHeight;
        } else {
            state.currentScale += 0.1;
            state.targetHeight = 100 / state.currentScale;
        }
        updateMonitor();
        await saveCurrentChanges();
        triggerRedraw();
    });

    elements.btnScaleDown.addEventListener('click', async () => {
        if (state.scaleWithHeight) {
            state.targetHeight = Math.min(1000, state.targetHeight + 10);
            state.currentScale = 100 / state.targetHeight;
        } else {
            state.currentScale = Math.max(0.1, state.currentScale - 0.1);
            state.targetHeight = 100 / state.currentScale;
        }
        updateMonitor();
        await saveCurrentChanges();
        triggerRedraw();
    });

    elements.btnScaleReset.addEventListener('click', async () => {
        state.focusX = state.gifWidth / 2;
        state.focusY = state.gifHeight / 2;
        state.targetHeight = 100;
        state.currentScale = 1.0;
        updateMonitor();
        await saveCurrentChanges();
        triggerRedraw();
    });

    // Playback control
    elements.btnPlayPause.addEventListener('click', () => {
        state.isPlaying = !state.isPlaying;
        const icon = elements.btnPlayPause.querySelector('.material-symbols-outlined');
        if (state.isPlaying) {
            state.lastFrameTime = performance.now();
            icon.textContent = 'pause';
            elements.btnPlayPause.setAttribute('data-i18n-title', 'tooltip-pause');
            elements.btnPlayPause.title = state.getMsg('tooltip-pause');
            // Start AnimationEngine when playback begins
            if (state.selectedId && state.gifFrames.length > 0 && state.animationEngine) {
                const colorCode = COLOR_CODES[state.previewColor] || '#1976d2';
                const startTime = Date.now() - state.virtualElapsedMs;
                state.animationEngine.start(state.selectedId, startTime, colorCode);
            }
        } else {
            icon.textContent = 'play_arrow';
            elements.btnPlayPause.setAttribute('data-i18n-title', 'tooltip-play');
            elements.btnPlayPause.title = state.getMsg('tooltip-play');
            // Stop AnimationEngine when playback is paused
            if (state.animationEngine) {
                state.animationEngine.stop();
            }
        }
    });

    // Inputs listeners (debounced for text inputs, immediate for selects/checkboxes)
    elements.metaName.addEventListener('click', async () => {
        if (state.selectedId) {
            await showM3NameEditDialog(state.selectedId);
        }
    });
    elements.metaName.addEventListener('keydown', async (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && state.selectedId) {
            e.preventDefault();
            await showM3NameEditDialog(state.selectedId);
        }
    });
    elements.metaAuthor.addEventListener('input', debouncedSaveCurrentChanges);
    elements.metaDesc.addEventListener('input', debouncedSaveCurrentChanges);
    elements.configExclusionStrategy.addEventListener('change', () => saveCurrentChanges());
    elements.configOverflow.addEventListener('change', () => saveCurrentChanges());
    elements.configMaxWidth.addEventListener('input', debouncedSaveCurrentChanges);
    elements.configScaleHeight.addEventListener('change', () => saveCurrentChanges());
    elements.configInvert.addEventListener('change', () => saveCurrentChanges());
    elements.configBrightness.addEventListener('input', (e) => {
        handleBrightnessChange(e.target.value);
    });

    // Alert Modal close
    elements.alertModalCloseBtn.addEventListener('click', () => {
        elements.alertModal.classList.add('hidden');
    });

    /**
     * Validates that the provided Blob has a valid GIF signature and is decodable.
     *
     * @param {Blob} blob - The Blob to validate.
     * @returns {Promise<boolean>} True if valid, false otherwise.
     */
    async function validateGifBlob(blob) {
        try {
            const buffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);

            // 1. Signature check
            if (uint8Array.length < 6) return false;
            if (uint8Array[0] !== 0x47 || uint8Array[1] !== 0x49 || uint8Array[2] !== 0x46) {
                return false;
            }
            if (uint8Array[3] !== 0x38) return false;
            if (uint8Array[4] !== 0x37 && uint8Array[4] !== 0x39) return false;
            if (uint8Array[5] !== 0x61) return false;

            // 2. Decoder check using native ImageDecoder if available
            if (typeof ImageDecoder !== 'undefined') {
                const decoder = new ImageDecoder({ data: buffer, type: 'image/gif' });
                await decoder.tracks.ready;
                const track = decoder.tracks.selectedTrack;
                if (!track || track.frameCount <= 0) {
                    return false;
                }
                const result = await decoder.decode({ frameIndex: 0 });
                if (result && result.image) {
                    result.image.close();
                } else {
                    return false;
                }
            }
            return true;
        } catch {
            return false;
        }
    }

    // Data Transfer (Relocated side-by-side buttons)
    elements.btnImport.addEventListener('click', () => elements.qlanimFileInput.click());
    elements.qlanimFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (data.format !== 'quicklog-animation-package') {
                throw new Error('Invalid format');
            }

            // Decode base64 GIF back to file blob first to validate
            const base64 = data.payload?.imageData;
            if (!base64) {
                throw new Error('Missing imageData in payload');
            }
            const byteString = atob(base64.split(',')[1]);
            const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });

            const isValid = await validateGifBlob(blob);
            if (!isValid) {
                throw new Error('Malformed or invalid GIF data.');
            }

            await handleCustomAnimationImport(data, blob);
        } catch (err) {
            showAlert('Failed to parse the file: ' + err.message);
        } finally {
            e.target.value = '';
        }
    });

    const applyBtn = document.getElementById('apply-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const saved = await saveCurrentChanges(true);
            if (saved) {
                showToast(state.getMsg('toast-done-with-reopen-msg') || 'Applied successfully!');
            }
        });
    }
}

init();

// Expose internals for testing
window.getScaleFactor = getScaleFactor;
window.state = state;
