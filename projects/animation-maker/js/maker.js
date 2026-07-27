/**
 * QL-Animation Maker Integrated Logic
 */

import { messages } from '../shared/js/messages.js';
import {
    initDB, dbGetAll, dbPut,
    STORE_CATEGORIES, DB_NAME, SYNC_CHANNEL_NAME
} from '../shared/js/db.js';
import { AnimationEngine } from '../shared/js/animations.js';
import {
    saveAnimationBlob, getAnimationBlob, deleteAnimationBlob
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
    'retro-nixie': '#ff5500'
};

const COLORS = Object.keys(COLOR_CODES);

// State
const state = {
    currentLang: 'en',
    currentTheme: 'dark',
    customAnimations: {}, // ID -> metadata
    selectedId: null,

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
    maxWidth: 200,
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

    getMsg: (key) => (messages[state.currentLang] && messages[state.currentLang][key]) || messages.en[key] || key
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
    monFocusX: document.getElementById('mon-focus-x'),
    monFocusY: document.getElementById('mon-focus-y'),
    monScale: document.getElementById('mon-scale'),
    monTargetHeight: document.getElementById('mon-target-height'),

    // Data Transfer
    btnDownload: document.getElementById('btn-download-qlanim'),
    btnUpload: document.getElementById('btn-upload-qlanim'),
    qlanimFileInput: document.getElementById('qlanim-file-input'),

    alertModal: document.getElementById('alert-modal'),
    alertModalText: document.getElementById('alert-modal-text'),
    alertModalCloseBtn: document.getElementById('alert-modal-close-btn')
};


// Debounce timer for input-driven saves
let saveDebounceTimer = null;

// Storage Tiering Helpers
async function getCustomAnimationMetadataMap() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get('custom_animation_metadata_map');
        return result.custom_animation_metadata_map || {};
    } else {
        try {
            const stored = localStorage.getItem('custom_animation_metadata_map');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('Failed to parse custom_animation_metadata_map from localStorage:', e);
            return {};
        }
    }
}

async function setCustomAnimationMetadataMap(map) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ custom_animation_metadata_map: map });
    } else {
        try {
            localStorage.setItem('custom_animation_metadata_map', JSON.stringify(map));
        } catch (e) {
            console.error('Failed to save custom_animation_metadata_map to localStorage:', e);
        }
    }
}

// Initializer
async function init() {
    await initDB();
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
    elements.themeToggle.checked = (state.currentTheme === 'dark');
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
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = state.getMsg(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = state.getMsg(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
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

// Custom Animations List Operations
async function loadAnimationsList() {
    state.customAnimations = await getCustomAnimationMetadataMap();

    // Sort custom animations by sequence order
    let sortedKeys = Object.keys(state.customAnimations).sort((a, b) => {
        const orderA = state.customAnimations[a].order ?? 0;
        const orderB = state.customAnimations[b].order ?? 0;
        return orderA - orderB;
    });

    if (sortedKeys.length === 0) {
        // Automatically create a default custom animation so the user starts with one immediately!
        await addNewAnimation();
        return;
    }

    elements.animationList.replaceChildren();

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
    menu.appendChild(delBtn);

    document.body.appendChild(menu);
    const rect = e.currentTarget.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY}px`;
    menu.style.left = `${rect.right - menu.offsetWidth + window.scrollX}px`;
}

// Add New Custom Animation Item
async function addNewAnimation() {
    const map = await getCustomAnimationMetadataMap();
    const newId = crypto.randomUUID();

    const existingNames = Object.values(map).map(m => m.name);
    const finalName = resolveDeduplicatedName(state.getMsg('placeholder-meta-name'), existingNames);

    map[newId] = {
        name: finalName,
        description: '',
        author: state.getMsg('anim-unknown-author'),
        order: Object.keys(map).length,
        config: {
            exclusionStrategy: 'freedom'
        },
        payload: {
            renderSpec: {
                focusX: 0,
                focusY: 0,
                targetHeight: 100,
                maxWidth: 200,
                scaleWithHeight: true,
                overflowBehavior: 'repeat',
                previewColor: 'primary'
            }
        }
    };

    await setCustomAnimationMetadataMap(map);
    // Keep raw binary empty initially
    await saveAnimationBlob(newId, null, map[newId].payload.renderSpec, map[newId].config);

    state.selectedId = newId;
    await loadAnimationsList();
    broadcastSync('reload');
}

// Duplicate
async function duplicateAnimation(id) {
    const map = await getCustomAnimationMetadataMap();
    if (!map[id]) return;

    const source = map[id];
    const newId = crypto.randomUUID();

    const existingNames = Object.values(map).map(m => m.name);
    const finalName = resolveDeduplicatedName(source.name, existingNames);

    map[newId] = {
        ...JSON.parse(JSON.stringify(source)),
        name: finalName,
        order: Object.keys(map).length
    };

    await setCustomAnimationMetadataMap(map);

    const sourceBlob = await getAnimationBlob(id);
    await saveAnimationBlob(newId, sourceBlob, map[newId].payload.renderSpec, map[newId].config);

    state.selectedId = newId;
    await loadAnimationsList();
    broadcastSync('reload');
}

// Cascading Deletion
async function deleteAnimation(id) {
    const map = await getCustomAnimationMetadataMap();
    delete map[id];

    // Reorder indices
    Object.keys(map).sort((a,b) => (map[a].order ?? 0) - (map[b].order ?? 0)).forEach((k, idx) => {
        map[k].order = idx;
    });

    await setCustomAnimationMetadataMap(map);
    await deleteAnimationBlob(id);

    // Cascading Category Scan
    const categories = await dbGetAll(STORE_CATEGORIES);
    let categoriesChanged = false;
    for (const cat of categories) {
        if (cat.animation === id) {
            cat.animation = 'none';
            await dbPut(STORE_CATEGORIES, cat);
            categoriesChanged = true;
        }
    }

    if (state.selectedId === id) {
        state.selectedId = null;
    }

    await loadAnimationsList();
    broadcastSync('reload');
    if (categoriesChanged) {
        broadcastSync('sync');
    }
}

// List Drag & Drop Sort
elements.animationList.ondragover = (e) => {
    e.preventDefault();
    const draggingItem = elements.animationList.querySelector('.category-item.dragging');
    if (!draggingItem) return;

    const siblings = [...elements.animationList.querySelectorAll('.category-item:not(.dragging)')];
    let nextSibling = siblings.find(sibling => {
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
    broadcastSync('reload');
};

// Workspace selection
async function selectAnimation(id) {
    if (state.selectedId === id && !elements.editorWorkspace.classList.contains('hidden')) {
        // If clicking the currently active/selected animation and the workspace is already visible, do nothing and keep unsaved changes!
        return;
    }

    // If there is a currently selected animation, save any unsaved changes before switching!
    if (state.selectedId && state.selectedId !== id) {
        if (saveDebounceTimer) {
            clearTimeout(saveDebounceTimer);
            saveDebounceTimer = null;
        }
        await saveCurrentChanges();
    }

    state.selectedId = id;
    const meta = state.customAnimations[id];
    if (!meta) return;

    elements.noSelectionCard.classList.add('hidden');
    elements.editorWorkspace.classList.remove('hidden');

    // Remove active style on all and add to current
    elements.animationList.querySelectorAll('.category-item').forEach(item => {
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
    state.maxWidth = spec.maxWidth || 200;
    state.scaleWithHeight = spec.scaleWithHeight !== undefined ? spec.scaleWithHeight : true;
    state.invert = spec.invert !== undefined ? spec.invert : false;
    state.overflowBehavior = spec.overflowBehavior || 'repeat';
    state.exclusionStrategy = meta.config?.exclusionStrategy || 'freedom';
    state.previewColor = spec.previewColor || 'primary';
    state.brightness = spec.brightness !== undefined ? spec.brightness : 1.0;

    // Populate Inputs
    elements.configExclusionStrategy.value = state.exclusionStrategy;
    elements.configOverflow.value = state.overflowBehavior;
    elements.configMaxWidth.value = state.maxWidth;
    elements.configScaleHeight.checked = state.scaleWithHeight;
    elements.configInvert.checked = state.invert;
    elements.configBrightness.value = state.brightness;
    elements.configBrightnessValue.textContent = state.brightness.toFixed(1);

    renderColorPalette();
    updatePreviewModeStyles();

    // Reset frame lists & fetch from IndexedDB
    state.gifFrames.forEach(f => {
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
    if (blob) {
        state.gifBlob = blob;
        state.gifFileName = meta.name ? `${meta.name}.gif` : 'animation.gif';
        elements.dropZone.style.opacity = '0';
        elements.dropZone.style.pointerEvents = 'none';
        await parseGif(blob);
    } else {
        state.gifBlob = null;
        elements.dropZone.style.opacity = '1';
        elements.dropZone.style.pointerEvents = 'auto';
        elements.gifInfoBox.classList.add('hidden');
    }

    updateMonitor();
    triggerRedraw();
}

// Colors presets palette rendering
function renderColorPalette() {
    elements.previewColorPalette.replaceChildren();
    COLORS.forEach(color => {
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

// Save all changes immediately
async function saveCurrentChanges() {
    if (!state.selectedId) return;
    const map = await getCustomAnimationMetadataMap();
    if (!map[state.selectedId]) return;

    // Map Metadata updates
    map[state.selectedId].name = elements.metaName.value.trim() || state.getMsg('placeholder-meta-name');
    map[state.selectedId].author = elements.metaAuthor.value.trim() || state.getMsg('anim-unknown-author');
    map[state.selectedId].description = elements.metaDesc.value.trim();

    state.exclusionStrategy = elements.configExclusionStrategy.value;
    map[state.selectedId].config = {
        exclusionStrategy: state.exclusionStrategy
    };

    state.maxWidth = parseInt(elements.configMaxWidth.value) || 200;
    state.scaleWithHeight = elements.configScaleHeight.checked;
    state.invert = elements.configInvert.checked;
    state.overflowBehavior = elements.configOverflow.value;
    state.brightness = parseFloat(elements.configBrightness.value) || 1.0;

    map[state.selectedId].payload = {
        renderSpec: {
            focusX: Math.round(state.focusX),
            focusY: Math.round(state.focusY),
            targetHeight: Math.round(state.targetHeight),
            maxWidth: state.maxWidth,
            scaleWithHeight: state.scaleWithHeight,
            invert: state.invert,
            overflowBehavior: state.overflowBehavior,
            previewColor: state.previewColor,
            brightness: state.brightness
        }
    };

    await setCustomAnimationMetadataMap(map);

    // Save Blob and configs to IndexedDB
    await saveAnimationBlob(state.selectedId, state.gifBlob, map[state.selectedId].payload.renderSpec, map[state.selectedId].config);
    triggerRedraw();

    // Refresh only the labels in list view without resetting workspace selection
    const listItems = elements.animationList.querySelectorAll('.category-item');
    listItems.forEach(item => {
        if (item.dataset.id === state.selectedId) {
            const nameSpan = item.querySelector('.cat-name');
            if (nameSpan) nameSpan.textContent = map[state.selectedId].name;
        }
    });

    broadcastSync('reload');
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
    elements.monFocusX.textContent = Math.round(state.focusX);
    elements.monFocusY.textContent = Math.round(state.focusY);
    elements.monScale.textContent = getScaleFactor().toFixed(2);
    elements.monTargetHeight.textContent = Math.round(state.targetHeight);
}

function setupAnimationEngine() {
    const canvas = document.getElementById('animation-canvas');
    if (canvas) {
        state.animationEngine = new AnimationEngine(canvas);
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
}

function updateDownsampledPreview() {
    if (!state.animationEngine || !state.selectedId) return;

    updatePreviewExclusionAreas();

    if (state.isPlaying && state.gifFrames.length > 0) {
        const colorCode = COLOR_CODES[state.previewColor] || '#1976d2';
        const startTime = Date.now() - state.virtualElapsedMs;
        state.animationEngine.start(state.selectedId, startTime, colorCode);
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
    const rW = elements.rawCanvas.width = elements.rawPreviewContainer.clientWidth;
    const rH = elements.rawCanvas.height = elements.rawPreviewContainer.clientHeight;
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

    const destX = (W / 2) - (state.focusX * S);
    const destY = (H / 2) - (state.focusY * S);

    const scaledMaxW = state.maxWidth * S;
    const clipLeft = (W / 2) - (scaledMaxW / 2);

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

    // Fill Overflow color
    if (state.overflowBehavior === 'categoryColor') {
        rawCtx.fillStyle = COLOR_CODES[state.previewColor] || '#1976d2';
        rawCtx.fillRect(clipLeft, 0, scaledMaxW, H);
    }

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
}

function handleMouseMove(e) {
    if (!state.isDragging) return;
    const dx = e.clientX - state.dragStartX;
    const dy = e.clientY - state.dragStartY;
    const S = getScaleFactor();

    // Update focus coordinates
    state.focusX = state.dragStartFocusX - (dx / S);
    state.focusY = state.dragStartFocusY - (dy / S);

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

// Event Listeners setup
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

    elements.addAnimBtn.addEventListener('click', addNewAnimation);

    // Dropzone actions inside rawPreviewContainer
    elements.dropZone.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.gifFileInput.click();
    });

    elements.gifFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            state.gifFileName = file.name;
            state.gifBlob = file;
            elements.dropZone.style.opacity = '0';
            elements.dropZone.style.pointerEvents = 'none';
            await parseGif(file);
            await saveCurrentChanges();
        }
    });

    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('dragover');
    });

    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('dragover');
    });

    elements.dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'image/gif') {
            state.gifFileName = file.name;
            state.gifBlob = file;
            elements.dropZone.style.opacity = '0';
            elements.dropZone.style.pointerEvents = 'none';
            await parseGif(file);
            await saveCurrentChanges();
        } else {
            showAlert('Please drop a valid .gif image file!');
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
                clientY: e.touches[0].clientY
            };
            handleMouseDown(mockEvent);
        }
    });
    window.addEventListener('touchmove', (e) => {
        if (state.isDragging && e.touches.length === 1) {
            const mockEvent = {
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY
            };
            handleMouseMove(mockEvent);
        }
    });
    window.addEventListener('touchend', handleMouseUp);

    // Boundary Lines radio options
    document.querySelectorAll('input[name="boundary-height"]').forEach(radio => {
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
        } else {
            icon.textContent = 'play_arrow';
            elements.btnPlayPause.setAttribute('data-i18n-title', 'tooltip-play');
            elements.btnPlayPause.title = state.getMsg('tooltip-play');
        }
    });

    // Inputs listeners (debounced for text inputs, immediate for selects/checkboxes)
    elements.metaName.addEventListener('input', debouncedSaveCurrentChanges);
    elements.metaAuthor.addEventListener('input', debouncedSaveCurrentChanges);
    elements.metaDesc.addEventListener('input', debouncedSaveCurrentChanges);
    elements.configExclusionStrategy.addEventListener('change', saveCurrentChanges);
    elements.configOverflow.addEventListener('change', saveCurrentChanges);
    elements.configMaxWidth.addEventListener('input', debouncedSaveCurrentChanges);
    elements.configScaleHeight.addEventListener('change', saveCurrentChanges);
    elements.configInvert.addEventListener('change', saveCurrentChanges);
    elements.configBrightness.addEventListener('input', (e) => {
        handleBrightnessChange(e.target.value);
    });

    // Alert Modal close
    elements.alertModalCloseBtn.addEventListener('click', () => {
        elements.alertModal.classList.add('hidden');
    });

    // Data Transfer (Relocated side-by-side buttons)
    elements.btnDownload.addEventListener('click', async () => {
        if (!state.selectedId) {
            showAlert('Please select a custom animation first before downloading!');
            return;
        }
        const map = await getCustomAnimationMetadataMap();
        const meta = map[state.selectedId];
        if (!meta) return;

        const blob = await getAnimationBlob(state.selectedId);
        if (!blob) {
            showAlert('Please import a GIF file first before downloading!');
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
                id: state.selectedId,
                metadata: {
                    name: meta.name,
                    description: meta.description || '',
                    author: meta.author || 'User'
                },
                config: meta.config || { exclusionStrategy: 'freedom' },
                payload: {
                    imageData: base64,
                    renderSpec: meta.payload.renderSpec
                }
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
            showAlert('Failed to read the animation file: ' + err.message);
        }
    });

    elements.btnUpload.addEventListener('click', () => elements.qlanimFileInput.click());
    elements.qlanimFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (data.format !== 'quicklog-animation-package') {
                throw new Error('Invalid format');
            }

            const map = await getCustomAnimationMetadataMap();
            const existingNames = Object.values(map).map(m => m.name);
            const finalName = resolveDeduplicatedName(data.metadata?.name || 'Imported Anim', existingNames);

            const newId = crypto.randomUUID();

            map[newId] = {
                name: finalName,
                description: data.metadata?.description || '',
                author: data.metadata?.author || 'User',
                order: Object.keys(map).length,
                config: data.config || { exclusionStrategy: 'freedom' },
                payload: {
                    renderSpec: data.payload?.renderSpec || {
                        focusX: 0,
                        focusY: 0,
                        targetHeight: 100,
                        maxWidth: 200,
                        scaleWithHeight: true,
                        overflowBehavior: 'repeat',
                        previewColor: 'primary'
                    }
                }
            };

            await setCustomAnimationMetadataMap(map);

            // Decode base64 GIF back to file blob
            const base64 = data.payload.imageData;
            const byteString = atob(base64.split(',')[1]);
            const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });

            await saveAnimationBlob(newId, blob, map[newId].payload.renderSpec, map[newId].config);

            state.selectedId = newId;
            await loadAnimationsList();
            broadcastSync('reload');
            showToast(state.getMsg('toast-loaded-json') || 'Loaded successfully!');

        } catch (err) {
            showAlert('Failed to parse the file: ' + err.message);
        } finally {
            e.target.value = '';
        }
    });
}

init();

// Expose internals for testing
window.getScaleFactor = getScaleFactor;
window.state = state;
