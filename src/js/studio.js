/**
 * QuickLog Anim Studio Logic
 */

import { animations } from './animation_registry.js';
import { AnimationEngine } from './animations.js';
import { messages } from './messages.js';

let currentLang = 'en';
let engine = null;
let isTesting = false;
let startTime = 0;
let workerUrl = null;

// DOM Elements
const sampleSelect = document.getElementById('sample-select');
const langSelect = document.getElementById('lang-select-studio');
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

const metricLatency = document.getElementById('metric-latency');
const metricDensity = document.getElementById('metric-density');
const metricChange = document.getElementById('metric-change');
const metricStatus = document.getElementById('metric-status');

// Initialize
function init() {
    setupLanguage();
    setupEngine();
    populateSamples();
    setupEventListeners();
    setupDraggableResizable();

    // Set default sample
    const heroPot = animations.find(a => a.id === 'hero_pot');
    if (heroPot) {
        loadSample('hero_pot');
        sampleSelect.value = 'hero_pot';
    }
}

function setupLanguage() {
    const userLang = navigator.language || navigator.userLanguage;
    const prefixes = ['ja', 'de', 'es', 'fr', 'pt', 'ko', 'zh'];
    let matched = 'en';
    for (const prefix of prefixes) {
        if (userLang.startsWith(prefix)) {
            matched = prefix;
            break;
        }
    }
    currentLang = matched;
    langSelect.value = matched;
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

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (messages[currentLang] && messages[currentLang][key]) {
            el.title = messages[currentLang][key];
        }
    });
}

function setupEngine() {
    engine = new AnimationEngine(canvas);
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
            document.getElementById(tab.getAttribute('data-target')).classList.add('active');
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

    window.addEventListener('beforeunload', (e) => {
        if (!isTesting) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    window.addEventListener('resize', () => {
        if (engine) engine.resize();
    });
}

async function loadSample(id) {
    const anim = animations.find(a => a.id === id);
    if (!anim) return;

    // We need to fetch the file content to extract the logic
    try {
        const response = await fetch(`./js/animation/${id}.js`);
        const text = await response.text();
        parseAndPopulate(text, anim.metadata);
    } catch {
        console.error('Failed to load sample');
    }
}

function parseAndPopulate(code, metadata) {
    // Basic regex-based parsing (simplified)
    metaName.value = typeof metadata.name === 'object' ? metadata.name.en : metadata.name;
    metaAuthor.value = metadata.author || '';
    metaDesc.value = typeof metadata.description === 'object' ? metadata.description.en : (metadata.description || '');

    // Extract config
    const modeMatch = code.match(/mode:\s*['"](canvas|matrix|sprite)['"]/);
    configMode.value = modeMatch ? modeMatch[1] : 'canvas';
    configPseudo.checked = /usePseudoSpace:\s*true/.test(code);

    // Extract methods
    inputSetup.value = extractMethod(code, 'setup');
    inputDraw.value = extractMethod(code, 'draw');

    const onClick = extractMethod(code, 'onClick');
    const onMouseMove = extractMethod(code, 'onMouseMove');
    inputInteraction.value = (onClick ? `onClick(x, y) {\n${onClick}\n}\n\n` : '') +
                             (onMouseMove ? `onMouseMove(x, y) {\n${onMouseMove}\n}` : '');
    if (inputInteraction.value === '') {
        inputInteraction.value = 'onClick(x, y) {\n  \n}\n\nonMouseMove(x, y) {\n  \n}';
    }

    // Extract variables (everything inside class but outside methods and metadata)
    const classMatch = code.match(/export\s+default\s+class\s+\w+\s+extends\s+AnimationBase\s*\{/);
    if (!classMatch) return;

    let pos = classMatch.index + classMatch[0].length;
    let classContent = "";
    let braceCount = 1;
    while (braceCount > 0 && pos < code.length) {
        if (code[pos] === '{') braceCount++;
        else if (code[pos] === '}') braceCount--;
        if (braceCount > 0) classContent += code[pos];
        pos++;
    }

    let vars = classContent;
    const toRemove = ['static\\s+metadata', 'config', 'constructor', 'setup', 'draw', 'onClick', 'onMouseMove'];

    let changed = true;
    while (changed) {
        changed = false;
        for (const name of toRemove) {
            const range = findRange(vars, name);
            if (range) {
                vars = vars.substring(0, range.start) + vars.substring(range.end);
                changed = true;
                break;
            }
        }
    }

    inputVars.value = vars.trim();
}

function extractMethod(code, name) {
    const range = findRange(code, name);
    if (!range || range.bodyStart === undefined) return '';

    // Extract body content between the identified braces
    let body = code.substring(range.bodyStart + 1, range.end);
    let lastBrace = body.lastIndexOf('}');
    if (lastBrace !== -1) {
        body = body.substring(0, lastBrace);
    }
    return body.trim();
}

function findRange(text, namePattern) {
    const regex = new RegExp(`\\b${namePattern}\\b\\s*[=(]`, 'g');
    let match;
    let found = null;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > 0 && text[match.index - 1] === '.') continue;
        found = match;
        break;
    }
    if (!found) return null;

    let start = found.index;
    let pos = found.index + found[0].length;
    let bodyStart;

    if (found[0].endsWith('(')) {
        let pCount = 1;
        while (pCount > 0 && pos < text.length) {
            if (text[pos] === '(') pCount++;
            else if (text[pos] === ')') pCount--;
            pos++;
        }
    }

    while (pos < text.length && text[pos] !== '{' && text[pos] !== ';') {
        pos++;
    }
    if (pos >= text.length) return null;

    if (text[pos] === '{') {
        bodyStart = pos;
        let bCount = 1;
        pos++;
        while (bCount > 0 && pos < text.length) {
            if (text[pos] === '{') bCount++;
            else if (text[pos] === '}') bCount--;
            pos++;
        }
        if (pos < text.length && text[pos] === ';') pos++;
    } else {
        pos++;
    }

    return { start, end: pos, bodyStart };
}

function toggleTest() {
    if (isTesting) {
        stopTest();
    } else {
        startTest();
    }
}

function startTest() {
    isTesting = true;
    testBtn.innerHTML = '<span class="material-symbols-outlined">stop</span> <span>Stop Test</span>';
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
    };

    updateExclusionAreas();
    engine.start('test', startTime, '#1976d2');

    metricStatus.textContent = 'Running';
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

    metricStatus.textContent = 'Ready';
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

    return `
import { AnimationBase } from '${animationBaseUrl}';

export default class CustomAnimation extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: "${escapeJSString(metaName.value)}",
        description: "${escapeJSString(metaDesc.value)}",
        author: "${escapeJSString(metaAuthor.value)}"
    };

    config = {
        mode: '${configMode.value}',
        usePseudoSpace: ${configPseudo.checked}
    };

    ${inputVars.value}

    setup(width, height) {
        ${inputSetup.value}
    }

    draw(ctx, params) {
        ${inputDraw.value}
    }

    ${inputInteraction.value}
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
    showToast('Downloaded JS file');
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
                metaName.value = data.name || '';
                metaAuthor.value = data.author || '';
                metaDesc.value = data.description || '';
                configMode.value = data.mode || 'canvas';
                configPseudo.checked = !!data.usePseudoSpace;
                inputVars.value = data.vars || '';
                inputSetup.value = data.setup || '';
                inputDraw.value = data.draw || '';
                inputInteraction.value = data.interaction || '';
                showToast('Loaded from JSON');
            } catch {
                showToast('Invalid JSON');
            }
        } else if (file.name.endsWith('.js')) {
            parseAndPopulate(content, { name: 'Imported', description: '', author: '' });
            showToast('Loaded from JS');
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
                showToast('Animation Error: ' + e.data.payload);
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
    // Restore original engine method
    if (engine && engine._handleWorkerMessage && engine._handleWorkerMessage._original) {
        // This is a bit tricky since we didn't save it properly.
        // Actually, just resetting it in stopTest is better if we want to be clean.
    }
}

// Draggable Resizable Exclusion Simulator
function setupDraggableResizable() {
    let isDragging = false;
    let isResizing = false;
    let currentResizer = null;
    let startX, startY, startLeft, startTop, startWidth, startHeight;

    window.addEventListener('beforeunload', (e) => {
        if (inputDraw.value.length > 10) { // Simple heuristic
            e.preventDefault();
            e.returnValue = '';
        }
    });

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
    const rect = exclusionSim.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const area = {
        x: rect.left - canvasRect.left,
        y: rect.top - canvasRect.top,
        width: rect.width,
        height: rect.height
    };
    engine.setExclusionAreas([area]);
}

init();
