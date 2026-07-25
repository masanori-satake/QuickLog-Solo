/**
 * QL-Animation Maker Logic
 */

import { messages } from '../shared/js/messages.js';

// App State
const state = {
    currentLang: 'en',
    currentTheme: 'dark',
    gifFrames: [], // Array of { bitmap, duration }
    totalDuration: 0,
    isPlaying: true,
    virtualElapsedMs: 0,
    lastFrameTime: 0,
    gifBase64: null, // Keeps original base64 for export
    gifFileName: null,
    gifWidth: 0,
    gifHeight: 0,

    // renderSpec state
    focusX: 0,
    focusY: 0,
    targetHeight: 100,
    currentScale: 1.0, // directly used if scaleWithHeight is false
    currentId: null,

    // Interaction state
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartFocusX: 0,
    dragStartFocusY: 0,

    getMsg: (key) => (messages[state.currentLang] && messages[state.currentLang][key]) || messages.en[key] || key
};

// DOM Elements
const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    langSelect: document.getElementById('lang-select-maker'),
    metaName: document.getElementById('meta-name'),
    metaAuthor: document.getElementById('meta-author'),
    metaDesc: document.getElementById('meta-desc'),
    configExclusionStrategy: document.getElementById('config-exclusion-strategy'),
    configOverflow: document.getElementById('config-overflow'),
    configMaxWidth: document.getElementById('config-max-width'),
    configScaleHeight: document.getElementById('config-scale-height'),

    dropZone: document.getElementById('drop-zone'),
    gifFileInput: document.getElementById('gif-file-input'),
    gifInfoBox: document.getElementById('gif-info-box'),
    gifFileNameSpan: document.getElementById('gif-file-name'),
    gifDimensionsSpan: document.getElementById('gif-dimensions'),
    gifFramesSpan: document.getElementById('gif-frames'),

    monFocusX: document.getElementById('mon-focus-x'),
    monFocusY: document.getElementById('mon-focus-y'),
    monScale: document.getElementById('mon-scale'),
    monTargetHeight: document.getElementById('mon-target-height'),

    canvas: document.getElementById('animation-canvas'),
    previewContainer: document.getElementById('preview-container'),
    boundaryTop: document.querySelector('.boundary-top'),
    boundaryBottom: document.querySelector('.boundary-bottom'),

    btnScaleDown: document.getElementById('btn-scale-down'),
    btnScaleUp: document.getElementById('btn-scale-up'),
    btnScaleReset: document.getElementById('btn-scale-reset'),

    btnPlay: document.getElementById('btn-play'),
    btnPause: document.getElementById('btn-pause'),

    btnDownload: document.getElementById('btn-download-qlanim'),
    btnUpload: document.getElementById('btn-upload-qlanim'),
    qlanimFileInput: document.getElementById('qlanim-file-input'),
    btnCopyClipboard: document.getElementById('btn-copy-clipboard'),
    btnPasteClipboard: document.getElementById('btn-paste-clipboard'),

    alertModal: document.getElementById('alert-modal'),
    alertModalText: document.getElementById('alert-modal-text'),
    alertModalCloseBtn: document.getElementById('alert-modal-close-btn')
};

/**
 * Initializes the language, theme, event listeners, animation loop, and boundary display.
 */
function init() {
    setupLanguage();
    setupTheme();
    setupEventListeners();
    setupAnimationLoop();
    updateBoundaryLines();
}

/**
 * Initializes the application theme from the URL, saved preferences, or system settings.
 */
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
    // Container height is exactly 150px
    const topY = (150 - H) / 2;
    elements.boundaryTop.style.top = `${topY}px`;
    elements.boundaryBottom.style.top = `${topY + H}px`;
    triggerRedraw();
}

function getScaleFactor() {
    if (elements.configScaleHeight.checked) {
        const H = getSelectedBoundaryHeight();
        return H / state.targetHeight;
    }
    return state.currentScale;
}

// Reset state
function resetState() {
    state.gifFrames.forEach(f => {
        if (f.bitmap && typeof f.bitmap.close === 'function') {
            f.bitmap.close();
        }
    });
    state.gifFrames = [];
    state.totalDuration = 0;
    state.gifBase64 = null;
    state.gifFileName = null;
    state.gifWidth = 0;
    state.gifHeight = 0;
    state.focusX = 0;
    state.focusY = 0;
    state.targetHeight = 100;
    state.currentScale = 1.0;
    state.currentId = null;

    elements.gifInfoBox.classList.add('hidden');
    triggerRedraw();
}

// Parse GIF frames using Native ImageDecoder
async function parseGif(file) {
    resetState();
    state.gifFileName = file.name;

    try {
        if (typeof ImageDecoder === 'undefined') {
            // Native ImageDecoder is unsupported in this browser
            showAlert(state.getMsg('alert-invalid-qlanim') + ' (ImageDecoder API is not supported in this browser. Please use Chrome/Edge/Opera or compatible modern browsers.)');
            return;
        }

        const buffer = await file.arrayBuffer();
        const decoder = new ImageDecoder({ data: buffer, type: 'image/gif' });

        if (!decoder.tracks) {
            throw new Error('ImageDecoder tracks list is undefined.');
        }

        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        if (!track) {
            throw new Error('ImageDecoder selectedTrack is null.');
        }

        const frameCount = track.frameCount;
        if (frameCount <= 0) {
            throw new Error('Invalid frame count.');
        }

        let accumulatedDuration = 0;

        for (let i = 0; i < frameCount; i++) {
            const result = await decoder.decode({ frameIndex: i });
            const videoFrame = result.image;
            const bitmap = await createImageBitmap(videoFrame);

            if (i === 0) {
                state.gifWidth = videoFrame.codedWidth;
                state.gifHeight = videoFrame.codedHeight;
                // Default focus point to center
                state.focusX = state.gifWidth / 2;
                state.focusY = state.gifHeight / 2;
            }

            videoFrame.close(); // Clean memory leak

            let duration = (videoFrame.duration || 100000) / 1000;
            if (duration <= 0) duration = 100;

            state.gifFrames.push({ bitmap, duration });
            accumulatedDuration += duration;
        }

        state.totalDuration = accumulatedDuration;

        // Convert file to Base64 for exporting later
        state.gifBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });

        // Update info UI
        elements.gifFileNameSpan.textContent = state.gifFileName;
        elements.gifDimensionsSpan.textContent = `${state.gifWidth} x ${state.gifHeight} px`;
        elements.gifFramesSpan.textContent = `${state.gifFrames.length} frames`;
        elements.gifInfoBox.classList.remove('hidden');

        // Hide overlay once loaded
        const dragOverlay = document.querySelector('.drag-instruction-overlay');
        if (dragOverlay) dragOverlay.style.opacity = '0';

        updateMonitor();
        triggerRedraw();

    } catch (err) {
        console.error('GIF Parsing failed:', err);
        showAlert(state.getMsg('alert-invalid-qlanim') + ' (' + err.message + ')');
        resetState();
    }
}

function updateMonitor() {
    elements.monFocusX.textContent = Math.round(state.focusX);
    elements.monFocusY.textContent = Math.round(state.focusY);
    elements.monScale.textContent = getScaleFactor().toFixed(2);
    elements.monTargetHeight.textContent = Math.round(state.targetHeight);
}

// Generate exported JSON
function generateQlanimJSON() {
    if (!state.gifBase64) {
        return null;
    }

    return {
        format: "quicklog-animation-package",
        formatVersion: "1.0",
        id: state.currentId || crypto.randomUUID(),
        metadata: {
            name: elements.metaName.value.trim() || "My Animation",
            description: elements.metaDesc.value.trim() || "",
            author: elements.metaAuthor.value.trim() || "User"
        },
        config: {
            exclusionStrategy: elements.configExclusionStrategy.value
        },
        payload: {
            imageData: state.gifBase64,
            renderSpec: {
                focusX: Math.round(state.focusX),
                focusY: Math.round(state.focusY),
                targetHeight: Math.round(state.targetHeight),
                maxWidth: parseInt(elements.configMaxWidth.value) || 200,
                scaleWithHeight: elements.configScaleHeight.checked,
                overflowBehavior: elements.configOverflow.value
            }
        }
    };
}

// Load qlanim data
async function loadQlanimData(data) {
    if (!data || data.format !== 'quicklog-animation-package') {
        showAlert(state.getMsg('alert-invalid-qlanim'));
        return;
    }

    try {
        elements.metaName.value = data.metadata?.name || '';
        elements.metaDesc.value = data.metadata?.description || '';
        elements.metaAuthor.value = data.metadata?.author || '';
        elements.configExclusionStrategy.value = data.config?.exclusionStrategy || 'freedom';
        elements.configOverflow.value = data.payload?.renderSpec?.overflowBehavior || 'repeat';
        elements.configMaxWidth.value = data.payload?.renderSpec?.maxWidth || 200;
        elements.configScaleHeight.checked = !!data.payload?.renderSpec?.scaleWithHeight;

        state.currentId = data.id || crypto.randomUUID();

        const renderSpec = data.payload?.renderSpec || {};
        state.focusX = renderSpec.focusX || 0;
        state.focusY = renderSpec.focusY || 0;
        state.targetHeight = renderSpec.targetHeight || 100;
        state.currentScale = 1.0; // default back to 1.0

        // Parse base64 GIF back to file blob
        const base64 = data.payload.imageData;
        const byteString = atob(base64.split(',')[1]);
        const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const file = new File([blob], (data.metadata?.name || 'animation') + '.gif', { type: mimeString });

        await parseGif(file);

        // Override focus / heights loaded from qlanim
        state.focusX = renderSpec.focusX !== undefined ? renderSpec.focusX : state.focusX;
        state.focusY = renderSpec.focusY !== undefined ? renderSpec.focusY : state.focusY;
        state.targetHeight = renderSpec.targetHeight !== undefined ? renderSpec.targetHeight : 100;

        updateMonitor();
        triggerRedraw();
        showToast(state.getMsg('toast-loaded-json') || 'Loaded successfully!');

    } catch (err) {
        console.error('Qlanim Import failed:', err);
        showAlert(state.getMsg('alert-invalid-qlanim') + ' (' + err.message + ')');
    }
}

// Canvas Drawing Loop
function setupAnimationLoop() {
    state.lastFrameTime = performance.now();

    function tick(now) {
        requestAnimationFrame(tick);

        if (state.gifFrames.length === 0) {
            drawEmptyCanvas();
            return;
        }

        if (state.isPlaying) {
            const delta = now - state.lastFrameTime;
            state.virtualElapsedMs += delta;
        }
        state.lastFrameTime = now;

        drawCanvasFrame();
    }
    requestAnimationFrame(tick);
}

function triggerRedraw() {
    if (!state.isPlaying) {
        drawCanvasFrame();
    }
}

function drawEmptyCanvas() {
    const ctx = elements.canvas.getContext('2d');
    const W = elements.canvas.width = elements.previewContainer.clientWidth;
    const H = elements.canvas.height = elements.previewContainer.clientHeight;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No GIF loaded', W / 2, H / 2);
}

function drawCanvasFrame() {
    const ctx = elements.canvas.getContext('2d');
    const W = elements.canvas.width = elements.previewContainer.clientWidth;
    const H = elements.canvas.height = elements.previewContainer.clientHeight; // 150

    if (state.gifFrames.length === 0) return;

    // Active boundary height H
    const activeHeight = getSelectedBoundaryHeight();
    const topY = (H - activeHeight) / 2;

    // Get current frame
    const currentMs = state.virtualElapsedMs % state.totalDuration;
    let frameIndex = 0;
    let runningSum = 0;
    for (let i = 0; i < state.gifFrames.length; i++) {
        runningSum += state.gifFrames[i].duration;
        if (currentMs < runningSum) {
            frameIndex = i;
            break;
        }
    }

    const frame = state.gifFrames[frameIndex];
    if (!frame || !frame.bitmap) return;

    const imgWidth = frame.bitmap.width;
    const imgHeight = frame.bitmap.height;

    // Calculate scale factor
    const S = getScaleFactor();

    const scaledW = imgWidth * S;
    const scaledH = imgHeight * S;

    // Focus aligns centered on active display height area
    const destX = (W / 2) - (state.focusX * S);
    const destY = (H / 2) - (state.focusY * S);

    // Max Width clip boundaries
    const maxW = parseInt(elements.configMaxWidth.value) || 200;
    const scaledMaxW = maxW * S;
    const clipLeft = (W / 2) - (scaledMaxW / 2);

    // Save and apply clipping to active region
    ctx.save();

    // Fill background of preview canvas
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    // Draw active clipping path
    ctx.beginPath();
    ctx.rect(clipLeft, topY, scaledMaxW, activeHeight);
    ctx.clip();

    // Draw overflow background color
    if (elements.configOverflow.value === 'categoryColor') {
        ctx.fillStyle = '#0056d2'; // Standard mock Category Color
        ctx.fillRect(clipLeft, topY, scaledMaxW, activeHeight);
    }

    // Draw actual frames
    if (elements.configOverflow.value === 'repeat') {
        ctx.drawImage(frame.bitmap, destX, destY, scaledW, scaledH);

        // Tile to the right
        let rightX = destX + scaledW;
        while (rightX < clipLeft + scaledMaxW) {
            ctx.drawImage(frame.bitmap, rightX, destY, scaledW, scaledH);
            rightX += scaledW;
        }

        // Tile to the left
        let leftX = destX - scaledW;
        while (leftX + scaledW > clipLeft) {
            ctx.drawImage(frame.bitmap, leftX, destY, scaledW, scaledH);
            leftX -= scaledW;
        }
    } else {
        ctx.drawImage(frame.bitmap, destX, destY, scaledW, scaledH);
    }

    ctx.restore();

    // Render transparent dimmed overlays for outer "inactive" zones
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';

    // Above active boundary
    ctx.fillRect(0, 0, W, topY);
    // Below active boundary
    ctx.fillRect(0, topY + activeHeight, W, H - (topY + activeHeight));
    // Left of active width boundary
    ctx.fillRect(0, topY, clipLeft, activeHeight);
    // Right of active width boundary
    ctx.fillRect(clipLeft + scaledMaxW, topY, W - (clipLeft + scaledMaxW), activeHeight);

    // Draw boundary borders
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(clipLeft, topY, scaledMaxW, activeHeight);
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

    // Scale back movement delta so it corresponds to original image coordinates
    // Dragging right -> moves image right -> focus goes left (subtraction)
    state.focusX = state.dragStartFocusX - (dx / S);
    state.focusY = state.dragStartFocusY - (dy / S);

    // Bounds limit to image dimensions
    state.focusX = Math.max(0, Math.min(state.gifWidth, state.focusX));
    state.focusY = Math.max(0, Math.min(state.gifHeight, state.focusY));

    updateMonitor();
    triggerRedraw();
}

function handleMouseUp() {
    state.isDragging = false;
}

// Setup Interactive Event Listeners
function setupEventListeners() {
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

    // GIF dragging & dropping / upload
    elements.dropZone.addEventListener('click', () => elements.gifFileInput.click());
    elements.gifFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) parseGif(file);
    });

    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('dragover');
    });

    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('dragover');
    });

    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'image/gif') {
            parseGif(file);
        } else {
            showAlert('Please drop a valid .gif image file!');
        }
    });

    // Canvas translation drag handlers
    elements.previewContainer.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Handle touch translation drag support
    elements.previewContainer.addEventListener('touchstart', (e) => {
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

    // Rendering Config Listeners (update monitor immediately)
    elements.configScaleHeight.addEventListener('change', () => {
        updateMonitor();
        triggerRedraw();
    });
    elements.configOverflow.addEventListener('change', () => {
        triggerRedraw();
    });
    elements.configMaxWidth.addEventListener('input', () => {
        triggerRedraw();
    });

    // Zoom scale adjustment buttons
    elements.btnScaleUp.addEventListener('click', () => {
        if (elements.configScaleHeight.checked) {
            // Zooming in with height linkage decreases targetHeight
            state.targetHeight = Math.max(10, state.targetHeight - 10);
        } else {
            state.currentScale += 0.1;
        }
        updateMonitor();
        triggerRedraw();
    });

    elements.btnScaleDown.addEventListener('click', () => {
        if (elements.configScaleHeight.checked) {
            // Zooming out with height linkage increases targetHeight
            state.targetHeight = Math.min(1000, state.targetHeight + 10);
        } else {
            state.currentScale = Math.max(0.1, state.currentScale - 0.1);
        }
        updateMonitor();
        triggerRedraw();
    });

    elements.btnScaleReset.addEventListener('click', () => {
        state.focusX = state.gifWidth / 2;
        state.focusY = state.gifHeight / 2;
        state.targetHeight = 100;
        state.currentScale = 1.0;
        updateMonitor();
        triggerRedraw();
    });

    // Playback control events
    elements.btnPlay.addEventListener('click', () => {
        if (!state.isPlaying) {
            state.isPlaying = true;
            state.lastFrameTime = performance.now();
            elements.btnPlay.classList.add('active');
            elements.btnPause.classList.remove('active');
        }
    });

    elements.btnPause.addEventListener('click', () => {
        if (state.isPlaying) {
            state.isPlaying = false;
            elements.btnPause.classList.add('active');
            elements.btnPlay.classList.remove('active');
        }
    });

    // Alert Modal close handler
    elements.alertModalCloseBtn.addEventListener('click', () => {
        elements.alertModal.classList.add('hidden');
    });

    // Export .qlanim download
    elements.btnDownload.addEventListener('click', () => {
        const json = generateQlanimJSON();
        if (!json) {
            showAlert('Please import a GIF file first before downloading!');
            return;
        }
        const text = JSON.stringify(json, null, 2);
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const defaultName = elements.metaName.value.trim().toLowerCase().replace(/\s+/g, '_') || 'custom_animation';
        a.download = `${defaultName}.qlanim`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Import .qlanim upload trigger
    elements.btnUpload.addEventListener('click', () => elements.qlanimFileInput.click());
    elements.qlanimFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            await loadQlanimData(data);
        } catch (err) {
            showAlert('Failed to parse the file: ' + err.message);
        } finally {
            e.target.value = '';
        }
    });

    // Copy to clipboard
    elements.btnCopyClipboard.addEventListener('click', async () => {
        const json = generateQlanimJSON();
        if (!json) {
            showAlert('Please import a GIF file first before copying!');
            return;
        }
        try {
            await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
            showToast(state.getMsg('toast-custom-anim-exported') || 'Copied to clipboard successfully!');
        } catch (err) {
            showAlert('Clipboard write failed: ' + err.message);
        }
    });

    // Paste from clipboard
    elements.btnPasteClipboard.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text || !text.trim()) {
                showAlert('Clipboard is empty!');
                return;
            }
            const data = JSON.parse(text);
            await loadQlanimData(data);
        } catch (err) {
            showAlert('Clipboard paste or parse failed: ' + err.message);
        }
    });
}

init();
