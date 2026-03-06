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
let isTesting = false;
let isDirty = false;
let startTime = 0;
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
const testBtn = document.getElementById('test-btn');
const downloadBtn = document.getElementById('download-btn');
const uploadBtn = document.getElementById('upload-btn');
const uploadInput = document.getElementById('studio-upload-input');
const prBtn = document.getElementById('pr-btn');
const prModal = document.getElementById('pr-modal');
const closePrBtn = document.querySelector('.close-modal-btn');
const closePrX = document.querySelector('#pr-modal .close-btn');

const inputVars = document.getElementById('input-vars');
const inputSetup = document.getElementById('input-setup');
const inputDraw = document.getElementById('input-draw');
const inputInteraction = document.getElementById('input-interaction');

const metaName = document.getElementById('meta-name');
const metaAuthor = document.getElementById('meta-author');
const metaDesc = document.getElementById('meta-desc');
const configMode = document.getElementById('config-mode');
const configPseudo = document.getElementById('config-pseudo');

const canvas = document.getElementById('animation-canvas');
const exclusionSim = document.getElementById('exclusion-simulator');
const metricsPanel = document.getElementById('metrics-panel');
const showMetricsCheck = document.getElementById('show-metrics');
const showExclusionCheck = document.getElementById('show-exclusion');
const shrinkPreviewBtn = document.getElementById('shrink-preview');
const expandPreviewBtn = document.getElementById('expand-preview');
const previewContainer = document.getElementById('preview-container');
const colorPresetsContainer = document.getElementById('preview-color-presets');
const speedSlider = document.getElementById('preview-speed');
const speedValue = document.getElementById('speed-value');

const metricLatency = document.getElementById('metric-latency');
const metricDensity = document.getElementById('metric-density');
const metricChange = document.getElementById('metric-change');
const metricStatus = document.getElementById('metric-status');

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
    applyTheme();
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
        } else if (messages.en[key]) {
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
            if (isTesting && engine) {
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
    configMode.addEventListener('change', markDirty);
    configPseudo.addEventListener('change', markDirty);

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

    testBtn.addEventListener('click', toggleTest);
    downloadBtn.addEventListener('click', downloadAnimation);
    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', handleUpload);
    prBtn.addEventListener('click', () => prModal.classList.remove('hidden'));
    [closePrBtn, closePrX].forEach(btn => btn.addEventListener('click', () => prModal.classList.add('hidden')));

    showMetricsCheck.addEventListener('change', (e) => {
        metricsPanel.style.display = e.target.checked ? 'grid' : 'none';
    });

    showExclusionCheck.addEventListener('change', (e) => {
        exclusionSim.style.display = e.target.checked ? 'flex' : 'none';
        updateExclusionAreas();
    });

    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    window.addEventListener('resize', () => {
        if (engine) engine.resize();
        updateAllGutter();
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
        if (isTesting && engine && engine.worker) {
            engine.worker.postMessage({ type: 'setSpeed', payload: currentSpeed });
        }
    });

    toggleWrapBtn.addEventListener('click', () => {
        isWordWrap = !isWordWrap;
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

    toggleConsoleBtn.addEventListener('click', () => {
        consoleSection.classList.toggle('collapsed');
        toggleConsoleBtn.querySelector('span').textContent = consoleSection.classList.contains('collapsed') ? 'expand_more' : 'expand_less';
    });

    clearConsoleBtn.addEventListener('click', () => {
        consoleOutput.innerHTML = '';
    });
}

function markDirty() {
    isDirty = true;
}

function adjustPreviewHeight(delta) {
    const currentHeight = previewContainer.offsetHeight;
    const newHeight = Math.max(100, Math.min(600, currentHeight + delta));
    previewContainer.style.height = `${newHeight}px`;
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

    // Extract config
    const modeMatch = code.match(/mode:\s*['"](canvas|matrix|sprite)['"]/);
    configMode.value = modeMatch ? modeMatch[1] : 'canvas';
    configPseudo.checked = /usePseudoSpace:\s*true/.test(code);

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

    const onClick = extractMethod(classContent, 'onClick');
    const onMouseMove = extractMethod(classContent, 'onMouseMove');
    inputInteraction.value = (onClick ? onClick + '\n\n' : '') + (onMouseMove ? onMouseMove : '');

    if (!inputSetup.value) inputSetup.value = 'setup(width, height) {\n  \n}';
    if (!inputDraw.value) inputDraw.value = 'draw(ctx, params) {\n  \n}';
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
    const regex = new RegExp(`(?:^|\\s)(static\\s+)?${namePattern}\\b`, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
        let actualStart = match.index;
        if (/\s/.test(text[match.index])) actualStart++;
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

function toggleTest() {
    if (isTesting) {
        stopTest();
    } else {
        startTest();
    }
}

function getMsg(key) {
    return (messages[currentLang] && messages[currentLang][key]) || messages.en[key] || key;
}

function startTest() {
    isTesting = true;
    testBtn.innerHTML = `<span class="material-symbols-outlined">stop</span> <span>${getMsg('btn-stop-test')}</span>`;
    testBtn.classList.replace('primary-btn', 'danger-btn');

    // Disable inputs
    setInputDisabled(true);

    // Build the module code
    const fullCode = buildModuleCode();
    const blob = new Blob([fullCode], { type: 'application/javascript' });
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    workerUrl = URL.createObjectURL(blob);

    // Inject custom worker URL to handle blob imports if necessary
    // Actually, the current engine imports modulePath. Blob URLs work with dynamic import().

    startTime = Date.now();
    engine.stop();

    // We need to override the engine's internal module path logic for this test
    engine.start = function(name, startTime, color) {
        this.stop();
        this.activeAnimationId = 'test';
        this.startTime = startTime;
        this.color = color;
        this.initialized = false;
        this.config = {
            mode: configMode.value,
            usePseudoSpace: configPseudo.checked
        };

        // Use custom worker that can handle the blob URL
        this.worker = new Worker(new URL('./animation_worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this._handleWorkerMessage(e);
        this.worker.postMessage({ type: 'init', payload: { modulePath: workerUrl } });
        this.worker.postMessage({ type: 'setSpeed', payload: currentSpeed });
    };

    updateExclusionAreas();
    engine.start('test', startTime, currentPreviewColor);

    metricStatus.textContent = getMsg('status-running');
    metricStatus.style.color = '#4caf50';

    startMetricsCollection();
}

function stopTest() {
    isTesting = false;
    testBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span> <span data-i18n="btn-test">Test Animation</span>';
    testBtn.classList.replace('danger-btn', 'primary-btn');
    updateTranslations();

    setInputDisabled(false);
    engine.stop();

    metricStatus.textContent = getMsg('status-ready');
    metricStatus.style.color = 'inherit';
    stopMetricsCollection();
}

function setInputDisabled(disabled) {
    [metaName, metaAuthor, metaDesc, configMode, configPseudo, inputVars, inputSetup, inputDraw, inputInteraction, sampleSelect].forEach(el => {
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
        usePseudoSpace: ${configPseudo.checked}
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
                lastLatency = performance.now() - this.lastDrawRequestTime;
            } else if (e.data.type === 'error') {
                appendConsole(e.data.payload, 'error');
                showConsole();
                stopTest();
            } else if (e.data.type === 'log') {
                appendConsole(e.data.payload, e.data.level || 'info');
            }
            original.call(this, e);
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

        if (lastImageData) {
            const changeRate = (changed / (width * height)) * 100;
            metricChange.textContent = `${changeRate.toFixed(1)} %`;
        }
        lastImageData = imgData;

        metricLatency.textContent = `${lastLatency.toFixed(1)} ms`;
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

    if (engine.initialized) {
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

    let code = ta.value;

    // Simple regex highlighting
    const rules = [
        { regex: /\/\/.*/g, class: 'hl-comment' },
        { regex: /\/\*[\s\S]*?\*\//g, class: 'hl-comment' },
        { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, class: 'hl-string' },
        { regex: /\b(class|extends|export|default|static|this|new|if|else|for|while|return|function|let|const|var|async|await|try|catch|finally|throw)\b/g, class: 'hl-keyword' },
        { regex: /\b\d+\b/g, class: 'hl-number' },
        { regex: /\b(\w+)(?=\s*\()/g, class: 'hl-function' },
        { regex: /[{}[\]()]/g, class: 'hl-bracket' }
    ];

    // To avoid overlapping, we process and escape
    let escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // This is a naive implementation, but avoids external libs
    // We'll use placeholders to avoid re-highlighting
    const tokens = [];
    let processed = escapedCode;

    rules.forEach((rule, idx) => {
        processed = processed.replace(rule.regex, (match) => {
            const id = `__TOKEN_${idx}_${tokens.length}__`;
            tokens.push({ id, html: `<span class="${rule.class}">${match}</span>` });
            return id;
        });
    });

    tokens.forEach(token => {
        processed = processed.replace(token.id, token.html);
    });

    highlightEl.innerHTML = processed + (code.endsWith('\n') ? ' ' : '');
}

function updateGutter(ta) {
    const gutter = ta.closest('.editor-body').querySelector('.editor-gutter');
    if (!gutter) return;

    const lines = ta.value.split('\n');
    // Calculate actual visual lines if word wrap is on
    // But for simplicity, we'll just use line numbers for now.
    // If we want to be precise with word wrap, we need to calculate line heights.

    let gutterHTML = '';
    for (let i = 1; i <= lines.length; i++) {
        gutterHTML += `<div>${i}</div>`;
    }
    gutter.innerHTML = gutterHTML;
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

function showConsole() {
    consoleSection.classList.remove('collapsed');
    toggleConsoleBtn.querySelector('span').textContent = 'expand_less';
}

init();
