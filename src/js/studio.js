/**
 * QL-Animation Studio Logic
 */

import { animations } from './animation_registry.js';
import { AnimationEngine } from './animations.js';
import { messages } from './messages.js';

let currentLang = 'en';
let metaLang = 'en';
let metaData = {
    name: {},
    description: {}
};
let engine = null;
const StudioState = {
    STOPPED: 'STOPPED',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED'
};
let currentState = StudioState.STOPPED;
let isScrubbing = false;
let studioIgnoreExclusion = false;
let virtualElapsedMs = 0;
let lastFrameTime = 0;

let isDirty = false;
let workerUrl = null;
let currentPreviewColor = '#0056d2'; // Default primary
let currentTheme = 'dark';
let isWordWrap = true;
let currentSpeed = 1.0;

// DOM Elements
const sampleSelect = document.getElementById('sample-select');
const langSelect = document.getElementById('lang-select-studio');
const themeToggle = document.getElementById('theme-toggle');
const metaLangSelect = document.getElementById('meta-lang-select');
const codeTabs = document.querySelectorAll('.code-tab');
const editors = document.querySelectorAll('.editor-container');

const stopBtn = document.getElementById('stop-btn');
const rewindBtn = document.getElementById('rewind-btn');
const playBtn = document.getElementById('play-btn');
const ffBtn = document.getElementById('ff-btn');
const pauseBtn = document.getElementById('pause-btn');
const ejectBtn = document.getElementById('eject-btn');
const tapeCounterEl = document.getElementById('tape-counter');

const downloadBtn = document.getElementById('download-btn');
const uploadBtn = document.getElementById('upload-btn');
const uploadInput = document.getElementById('studio-upload-input');
const prBtn = document.getElementById('pr-btn');
const prModal = document.getElementById('pr-modal');
const closePrBtns = document.querySelectorAll('.close-modal-btn');

const inputVars = document.getElementById('input-vars');
const inputSetup = document.getElementById('input-setup');
const inputDraw = document.getElementById('input-draw');
const inputInteraction = document.getElementById('input-interaction');

const metaName = document.getElementById('meta-name');
const metaAuthor = document.getElementById('meta-author');
const metaDesc = document.getElementById('meta-desc');
const configMode = document.getElementById('config-mode');
const configPseudo = document.getElementById('config-pseudo');
const configRewindable = document.getElementById('config-rewindable');
const configIgnoreExclusion = document.getElementById('config-ignore-exclusion');

const canvas = document.getElementById('animation-canvas');
const exclusionSim = document.getElementById('exclusion-simulator');
const metricsPanel = document.getElementById('metrics-panel');
const showMetricsCheck = document.getElementById('show-metrics');
const showExclusionCheck = document.getElementById('show-exclusion');
const showCanvasLabel = document.getElementById('show-canvas-label');
const showCanvasCheck = document.getElementById('show-canvas');
const shrinkPreviewBtn = document.getElementById('shrink-preview');
const expandPreviewBtn = document.getElementById('expand-preview');
const previewContainer = document.getElementById('preview-container');
const rawCanvasContainer = document.getElementById('raw-canvas-container');
const rawCanvas = document.getElementById('raw-canvas');
const colorPresetsContainer = document.getElementById('preview-color-presets');
const speedSlider = document.getElementById('preview-speed');
const speedValue = document.getElementById('speed-value');

const metricLatency = document.getElementById('metric-latency');
const metricDensity = document.getElementById('metric-density');
const metricChange = document.getElementById('metric-change');
const metricStatus = document.getElementById('metric-status');

const needleLatency = document.getElementById('meter-latency').querySelector('.meter-needle');
const needleDensity = document.getElementById('meter-density').querySelector('.meter-needle');
const needleChange = document.getElementById('meter-change').querySelector('.meter-needle');

const toggleWrapBtn = document.getElementById('toggle-wrap');
const showSearchBtn = document.getElementById('show-search');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const replaceInput = document.getElementById('replace-input');
const btnReplace = document.getElementById('btn-replace');
const btnReplaceAll = document.getElementById('btn-replace-all');
const closeSearchBtn = document.getElementById('close-search');

const consoleSection = document.getElementById('console-section');
const consoleOutput = document.getElementById('console-output');
const clearConsoleBtn = document.getElementById('clear-console');
const toggleConsoleBtn = document.getElementById('toggle-console');

// Initialize
function init() {
    setupLanguage();
    setupTheme();
    setupEngine();
    populateSamples();
    setupColorPresets();
    setupEventListeners();
    setupDraggableResizable();
    setupEditorEnhancements();

    // Initial UI state
    updateAllGutter();
    updateAllHighlight();
}

function setupTheme() {
    const savedTheme = localStorage.getItem('studio-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    // Body class is already set by inline script to prevent flickering
    themeToggle.checked = (currentTheme === 'dark');
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
    metaLang = matched;
    langSelect.value = matched;
    metaLangSelect.value = matched;
    updateTranslations();
}

function updateTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (messages[currentLang] && messages[currentLang][key]) {
            el.textContent = messages[currentLang][key];
        } else if (messages._common && messages._common[key]) {
            el.textContent = messages._common[key];
        } else if (messages.en[key] !== undefined) {
            el.textContent = messages.en[key];
        }
    });

    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (messages[currentLang] && messages[currentLang][key]) {
            el.innerHTML = messages[currentLang][key];
        } else if (messages.en[key]) {
            el.innerHTML = messages.en[key];
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (messages[currentLang] && messages[currentLang][key]) {
            el.title = messages[currentLang][key];
        } else if (messages.en[key] !== undefined) {
            el.title = messages.en[key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (messages[currentLang] && messages[currentLang][key]) {
            el.placeholder = messages[currentLang][key];
        }
    });
}

function setupEngine() {
    engine = new AnimationEngine(canvas);
}

function setupColorPresets() {
    const colors = [
        '#0056d2', '#1976d2', '#039be5', '#0097a7', '#00796b', '#388e3c',
        '#7cb342', '#fbc02d', '#ffa000', '#f57c00', '#d32f2f', '#c2185b',
        '#8e24aa', '#5e35b1', '#303f9f'
    ];

    colors.forEach(color => {
        const div = document.createElement('div');
        div.className = 'color-preset';
        if (color === currentPreviewColor) div.classList.add('active');
        div.style.backgroundColor = color;
        div.addEventListener('click', () => {
            currentPreviewColor = color;
            document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('active'));
            div.classList.add('active');
            if (currentState !== StudioState.STOPPED && engine) {
                engine.color = color;
            }
        });
        colorPresetsContainer.appendChild(div);
    });
}

function populateSamples() {
    animations.forEach(anim => {
        const option = document.createElement('option');
        option.value = anim.id;
        const name = typeof anim.metadata.name === 'object' ? anim.metadata.name[currentLang] || anim.metadata.name.en : anim.metadata.name;
        option.textContent = name;
        sampleSelect.appendChild(option);
    });
}

function setupEventListeners() {
    langSelect.addEventListener('change', (e) => {
        currentLang = e.target.value;
        updateTranslations();
        // Re-populate samples to update names
        const val = sampleSelect.value;
        sampleSelect.innerHTML = '<option value="" data-i18n="sample-select-placeholder">サンプルを選択...</option>';
        updateTranslations(); // Refill placeholder
        populateSamples();
        sampleSelect.value = val;
    });

    themeToggle.addEventListener('change', () => {
        currentTheme = themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('studio-theme', currentTheme);
        applyTheme();
    });

    metaLangSelect.addEventListener('change', (e) => {
        saveCurrentMetaData();
        metaLang = e.target.value;
        loadCurrentMetaData();
    });

    metaName.addEventListener('input', () => {
        saveCurrentMetaData();
        markDirty();
    });
    metaDesc.addEventListener('input', () => {
        saveCurrentMetaData();
        markDirty();
    });
    metaAuthor.addEventListener('input', markDirty);
    configMode.addEventListener('change', () => {
        markDirty();
        updateCanvasControlVisibility();
    });
    configPseudo.addEventListener('change', markDirty);
    configRewindable.addEventListener('change', () => {
        markDirty();
        updateTapeControlState();
    });
    configIgnoreExclusion.addEventListener('change', () => {
        markDirty();
        studioIgnoreExclusion = configIgnoreExclusion.checked;
        updateExclusionAreas();
    });

    [inputVars, inputSetup, inputDraw, inputInteraction].forEach(el => {
        el.addEventListener('input', () => {
            markDirty();
            updateGutter(el);
            updateHighlight(el);
        });
        el.addEventListener('scroll', () => {
            syncScroll(el);
        });
    });

    sampleSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            if (currentState !== StudioState.STOPPED) {
                stopTest();
            }
            resetStudioUI(false); // Don't reset everything if just changing sample
            loadSample(e.target.value);
        }
    });

    codeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            codeTabs.forEach(t => t.classList.remove('active'));
            editors.forEach(e => e.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            const target = document.getElementById(targetId);
            target.classList.add('active');

            // Refresh highlighting and gutter for the newly visible editor
            const textarea = target.querySelector('textarea');
            if (textarea) {
                updateHighlight(textarea);
                updateGutter(textarea);
                syncScroll(textarea);
            }
        });
    });

    playBtn.addEventListener('click', () => {
        if (currentState === StudioState.STOPPED) {
            startTest();
        } else if (currentState === StudioState.PAUSED) {
            resumeTest();
        }
    });

    stopBtn.addEventListener('click', stopTest);

    pauseBtn.addEventListener('click', () => {
        if (currentState === StudioState.PLAYING) {
            pauseTest();
        } else if (currentState === StudioState.PAUSED) {
            resumeTest();
        }
    });

    rewindBtn.addEventListener('click', () => scrub(-1));
    ffBtn.addEventListener('click', () => scrub(1));

    ejectBtn.addEventListener('click', () => {
        if (currentState === StudioState.STOPPED) {
            sampleSelect.value = '';
            resetStudioUI(true);
        }
    });

    downloadBtn.addEventListener('click', downloadAnimation);
    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', handleUpload);
    prBtn.addEventListener('click', () => prModal.classList.remove('hidden'));
    closePrBtns.forEach(btn => btn.addEventListener('click', () => prModal.classList.add('hidden')));
    prModal.addEventListener('click', (e) => {
        if (e.target === prModal) {
            prModal.classList.add('hidden');
        }
    });

    showMetricsCheck.addEventListener('change', (e) => {
        metricsPanel.style.display = e.target.checked ? 'grid' : 'none';
    });

    showExclusionCheck.addEventListener('change', (e) => {
        exclusionSim.style.display = e.target.checked ? 'flex' : 'none';
        updateExclusionAreas();
    });

    showCanvasCheck.addEventListener('change', (e) => {
        const checked = e.target.checked;
        rawCanvasContainer.classList.toggle('hidden', !checked);
        if (engine) engine.requestRawBitmap = checked;
    });

    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    window.addEventListener('resize', () => {
        if (engine) engine.resize();
        // Wait for potential wrapping to finish before updating gutter
        setTimeout(updateAllGutter, 50);
    });

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            searchBar.classList.toggle('hidden');
            if (!searchBar.classList.contains('hidden')) {
                searchInput.focus();
            }
        }
    });

    shrinkPreviewBtn.addEventListener('click', () => adjustPreviewHeight(-20));
    expandPreviewBtn.addEventListener('click', () => adjustPreviewHeight(20));

    speedSlider.addEventListener('input', (e) => {
        currentSpeed = parseFloat(e.target.value);
        speedValue.textContent = currentSpeed.toFixed(1);
        // Speed is now handled in engine.draw override for testing
    });

    toggleWrapBtn.addEventListener('click', () => {
        isWordWrap = !isWordWrap;
        toggleWrapBtn.classList.toggle('active', isWordWrap);
        document.querySelectorAll('.editor-textarea, .editor-highlight').forEach(el => {
            if (isWordWrap) {
                el.classList.remove('no-wrap');
            } else {
                el.classList.add('no-wrap');
            }
        });
        updateAllGutter();
    });

    showSearchBtn.addEventListener('click', () => {
        searchBar.classList.toggle('hidden');
        if (!searchBar.classList.contains('hidden')) {
            searchInput.focus();
        }
    });

    closeSearchBtn.addEventListener('click', () => {
        searchBar.classList.add('hidden');
    });

    btnReplace.addEventListener('click', () => handleReplace(false));
    btnReplaceAll.addEventListener('click', () => handleReplace(true));

    toggleConsoleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleConsole();
    });

    document.querySelector('.console-header').addEventListener('click', () => {
        toggleConsole();
    });

    clearConsoleBtn.addEventListener('click', () => {
        consoleOutput.innerHTML = '';
    });
}

function markDirty() {
    isDirty = true;
}

function updateCanvasControlVisibility() {
    const isCanvasMode = configMode.value === 'canvas';
    const hasSample = !!sampleSelect.value;
    showCanvasLabel.style.display = isCanvasMode ? 'flex' : 'none';
    if (isCanvasMode && hasSample) {
        showCanvasCheck.checked = true;
        rawCanvasContainer.classList.remove('hidden');
        if (engine) engine.requestRawBitmap = true;
    } else {
        showCanvasCheck.checked = false;
        rawCanvasContainer.classList.add('hidden');
        if (engine) engine.requestRawBitmap = false;
    }
}

function resetStudioUI(full = true) {
    if (full) {
        // 1. Metadata - Editor Language (metaLang)
        metaLang = currentLang;
        metaLangSelect.value = currentLang;
        metaData = {
            name: {},
            description: {}
        };
        metaName.value = '';
        metaAuthor.value = '';
        metaDesc.value = '';

        // Reset inputs
        inputVars.value = '';
        inputSetup.value = '';
        inputDraw.value = '';
        inputInteraction.value = '';
        updateAllHighlight();
        updateAllGutter();
    }

    // 2. Configuration
    configRewindable.checked = false;
    configIgnoreExclusion.checked = false;
    studioIgnoreExclusion = false;
    updateTapeControlState();
    updateCanvasControlVisibility();

    // 3. Preview
    // Reset Color
    const defaultColor = '#0056d2';
    currentPreviewColor = defaultColor;
    document.querySelectorAll('.color-preset').forEach(p => {
        const isDefault = p.style.backgroundColor === 'rgb(0, 86, 210)'; // #0056d2
        p.classList.toggle('active', isDefault);
    });
    if (currentState !== StudioState.STOPPED && engine) engine.color = defaultColor;

    // Reset Speed
    currentSpeed = 1.0;
    speedSlider.value = 1.0;
    speedValue.textContent = '1.0';

    // Reset Checkboxes
    showMetricsCheck.checked = true;
    metricsPanel.style.display = 'grid';
    showExclusionCheck.checked = true;
    exclusionSim.style.display = 'flex';

    // Reset Preview Height
    previewContainer.style.height = '150px';
    rawCanvasContainer.style.height = '150px';

    // Reset Simulator position/size
    exclusionSim.style.top = '40px';
    exclusionSim.style.left = '40px';
    exclusionSim.style.width = '120px';
    exclusionSim.style.height = '40px';

    // Reset Tape Counter
    virtualElapsedMs = 0;
    updateTapeCounter();

    if (engine) engine.resize();
    updateExclusionAreas();
}

function adjustPreviewHeight(delta) {
    const currentHeight = previewContainer.offsetHeight;
    const newHeight = Math.max(100, Math.min(600, currentHeight + delta));
    previewContainer.style.height = `${newHeight}px`;
    rawCanvasContainer.style.height = `${newHeight}px`;
    if (engine) engine.resize();
}

async function loadSample(id) {
    const anim = animations.find(a => a.id === id);
    if (!anim) return;

    // We need to fetch the file content to extract the logic
    try {
        const response = await fetch(`./js/animation/${id}.js`);
        const text = await response.text();
        parseAndPopulate(text, anim.metadata);
        updateCanvasControlVisibility();
        updateAllGutter();
        updateAllHighlight();
    } catch {
        console.error('Failed to load sample');
    }
}

function saveCurrentMetaData() {
    metaData.name[metaLang] = metaName.value;
    metaData.description[metaLang] = metaDesc.value;
}

function loadCurrentMetaData() {
    metaName.value = metaData.name[metaLang] || '';
    metaDesc.value = metaData.description[metaLang] || '';
}

function parseAndPopulate(code, metadata) {
    isDirty = false;
    metaData.name = typeof metadata.name === 'object' ? { ...metadata.name } : { en: metadata.name };
    metaData.description = typeof metadata.description === 'object' ? { ...metadata.description } : { en: metadata.description || '' };
    loadCurrentMetaData();

    metaAuthor.value = metadata.author || '';
    studioIgnoreExclusion = !!metadata.ignoreExclusion;

    // Extract config
    const modeMatch = code.match(/mode:\s*['"](canvas|matrix|sprite)['"]/);
    configMode.value = modeMatch ? modeMatch[1] : 'canvas';
    configPseudo.checked = /usePseudoSpace:\s*true/.test(code);
    configRewindable.checked = /rewindable:\s*true/.test(code);
    configIgnoreExclusion.checked = /ignoreExclusion:\s*true/.test(code);
    studioIgnoreExclusion = configIgnoreExclusion.checked;
    updateTapeControlState();

    // Find class body
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

    // Extract specific methods
    inputSetup.value = extractMethod(classContent, 'setup');
    inputDraw.value = extractMethod(classContent, 'draw');

    // Cleanup draw parameters if they still include width/height from old versions
    if (inputDraw.value) {
        inputDraw.value = inputDraw.value.replace(/draw\s*\(\s*ctx\s*,\s*\{\s*width\s*,\s*height\s*,\s*/, 'draw(ctx, { ');
        inputDraw.value = inputDraw.value.replace(/draw\s*\(\s*ctx\s*,\s*\{\s*width\s*,\s*height\s*\}\s*\)/, 'draw(ctx, params)');
    }

    const onClick = extractMethod(classContent, 'onClick');
    const onMouseMove = extractMethod(classContent, 'onMouseMove');
    inputInteraction.value = (onClick ? onClick + '\n\n' : '') + (onMouseMove ? onMouseMove : '');

    if (!inputSetup.value) inputSetup.value = 'setup(width, height) {\n  this.width = width;\n  this.height = height;\n}';
    if (!inputDraw.value) inputDraw.value = 'draw(ctx, { elapsedMs, progress, step, exclusionAreas }) {\n  \n}';
    if (!inputInteraction.value) inputInteraction.value = 'onClick(x, y) {\n  \n}\n\nonMouseMove(x, y) {\n  \n}';

    // Remove extracted parts from classContent to get variables/other members
    let vars = classContent;
    const toRemove = ['metadata', 'config', 'setup', 'draw', 'onClick', 'onMouseMove'];

    let ranges = [];
    toRemove.forEach(name => {
        const r = findRange(vars, name);
        if (r) ranges.push(r);
    });

    ranges.sort((a, b) => b.start - a.start);
    ranges.forEach(r => {
        vars = vars.substring(0, r.start) + vars.substring(r.end);
    });

    // Clean up empty semicolons and multiple newlines left behind
    vars = vars.replace(/^\s*;+/gm, '').replace(/;+\s*$/gm, '').replace(/\n\s*\n\s*\n/g, '\n\n');

    inputVars.value = vars.trim();
}

/**
 * Extracts a method body from class content.
 * @param {string} code
 * @param {string} name
 * @returns {string}
 */
function extractMethod(code, name) {
    const range = findRange(code, name);
    if (!range) return '';
    return deindent(code.substring(range.start, range.end)).trim();
}

function deindent(text) {
    const lines = text.split('\n');
    // Find minimum indentation (ignoring empty lines)
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
                        return { start: actualStart, end: i + 1 };
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

function getMsg(key) {
    return (messages[currentLang] && messages[currentLang][key]) || messages.en[key] || key;
}

function startTest() {
    currentState = StudioState.PLAYING;
    playBtn.classList.add('active');
    pauseBtn.classList.remove('active');

    // Disable inputs
    setInputDisabled(true);

    // Build the module code
    const fullCode = buildModuleCode();
    const blob = new Blob([fullCode], { type: 'application/javascript' });
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    workerUrl = URL.createObjectURL(blob);

    virtualElapsedMs = 0;
    lastFrameTime = performance.now();

    // Configure engine for testing
    engine.config = {
        mode: configMode.value,
        usePseudoSpace: configPseudo.checked,
        rewindable: configRewindable.checked
    };

    updateExclusionAreas();

    // We start the engine using the blob URL as module path
    // We need to pass a special ID to trigger blob loading in the engine's start method logic
    // But since the engine normally constructs the path, we'll patch it to use our blob.

    const originalStart = engine.start;
    const originalDraw = engine.draw;

    engine.draw = function() {
        if (currentState === StudioState.PAUSED || isScrubbing) return;

        const now = performance.now();
        if (currentState === StudioState.PLAYING) {
            const delta = (now - lastFrameTime) * currentSpeed;
            virtualElapsedMs += delta;
        }
        lastFrameTime = now;

        updateTapeCounter();
        _requestStudioDraw(virtualElapsedMs);
    };

    engine.start = function(name, startTime, color) {
        this.stop();
        this.activeAnimationId = 'test'; // Identifier
        this.startTime = startTime;
        this.color = color;
        this.initialized = false;
        this.perfViolations = 0;
        this.isMonitoring = true;
        this.isDrawPending = false;
        this.ignoreExclusion = studioIgnoreExclusion;
        this.requestRawBitmap = showCanvasCheck.checked;
        this.onRawBitmapDraw = (bitmap) => {
            const ctx = rawCanvas.getContext('2d');
            if (rawCanvas.width !== engine.canvas.width || rawCanvas.height !== engine.canvas.height) {
                rawCanvas.width = engine.canvas.width;
                rawCanvas.height = engine.canvas.height;
            }
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, bitmap.width, bitmap.height);
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
        };

        this.worker = new Worker(new URL('./animation_worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this._handleWorkerMessage(e);
        this.worker.postMessage({ type: 'init', payload: { modulePath: workerUrl } });
        this.worker.postMessage({ type: 'setSpeed', payload: 1.0 }); // Speed handled in virtual time
    };

    engine.start('test', Date.now(), currentPreviewColor);

    // Keep references to restore later if needed, though stopTest will handle it
    engine._originalStart = originalStart;
    engine._originalDraw = originalDraw;

    metricStatus.textContent = getMsg('status-running');
    metricStatus.style.color = '#4caf50';

    startMetricsCollection();
}

function stopTest() {
    currentState = StudioState.STOPPED;
    playBtn.classList.remove('active');
    pauseBtn.classList.remove('active');

    setInputDisabled(false);
    if (engine) {
        engine.stop();
        // Restore original methods
        if (engine._originalStart) engine.start = engine._originalStart;
        if (engine._originalDraw) engine.draw = engine._originalDraw;
    }

    // Clear raw canvas on stop
    const ctx = rawCanvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, rawCanvas.width, rawCanvas.height);

    metricStatus.textContent = getMsg('status-ready');
    metricStatus.style.color = 'inherit';
    stopMetricsCollection();
    resetMeters();
}

function pauseTest() {
    if (currentState !== StudioState.PLAYING) return;
    currentState = StudioState.PAUSED;
    pauseBtn.classList.add('active');
    playBtn.classList.remove('active');

    metricStatus.textContent = getMsg('status-paused');
    metricStatus.style.color = '#ffa000';
}

function resumeTest() {
    if (currentState !== StudioState.PAUSED && currentState !== StudioState.STOPPED) return;
    if (currentState === StudioState.STOPPED) {
        startTest();
        return;
    }
    currentState = StudioState.PLAYING;
    pauseBtn.classList.remove('active');
    playBtn.classList.add('active');
    lastFrameTime = performance.now();

    metricStatus.textContent = getMsg('status-running');
    metricStatus.style.color = '#4caf50';
}

/**
 * Scrubbing logic (Rewind / Fast Forward)
 * @param {number} direction -1 for rewind, 1 for fast forward
 */
async function scrub(direction) {
    if (currentState === StudioState.STOPPED || isScrubbing) return;
    if (direction === -1 && rewindBtn.disabled) return;

    isScrubbing = true;
    const originalState = currentState;
    const btn = direction === -1 ? rewindBtn : ffBtn;
    btn.classList.add('active');

    const interval = 10; // min interval 10ms
    const count = 10;
    const stepSize = 100 * currentSpeed; // 100ms per step

    for (let i = 0; i < count; i++) {
        // Handle stop during scrubbing
        if (currentState === StudioState.STOPPED) break;

        if (direction === -1) {
            virtualElapsedMs = Math.max(0, virtualElapsedMs - stepSize);
        } else {
            virtualElapsedMs += stepSize;
        }

        updateTapeCounter();

        // Ensure worker is ready (best effort)
        const startWait = performance.now();
        while (engine.isDrawPending && performance.now() - startWait < 50) {
            await new Promise(r => setTimeout(r, 2));
        }

        _requestStudioDraw(virtualElapsedMs);
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    btn.classList.remove('active');
    isScrubbing = false;

    // Restore state if not stopped
    if (currentState !== StudioState.STOPPED) {
        if (originalState === StudioState.PLAYING) {
            lastFrameTime = performance.now();
        }
    }
}

/**
 * Shared drawing request logic for Studio test mode
 */
function _requestStudioDraw(elapsed) {
    if (!engine || !engine.worker || !engine.initialized || engine.isDrawPending) return;

    const progress = (elapsed % engine.cycleMs) / engine.cycleMs;
    let drawWidth = engine.canvas.width;
    if (engine.config.usePseudoSpace) {
        drawWidth = engine._getPseudoInfo().totalWidth;
    }

    const params = {
        width: drawWidth,
        height: engine.canvas.height,
        canvasWidth: engine.canvas.width,
        elapsedMs: elapsed,
        progress,
        step: Math.floor(progress * 240),
        exclusionAreas: engine.ignoreExclusion ? [] : engine._getVirtualExclusionAreas(),
        realExclusionAreas: engine.ignoreExclusion ? [] : engine.exclusionAreas,
        requestRawBitmap: engine.requestRawBitmap
    };

    engine.lastDrawRequestTime = performance.now();
    engine.isDrawPending = true;
    engine.worker.postMessage({ type: 'draw', payload: params });
}

function updateTapeCounter() {
    const totalSeconds = Math.floor(virtualElapsedMs / 1000);
    // Use 4 digits for a "mechanical" look as requested
    tapeCounterEl.textContent = String(totalSeconds % 10000).padStart(4, '0');
}

function updateTapeControlState() {
    rewindBtn.disabled = !configRewindable.checked;
}

function setInputDisabled(disabled) {
    [metaName, metaAuthor, metaDesc, configMode, configPseudo, configRewindable, inputVars, inputSetup, inputDraw, inputInteraction, sampleSelect].forEach(el => {
        el.disabled = disabled;
    });
}

function buildModuleCode() {
    const baseUrl = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
    const animationBaseUrl = `${baseUrl}/js/animation_base.js`;

    const escapeJSString = (str) => {
        return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    };

    const indentCode = (code, spaces) => {
        if (!code || !code.trim()) return '';
        return code.split('\n').map(line => ' '.repeat(spaces) + line).join('\n').trimStart();
    };

    saveCurrentMetaData();

    return `import { AnimationBase } from '${animationBaseUrl}';

export default class CustomAnimation extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: ${JSON.stringify(metaData.name, null, 8).trimStart()},
        description: ${JSON.stringify(metaData.description, null, 8).trimStart()},
        author: "${escapeJSString(metaAuthor.value)}"
    };

    config = {
        mode: '${configMode.value}',
        usePseudoSpace: ${configPseudo.checked},
        rewindable: ${configRewindable.checked},
        ignoreExclusion: ${configIgnoreExclusion.checked}
    };

    ${indentCode(inputVars.value, 4)}

    ${indentCode(inputSetup.value, 4)}

    ${indentCode(inputDraw.value, 4)}

    ${indentCode(inputInteraction.value, 4)}
}`;
}

function downloadAnimation() {
    let code = buildModuleCode();
    // For final download, replace the absolute URL back to relative if it was for testing
    code = code.replace(/import\s*{\s*AnimationBase\s*}\s*from\s*['"].*\/js\/animation_base\.js['"]/, "import { AnimationBase } from '../animation_base.js'");
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metaName.value.toLowerCase().replace(/\s+/g, '_') || 'animation'}.js`;
    a.click();
    URL.revokeObjectURL(url);
    isDirty = false;
    showToast(getMsg('toast-downloaded-js'));
}

function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target.result;
        if (file.name.endsWith('.json')) {
            try {
                const data = JSON.parse(content);
                // Populate fields from JSON
                metaData.name = typeof data.name === 'object' ? { ...data.name } : { en: data.name || '' };
                metaData.description = typeof data.description === 'object' ? { ...data.description } : { en: data.description || '' };
                loadCurrentMetaData();
                metaAuthor.value = data.author || '';
                configMode.value = data.mode || 'canvas';
                configPseudo.checked = !!data.usePseudoSpace;
                configRewindable.checked = !!data.rewindable;
                configIgnoreExclusion.checked = !!data.ignoreExclusion;
                studioIgnoreExclusion = configIgnoreExclusion.checked;
                updateTapeControlState();
                inputVars.value = data.vars || '';
                inputSetup.value = data.setup || '';
                inputDraw.value = data.draw || '';
                inputInteraction.value = data.interaction || '';
                isDirty = false;
                showToast(getMsg('toast-loaded-json'));
                updateAllHighlight();
                updateAllGutter();
            } catch {
                showToast(getMsg('toast-invalid-json'));
            }
        } else if (file.name.endsWith('.js')) {
            parseAndPopulate(content, { name: 'Imported', description: '', author: '' });
            isDirty = false;
            showToast(getMsg('toast-loaded-js'));
            updateAllHighlight();
            updateAllGutter();
        }
    };
    reader.readAsText(file);
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Metrics Collection
let metricsInterval = null;
let lastImageData = null;
let lastLatency = 0;

function startMetricsCollection() {
    lastImageData = null;

    // Patch engine to track latency and errors
    if (!engine._handleWorkerMessage._isPatched) {
        const original = engine._handleWorkerMessage;
        engine._handleWorkerMessage = function(e) {
            if (e.data.type === 'drawResponse') {
                lastLatency = performance.now() - engine.lastDrawRequestTime;
            } else if (e.data.type === 'error') {
                appendConsole(e.data.payload, 'error');
                showConsole();
                stopTest();
            } else if (e.data.type === 'log') {
                appendConsole(e.data.payload, e.data.level || 'info');
            }
            original.call(engine, e);
        };
        engine._handleWorkerMessage._original = original;
        engine._handleWorkerMessage._isPatched = true;
    }

    metricsInterval = setInterval(() => {
        if (!engine || !engine.canvas) return;

        const ctx = engine.canvas.getContext('2d');
        const width = engine.canvas.width;
        const height = engine.canvas.height;
        if (width === 0 || height === 0) return;

        const imgDataObj = ctx.getImageData(0, 0, width, height);
        const imgData = imgDataObj.data;
        let nonZero = 0;
        let changed = 0;

        for (let i = 0; i < imgData.length; i += 4) {
            const isNonZero = imgData[i] + imgData[i+1] + imgData[i+2] > 0;
            if (isNonZero) nonZero++;

            if (lastImageData) {
                if (imgData[i] !== lastImageData[i] ||
                    imgData[i+1] !== lastImageData[i+1] ||
                    imgData[i+2] !== lastImageData[i+2]) {
                    changed++;
                }
            }
        }

        const density = (nonZero / (width * height)) * 100;
        metricDensity.textContent = `${density.toFixed(1)} %`;
        updateMeter(needleDensity, density, 100);

        if (lastImageData) {
            const changeRate = (changed / (width * height)) * 100;
            metricChange.textContent = `${changeRate.toFixed(1)} %`;
            updateMeter(needleChange, changeRate, 50); // 50% as max for change rate scaling
        }
        lastImageData = imgData;

        metricLatency.textContent = `${lastLatency.toFixed(1)} ms`;
        updateMeter(needleLatency, lastLatency, 100); // 100ms as max for meter scaling

        if (lastLatency > 50) {
            metricLatency.style.color = '#f44336';
        } else if (lastLatency > 16) {
            metricLatency.style.color = '#ff9800';
        } else {
            metricLatency.style.color = '#4caf50';
        }

    }, 1000);
}

function stopMetricsCollection() {
    clearInterval(metricsInterval);
}

function updateMeter(needle, value, max) {
    if (!needle) return;
    // Map 0 -> max to -45deg -> +45deg (based on user request)
    const percent = Math.min(1, value / max);
    const angle = -45 + (percent * 90);
    needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
}

function resetMeters() {
    [needleLatency, needleDensity, needleChange].forEach(needle => {
        if (needle) needle.style.transform = 'translateX(-50%) rotate(-45deg)';
    });
    metricLatency.textContent = '-- ms';
    metricDensity.textContent = '-- %';
    metricChange.textContent = '-- %';
}

// Draggable Resizable Exclusion Simulator
function setupDraggableResizable() {
    let isDragging = false;
    let isResizing = false;
    let currentResizer = null;
    let startX, startY, startLeft, startTop, startWidth, startHeight;

    exclusionSim.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resizer')) {
            isResizing = true;
            currentResizer = e.target;
        } else {
            isDragging = true;
        }
        startX = e.clientX;
        startY = e.clientY;
        startLeft = exclusionSim.offsetLeft;
        startTop = exclusionSim.offsetTop;
        startWidth = exclusionSim.offsetWidth;
        startHeight = exclusionSim.offsetHeight;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            exclusionSim.style.left = `${startLeft + dx}px`;
            exclusionSim.style.top = `${startTop + dy}px`;
            updateExclusionAreas();
        } else if (isResizing) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (currentResizer.classList.contains('se')) {
                exclusionSim.style.width = `${startWidth + dx}px`;
                exclusionSim.style.height = `${startHeight + dy}px`;
            } else if (currentResizer.classList.contains('sw')) {
                exclusionSim.style.width = `${startWidth - dx}px`;
                exclusionSim.style.left = `${startLeft + dx}px`;
                exclusionSim.style.height = `${startHeight + dy}px`;
            } else if (currentResizer.classList.contains('ne')) {
                exclusionSim.style.width = `${startWidth + dx}px`;
                exclusionSim.style.height = `${startHeight - dy}px`;
                exclusionSim.style.top = `${startTop + dy}px`;
            } else if (currentResizer.classList.contains('nw')) {
                exclusionSim.style.width = `${startWidth - dx}px`;
                exclusionSim.style.left = `${startLeft + dx}px`;
                exclusionSim.style.height = `${startHeight - dy}px`;
                exclusionSim.style.top = `${startTop + dy}px`;
            }
            updateExclusionAreas();
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        currentResizer = null;
    });
}

function updateExclusionAreas() {
    if (!engine) return;

    if (rawCanvas.width !== engine.canvas.width || rawCanvas.height !== engine.canvas.height) {
        rawCanvas.width = engine.canvas.width;
        rawCanvas.height = engine.canvas.height;
    }

    if (showExclusionCheck.checked) {
        const rect = exclusionSim.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();

        const area = {
            x: rect.left - canvasRect.left,
            y: rect.top - canvasRect.top,
            width: rect.width,
            height: rect.height
        };
        engine.setExclusionAreas([area]);
    } else {
        engine.setExclusionAreas([]);
    }

    if (currentState !== StudioState.STOPPED && engine.initialized) {
        // Just trigger a resize to update worker state without full restart
        engine.resize();
    }
}

// Editor Enhancements
function setupEditorEnhancements() {
    const textareas = [inputVars, inputSetup, inputDraw, inputInteraction];
    textareas.forEach(ta => {
        ta.addEventListener('keydown', (e) => handleKeyDown(e, ta));
    });
}

function handleKeyDown(e, ta) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 2;
        updateHighlight(ta);
    } else if (e.key === 'Enter') {
        // Auto-indent
        const start = ta.selectionStart;
        const line = ta.value.substring(0, start).split('\n').pop();
        const match = line.match(/^\s*/);
        if (match && match[0].length > 0) {
            e.preventDefault();
            const indent = '\n' + match[0];
            ta.value = ta.value.substring(0, start) + indent + ta.value.substring(start);
            ta.selectionStart = ta.selectionEnd = start + indent.length;
            updateHighlight(ta);
            updateGutter(ta);
        }
    } else if (['{', '[', '(', '"', "'"].includes(e.key)) {
        // Auto-complete
        const pairs = { '{': '}', '[': ']', '(': ')', '"': '"', "'": "'" };
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        if (start === end) {
            e.preventDefault();
            ta.value = ta.value.substring(0, start) + e.key + pairs[e.key] + ta.value.substring(end);
            ta.selectionStart = ta.selectionEnd = start + 1;
            updateHighlight(ta);
        }
    }
}

function updateHighlight(ta) {
    const highlightEl = ta.parentElement.querySelector('.editor-highlight');
    if (!highlightEl) return;

    const code = ta.value;
    const lines = code.split('\n');

    const rules = [
        { regex: /\/\/.*/g, class: 'hl-comment' },
        { regex: /\/\*[\s\S]*?\*\//g, class: 'hl-comment' },
        { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, class: 'hl-string' },
        { regex: /\b(class|extends|export|default|static|this|new|if|else|for|while|return|function|let|const|var|async|await|try|catch|finally|throw)\b/g, class: 'hl-keyword' },
        { regex: /\b\d+\b/g, class: 'hl-number' },
        { regex: /\b(\w+)(?=\s*\()/g, class: 'hl-function' },
        { regex: /[{}[\]()]/g, class: 'hl-bracket' }
    ];

    const processedLines = lines.map(line => {
        let escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const tokens = [];

        rules.forEach((rule, idx) => {
            escaped = escaped.replace(rule.regex, (match) => {
                const id = `__TOKEN_${idx}_${tokens.length}__`;
                tokens.push({ id, html: `<span class="${rule.class}">${match}</span>` });
                return id;
            });
        });

        tokens.forEach(token => {
            escaped = escaped.replace(token.id, token.html);
        });

        return `<div class="logical-line">${escaped || ' '}</div>`;
    });

    highlightEl.innerHTML = processedLines.join('');
}

function updateGutter(ta) {
    const gutter = ta.closest('.editor-body').querySelector('.editor-gutter');
    if (!gutter) return;

    gutter.innerHTML = '';

    // To support word wrap, we need to ensure each gutter line matches the height of the editor line.
    const highlight = ta.parentElement.querySelector('.editor-highlight');

    // Ensure highlight is up to date before measuring
    updateHighlight(ta);

    const logicalLines = highlight.querySelectorAll('.logical-line');
    logicalLines.forEach((lineEl, idx) => {
        const numDiv = document.createElement('div');
        numDiv.textContent = idx + 1;
        numDiv.style.height = `${lineEl.offsetHeight}px`;
        numDiv.style.lineHeight = `${lineEl.offsetHeight}px`;
        numDiv.style.display = 'flex';
        numDiv.style.alignItems = 'flex-start';
        numDiv.style.justifyContent = 'flex-end';
        gutter.appendChild(numDiv);
    });
}

function syncScroll(ta) {
    const wrapper = ta.parentElement;
    const highlight = wrapper.querySelector('.editor-highlight');
    const gutter = ta.closest('.editor-body').querySelector('.editor-gutter');

    if (highlight) {
        highlight.scrollTop = ta.scrollTop;
        highlight.scrollLeft = ta.scrollLeft;
    }
    if (gutter) {
        gutter.scrollTop = ta.scrollTop;
    }
}

function updateAllHighlight() {
    [inputVars, inputSetup, inputDraw, inputInteraction].forEach(ta => updateHighlight(ta));
}

function updateAllGutter() {
    [inputVars, inputSetup, inputDraw, inputInteraction].forEach(ta => updateGutter(ta));
}

function handleReplace(all) {
    const activeTab = document.querySelector('.code-tab.active');
    const targetId = activeTab.getAttribute('data-target');
    const ta = document.getElementById(targetId).querySelector('textarea');
    if (!ta) return;

    const search = searchInput.value;
    const replace = replaceInput.value;
    if (!search) return;

    const code = ta.value;
    if (all) {
        ta.value = code.split(search).join(replace);
    } else {
        ta.value = code.replace(search, replace);
    }
    updateHighlight(ta);
    updateGutter(ta);
    markDirty();
}

function appendConsole(msg, type = '') {
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;

    // Auto-open on error
    if (type === 'error') {
        showConsole();
    }
}

function toggleConsole() {
    consoleSection.classList.toggle('collapsed');
    const isCollapsed = consoleSection.classList.contains('collapsed');
    toggleConsoleBtn.querySelector('span').textContent = isCollapsed ? 'expand_less' : 'expand_more';
}

function showConsole() {
    consoleSection.classList.remove('collapsed');
    toggleConsoleBtn.querySelector('span').textContent = 'expand_more';
}

init();
