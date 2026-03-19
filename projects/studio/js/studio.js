/**
 * QL-Animation Studio Logic
 */

import { animations } from '../shared/js/animation_registry.js';
import { AnimationEngine } from '../shared/js/animations.js';
import { messages } from '../shared/js/messages.js';

import { initEditor } from './editor.js';
import { initMetrics } from './metrics.js';
import { initPreview } from './preview.js';
import { initIO } from './io.js';

const StudioState = {
    STOPPED: 'STOPPED',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED'
};

const state = {
    currentLang: 'en',
    metaLang: 'en',
    metaData: {
        name: {},
        description: {}
    },
    engine: null,
    currentState: StudioState.STOPPED,
    isScrubbing: false,
    virtualElapsedMs: 0,
    lastFrameTime: 0,
    isDirty: false,
    workerUrl: null,
    currentPreviewColor: '#0056d2',
    currentTheme: 'dark',
    currentSpeed: 1.0,

    // Methods to be filled by modules or studio.js
    getMsg: (key) => (messages[state.currentLang] && messages[state.currentLang][key]) || messages.en[key] || key,
    markDirty: () => { state.isDirty = true; },
    showToast: (msg) => {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
};

// DOM Elements
const elements = {
    sampleSelect: document.getElementById('sample-select'),
    langSelect: document.getElementById('lang-select-studio'),
    themeToggle: document.getElementById('theme-toggle'),
    metaLangSelect: document.getElementById('meta-lang-select'),
    codeTabs: document.querySelectorAll('.code-tab'),
    editors: document.querySelectorAll('.editor-container'),

    stopBtn: document.getElementById('stop-btn'),
    rewindBtn: document.getElementById('rewind-btn'),
    playBtn: document.getElementById('play-btn'),
    ffBtn: document.getElementById('ff-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    ejectBtn: document.getElementById('eject-btn'),
    tapeCounterEl: document.getElementById('tape-counter'),

    downloadBtn: document.getElementById('download-btn'),
    uploadBtn: document.getElementById('upload-btn'),
    uploadInput: document.getElementById('studio-upload-input'),
    prBtn: document.getElementById('pr-btn'),
    prModal: document.getElementById('pr-modal'),
    closePrBtns: document.querySelectorAll('.close-modal-btn'),

    inputVars: document.getElementById('input-vars'),
    inputSetup: document.getElementById('input-setup'),
    inputDraw: document.getElementById('input-draw'),
    inputInteraction: document.getElementById('input-interaction'),

    metaName: document.getElementById('meta-name'),
    metaAuthor: document.getElementById('meta-author'),
    metaDesc: document.getElementById('meta-desc'),
    configMode: document.getElementById('config-mode'),
    configExclusionStrategy: document.getElementById('config-exclusion-strategy'),
    configRewindable: document.getElementById('config-rewindable'),

    canvas: document.getElementById('animation-canvas'),
    exclusionSim: document.getElementById('exclusion-simulator'),
    metricsPanel: document.getElementById('metrics-panel'),
    showMetricsCheck: document.getElementById('show-metrics'),
    showExclusionCheck: document.getElementById('show-exclusion'),
    showCanvasLabel: document.getElementById('show-canvas-label'),
    showCanvasCheck: document.getElementById('show-canvas'),
    shrinkPreviewBtn: document.getElementById('shrink-preview'),
    expandPreviewBtn: document.getElementById('expand-preview'),
    previewContainer: document.getElementById('preview-container'),
    rawCanvasContainer: document.getElementById('raw-canvas-container'),
    rawCanvas: document.getElementById('raw-canvas'),
    colorPresetsContainer: document.getElementById('preview-color-presets'),
    speedSlider: document.getElementById('preview-speed'),
    speedValue: document.getElementById('speed-value'),

    metricLatency: document.getElementById('metric-latency'),
    metricDensity: document.getElementById('metric-density'),
    metricChange: document.getElementById('metric-change'),
    metricStatus: document.getElementById('metric-status'),

    needleLatency: document.getElementById('meter-latency').querySelector('.meter-needle'),
    needleDensity: document.getElementById('meter-density').querySelector('.meter-needle'),
    needleChange: document.getElementById('meter-change').querySelector('.meter-needle'),

    toggleWrapBtn: document.getElementById('toggle-wrap'),
    showSearchBtn: document.getElementById('show-search'),
    searchBar: document.getElementById('search-bar'),
    searchInput: document.getElementById('search-input'),
    replaceInput: document.getElementById('replace-input'),
    btnReplace: document.getElementById('btn-replace'),
    btnReplaceAll: document.getElementById('btn-replace-all'),
    closeSearchBtn: document.getElementById('close-search'),

    consoleSection: document.getElementById('console-section'),
    consoleOutput: document.getElementById('console-output'),
    clearConsoleBtn: document.getElementById('clear-console'),
    toggleConsoleBtn: document.getElementById('toggle-console')
};

let editorMod, metricsMod, previewMod, ioMod;

// Initialize
function init() {
    setupLanguage();
    setupTheme();
    state.engine = new AnimationEngine(elements.canvas);

    // Modules initialization
    editorMod = initEditor(state, elements);
    metricsMod = initMetrics(state, elements);
    previewMod = initPreview(state, elements);
    ioMod = initIO(state, elements);

    // Register module methods to state for cross-module calls
    state.updateAllHighlight = editorMod.updateAllHighlight;
    state.updateAllGutter = editorMod.updateAllGutter;
    state.startMetricsCollection = metricsMod.startMetricsCollection;
    state.stopMetricsCollection = metricsMod.stopMetricsCollection;
    state.resetMeters = metricsMod.resetMeters;
    state.updateTapeCounter = () => metricsMod.updateTapeCounter(state.virtualElapsedMs);
    state.appendConsole = metricsMod.appendConsole;
    state.showConsole = metricsMod.showConsole;
    state.updateExclusionAreas = previewMod.updateExclusionAreas;
    state.updateCanvasControlVisibility = previewMod.updateCanvasControlVisibility;
    state.updateTapeControlState = previewMod.updateTapeControlState;
    state.adjustPreviewHeight = previewMod.adjustPreviewHeight;
    state.buildModuleCode = ioMod.buildModuleCode;

    // Studio.js specific state methods
    state.startTest = startTest;
    state.stopTest = stopTest;
    state.pauseTest = pauseTest;
    state.resumeTest = resumeTest;
    state.resetStudioUI = resetStudioUI;
    state.saveCurrentMetaData = saveCurrentMetaData;
    state.loadCurrentMetaData = loadCurrentMetaData;
    state.parseAndPopulate = parseAndPopulate;
    state.requestStudioDraw = _requestStudioDraw;

    populateSamples();
    setupEventListeners();

    // Initial UI state
    state.updateAllGutter();
    state.updateAllHighlight();
}

function setupTheme() {
    const savedTheme = localStorage.getItem('studio-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    state.currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    elements.themeToggle.checked = (state.currentTheme === 'dark');
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
    state.metaLang = matched;
    elements.langSelect.value = matched;
    elements.metaLangSelect.value = matched;
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
        if (messages[state.currentLang] && messages[state.currentLang][key]) {
            el.textContent = messages[state.currentLang][key];
        } else if (messages._common && messages._common[key]) {
            el.textContent = messages._common[key];
        } else if (messages.en[key] !== undefined) {
            el.textContent = messages.en[key];
        }
    });

    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (messages[state.currentLang] && messages[state.currentLang][key]) {
            el.innerHTML = messages[state.currentLang][key];
        } else if (messages.en[key]) {
            el.innerHTML = messages.en[key];
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (messages[state.currentLang] && messages[state.currentLang][key]) {
            el.title = messages[state.currentLang][key];
        } else if (messages.en[key] !== undefined) {
            el.title = messages.en[key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (messages[state.currentLang] && messages[state.currentLang][key]) {
            el.placeholder = messages[state.currentLang][key];
        }
    });
}

function populateSamples() {
    animations.forEach(anim => {
        const option = document.createElement('option');
        option.value = anim.id;
        const name = typeof anim.metadata.name === 'object' ? anim.metadata.name[state.currentLang] || anim.metadata.name.en : anim.metadata.name;
        const glyph = anim.devOnly ? '\u3000 ' : '📦 ';
        option.textContent = glyph + name;
        elements.sampleSelect.appendChild(option);
    });
}

function setupEventListeners() {
    elements.langSelect.addEventListener('change', (e) => {
        state.currentLang = e.target.value;

        const url = new URL(window.location);
        url.searchParams.set('lang', state.currentLang);
        window.history.replaceState({}, '', url);

        updateTranslations();
        updateBackLink();

        const val = elements.sampleSelect.value;
        elements.sampleSelect.innerHTML = '<option value="" data-i18n="sample-select-placeholder">サンプルを選択...</option>';
        updateTranslations();
        populateSamples();
        elements.sampleSelect.value = val;
    });

    elements.themeToggle.addEventListener('change', () => {
        state.currentTheme = elements.themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('studio-theme', state.currentTheme);
        applyTheme();
    });

    elements.metaLangSelect.addEventListener('change', (e) => {
        saveCurrentMetaData();
        state.metaLang = e.target.value;
        loadCurrentMetaData();
    });

    elements.metaName.addEventListener('input', () => {
        saveCurrentMetaData();
        state.markDirty();
    });
    elements.metaDesc.addEventListener('input', () => {
        saveCurrentMetaData();
        state.markDirty();
    });
    elements.metaAuthor.addEventListener('input', state.markDirty);
    elements.configMode.addEventListener('change', () => {
        state.markDirty();
        state.updateCanvasControlVisibility();
    });
    elements.configExclusionStrategy.addEventListener('change', () => {
        state.markDirty();
        state.updateExclusionAreas();
    });
    elements.configRewindable.addEventListener('change', () => {
        state.markDirty();
        state.updateTapeControlState();
    });

    elements.sampleSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            if (state.currentState !== StudioState.STOPPED) {
                stopTest();
            }
            resetStudioUI(false);
            loadSample(e.target.value);
        }
    });

    window.addEventListener('beforeunload', (e) => {
        if (state.isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            elements.searchBar.classList.toggle('hidden');
            if (!elements.searchBar.classList.contains('hidden')) {
                elements.searchInput.focus();
            }
        }
    });
}

function resetStudioUI(full = true) {
    if (full) {
        state.metaLang = state.currentLang;
        elements.metaLangSelect.value = state.currentLang;
        state.metaData = {
            name: {},
            description: {}
        };
        elements.metaName.value = '';
        elements.metaAuthor.value = '';
        elements.metaDesc.value = '';

        elements.inputVars.value = '';
        elements.inputSetup.value = '';
        elements.inputDraw.value = '';
        elements.inputInteraction.value = '';
        state.updateAllHighlight();
        state.updateAllGutter();
    }

    elements.configRewindable.checked = false;
    elements.configExclusionStrategy.value = 'mask';
    state.updateTapeControlState();
    state.updateCanvasControlVisibility();

    const defaultColor = '#0056d2';
    state.currentPreviewColor = defaultColor;
    document.querySelectorAll('.color-preset').forEach(p => {
        const isDefault = p.style.backgroundColor === 'rgb(0, 86, 210)';
        p.classList.toggle('active', isDefault);
    });
    if (state.currentState !== StudioState.STOPPED && state.engine) state.engine.color = defaultColor;

    state.currentSpeed = 1.0;
    elements.speedSlider.value = 1.0;
    elements.speedValue.textContent = '1.0';

    elements.showMetricsCheck.checked = true;
    elements.metricsPanel.style.display = 'grid';
    elements.showExclusionCheck.checked = true;
    elements.exclusionSim.style.display = 'flex';

    elements.previewContainer.style.height = '150px';
    elements.rawCanvasContainer.style.height = '150px';

    elements.exclusionSim.style.top = '40px';
    elements.exclusionSim.style.left = '40px';
    elements.exclusionSim.style.width = '120px';
    elements.exclusionSim.style.height = '40px';

    state.virtualElapsedMs = 0;
    state.updateTapeCounter();

    if (state.engine) state.engine.resize();
    state.updateExclusionAreas();
}

async function loadSample(id) {
    const anim = animations.find(a => a.id === id);
    if (!anim) return;

    try {
        const response = await fetch(`shared/js/animation/${id}.js`);
        const text = await response.text();
        parseAndPopulate(text, anim.metadata);
        state.updateCanvasControlVisibility();
        state.updateAllGutter();
        state.updateAllHighlight();
    } catch {
        console.error('Failed to load sample');
    }
}

function saveCurrentMetaData() {
    state.metaData.name[state.metaLang] = elements.metaName.value;
    state.metaData.description[state.metaLang] = elements.metaDesc.value;
}

function loadCurrentMetaData() {
    elements.metaName.value = state.metaData.name[state.metaLang] || '';
    elements.metaDesc.value = state.metaData.description[state.metaLang] || '';
}

function parseAndPopulate(code, metadata) {
    state.isDirty = false;
    state.metaData.name = typeof metadata.name === 'object' ? { ...metadata.name } : { en: metadata.name };
    state.metaData.description = typeof metadata.description === 'object' ? { ...metadata.description } : { en: metadata.description || '' };
    loadCurrentMetaData();

    elements.metaAuthor.value = metadata.author || '';

    const modeMatch = code.match(/mode:\s*['"](canvas|matrix|sprite)['"]/);
    elements.configMode.value = modeMatch ? modeMatch[1] : 'canvas';

    const strategyMatch = code.match(/exclusionStrategy:\s*['"](mask|jump|freedom)['"]/);
    elements.configExclusionStrategy.value = strategyMatch ? strategyMatch[1] : 'mask';

    elements.configRewindable.checked = /rewindable:\s*true/.test(code);
    state.updateTapeControlState();
    state.updateExclusionAreas();

    const classMatch = code.match(/export\s+default\s+class\s+\w+\s+extends\s+AnimationBase\s*\{/);
    if (!classMatch) return;

    let classStart = classMatch.index + classMatch[0].length;
    let bCount = 1;
    let pos = classStart;
    while (bCount > 0 && pos < code.length) {
        if (code[pos] === '{') bCount++;
        else if (code[pos] === '}') bCount--;
        pos++;
    }
    let classContent = code.substring(classStart, pos - 1);

    elements.inputSetup.value = extractMethod(classContent, 'setup');
    elements.inputDraw.value = extractMethod(classContent, 'draw');

    if (elements.inputDraw.value) {
        elements.inputDraw.value = elements.inputDraw.value.replace(/draw\s*\(\s*ctx\s*,\s*\{\s*width\s*,\s*height\s*,\s*/, 'draw(ctx, { ');
        elements.inputDraw.value = elements.inputDraw.value.replace(/draw\s*\(\s*ctx\s*,\s*\{\s*width\s*,\s*height\s*\}\s*\)/, 'draw(ctx, params)');
    }

    classContent = classContent.replace(/usePseudoSpace:\s*(true|false),?\s*/g, '');
    classContent = classContent.replace(/ignoreExclusion:\s*(true|false),?\s*/g, '');

    const onClick = extractMethod(classContent, 'onClick');
    const onMouseMove = extractMethod(classContent, 'onMouseMove');
    elements.inputInteraction.value = (onClick ? onClick + '\n\n' : '') + (onMouseMove ? onMouseMove : '');

    if (!elements.inputSetup.value) elements.inputSetup.value = 'setup(width, height) {\n  this.width = width;\n  this.height = height;\n}';
    if (!elements.inputDraw.value) elements.inputDraw.value = 'draw(ctx, { elapsedMs, progress, step, exclusionAreas }) {\n  \n}';
    if (!elements.inputInteraction.value) elements.inputInteraction.value = 'onClick(x, y) {\n  \n}\n\nonMouseMove(x, y) {\n  \n}';

    let vars = classContent;
    const toRemove = ['metadata', 'config', 'setup', 'draw', 'onClick', 'onMouseMove'];

    toRemove.forEach(name => {
        let r;
        while ((r = findRange(vars, name)) !== null) {
            vars = vars.substring(0, r.start) + vars.substring(r.end);
        }
    });

    vars = vars.replace(/^\s*;+/gm, '').replace(/;+\s*$/gm, '').replace(/\n\s*\n\s*\n/g, '\n\n');
    elements.inputVars.value = vars.trim();
}

function extractMethod(code, name) {
    const range = findRange(code, name);
    if (!range) return '';
    return deindent(code.substring(range.start, range.end)).trim();
}

function deindent(text) {
    const lines = text.split('\n');
    const minIndent = lines.reduce((min, line) => {
        if (line.trim().length === 0) return min;
        const match = line.match(/^\s*/);
        return Math.min(min, match[0].length);
    }, Infinity);

    if (minIndent === Infinity) return text;

    return lines.map(line => {
        if (line.trim().length === 0) return '';
        return line.substring(minIndent);
    }).join('\n');
}

function findRange(text, namePattern) {
    const regex = new RegExp(`(^|\\n)([ \\t]*)(static\\s+)?${namePattern}\\b`, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
        let actualStart = match.index + match[1].length;
        if (actualStart > 0 && text[actualStart - 1] === '.') continue;

        let pos = actualStart;
        let braceCount = 0;
        let parenCount = 0;
        let started = false;

        for (let i = pos; i < text.length; i++) {
            const char = text[i];
            if (char === '(') parenCount++;
            else if (char === ')') parenCount--;
            else if (char === '{') {
                if (parenCount === 0) {
                    braceCount++;
                    started = true;
                }
            } else if (char === '}') {
                if (parenCount === 0) {
                    braceCount--;
                    if (started && braceCount === 0) {
                        let end = i + 1;
                        while (end < text.length && (text[end] === ';' || text[end] === ' ' || text[end] === '\t')) {
                            end++;
                        }
                        return { start: actualStart, end };
                    }
                }
            } else if (char === ';' && braceCount === 0 && parenCount === 0) {
                if (started || i > actualStart + namePattern.length) {
                    return { start: actualStart, end: i + 1 };
                }
            }
        }
    }
    return null;
}

function startTest() {
    state.currentState = StudioState.PLAYING;
    elements.playBtn.classList.add('active');
    elements.pauseBtn.classList.remove('active');

    setInputDisabled(true);

    const fullCode = state.buildModuleCode();
    const blob = new Blob([fullCode], { type: 'application/javascript' });
    if (state.workerUrl) URL.revokeObjectURL(state.workerUrl);
    state.workerUrl = URL.createObjectURL(blob);

    state.virtualElapsedMs = 0;
    state.lastFrameTime = performance.now();

    state.engine.config = {
        mode: elements.configMode.value,
        exclusionStrategy: elements.configExclusionStrategy.value
    };

    state.updateExclusionAreas();

    const originalStart = state.engine.start;
    const originalDraw = state.engine.draw;

    state.engine.draw = function() {
        if (state.currentState === StudioState.PAUSED || state.isScrubbing) return;

        const now = performance.now();
        if (state.currentState === StudioState.PLAYING) {
            const delta = (now - state.lastFrameTime) * state.currentSpeed;
            state.virtualElapsedMs += delta;
        }
        state.lastFrameTime = now;

        state.updateTapeCounter();
        _requestStudioDraw(state.virtualElapsedMs);
    };

    state.engine.start = function(name, startTime, color) {
        this.stop();
        this.activeAnimationId = 'test';
        this.startTime = startTime;
        this.color = color;
        this.initialized = false;
        this.perfViolations = 0;
        this.isDrawPending = false;
        this.requestRawBitmap = elements.showCanvasCheck.checked;
        this.onRawBitmapDraw = (bitmap) => {
            const ctx = elements.rawCanvas.getContext('2d');
            if (elements.rawCanvas.width !== state.engine.canvas.width || elements.rawCanvas.height !== state.engine.canvas.height) {
                elements.rawCanvas.width = state.engine.canvas.width;
                elements.rawCanvas.height = state.engine.canvas.height;
            }
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, bitmap.width, bitmap.height);
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
        };

        this.worker = new Worker(new URL('../shared/js/animation_worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this._handleWorkerMessage(e);
        this.worker.postMessage({ type: 'init', payload: { modulePath: state.workerUrl } });
        this.worker.postMessage({ type: 'setSpeed', payload: 1.0 });
    };

    state.engine.start('test', Date.now(), state.currentPreviewColor);

    state.engine._originalStart = originalStart;
    state.engine._originalDraw = originalDraw;

    elements.metricStatus.textContent = state.getMsg('status-running');
    elements.metricStatus.style.color = '#4caf50';

    state.startMetricsCollection(state.engine);
}

function stopTest() {
    state.currentState = StudioState.STOPPED;
    elements.playBtn.classList.remove('active');
    elements.pauseBtn.classList.remove('active');

    setInputDisabled(false);
    if (state.engine) {
        state.engine.stop();
        if (state.engine._originalStart) state.engine.start = state.engine._originalStart;
        if (state.engine._originalDraw) state.engine.draw = state.engine._originalDraw;
    }

    const ctx = elements.rawCanvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, elements.rawCanvas.width, elements.rawCanvas.height);

    elements.metricStatus.textContent = state.getMsg('status-ready');
    elements.metricStatus.style.color = 'inherit';
    state.stopMetricsCollection();
    state.resetMeters();
}

function pauseTest() {
    if (state.currentState !== StudioState.PLAYING) return;
    state.currentState = StudioState.PAUSED;
    elements.pauseBtn.classList.add('active');
    elements.playBtn.classList.remove('active');

    elements.metricStatus.textContent = state.getMsg('status-paused');
    elements.metricStatus.style.color = '#ffa000';
}

function resumeTest() {
    if (state.currentState !== StudioState.PAUSED && state.currentState !== StudioState.STOPPED) return;
    if (state.currentState === StudioState.STOPPED) {
        startTest();
        return;
    }
    state.currentState = StudioState.PLAYING;
    elements.pauseBtn.classList.remove('active');
    elements.playBtn.classList.add('active');
    state.lastFrameTime = performance.now();

    elements.metricStatus.textContent = state.getMsg('status-running');
    elements.metricStatus.style.color = '#4caf50';
}

function _requestStudioDraw(elapsed) {
    if (!state.engine || !state.engine.worker || !state.engine.initialized || state.engine.isDrawPending) return;

    const progress = (elapsed % state.engine.cycleMs) / state.engine.cycleMs;
    let drawWidth = state.engine.canvas.width;
    if (state.engine.config.exclusionStrategy === 'jump') {
        drawWidth = state.engine._getPseudoInfo().totalWidth;
    }

    const params = {
        width: drawWidth,
        height: state.engine.canvas.height,
        canvasWidth: state.engine.canvas.width,
        elapsedMs: elapsed,
        progress,
        step: Math.floor(progress * 240),
        exclusionAreas: state.engine.config.exclusionStrategy === 'jump' ? [] : state.engine._getVirtualExclusionAreas(),
        realExclusionAreas: state.engine.exclusionAreas,
        requestRawBitmap: state.engine.requestRawBitmap
    };

    state.engine.lastDrawRequestTime = performance.now();
    state.engine.isDrawPending = true;
    state.engine.worker.postMessage({ type: 'draw', payload: params });
}

function setInputDisabled(disabled) {
    [elements.metaName, elements.metaAuthor, elements.metaDesc, elements.configMode, elements.configExclusionStrategy, elements.configRewindable, elements.inputVars, elements.inputSetup, elements.inputDraw, elements.inputInteraction, elements.sampleSelect].forEach(el => {
        el.disabled = disabled;
    });
}

init();
