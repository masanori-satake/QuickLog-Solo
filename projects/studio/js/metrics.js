/**
 * QL-Animation Studio - Metrics Module
 */

export function initMetrics(state, elements) {
    const {
        metricsPanel, showMetricsCheck, metricLatency, metricDensity,
        metricChange, needleLatency, needleDensity,
        needleChange, consoleSection, consoleOutput, clearConsoleBtn,
        toggleConsoleBtn, tapeCounterEl
    } = elements;

    let metricsInterval = null;
    let lastImageData = null;
    let lastLatency = 0;

    function updateMeter(needle, value, max) {
        if (!needle) return;
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

    function appendConsole(msg, type = '') {
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;

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

    function startMetricsCollection(engine) {
        lastImageData = null;

        if (!engine._handleWorkerMessage._isPatched) {
            const original = engine._handleWorkerMessage;
            engine._handleWorkerMessage = function(e) {
                if (e.data.type === 'drawResponse') {
                    lastLatency = performance.now() - engine.lastDrawRequestTime;
                } else if (e.data.type === 'error') {
                    appendConsole(e.data.payload, 'error');
                    showConsole();
                    if (state.stopTest) state.stopTest();
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
                updateMeter(needleChange, changeRate, 50);
            }
            lastImageData = imgData;

            metricLatency.textContent = `${lastLatency.toFixed(1)} ms`;
            updateMeter(needleLatency, lastLatency, 100);

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

    function updateTapeCounter(virtualElapsedMs) {
        const totalSeconds = Math.floor(virtualElapsedMs / 1000);
        tapeCounterEl.textContent = String(totalSeconds % 10000).padStart(4, '0');
    }

    // Event Listeners
    showMetricsCheck.addEventListener('change', (e) => {
        metricsPanel.style.display = e.target.checked ? 'grid' : 'none';
    });

    clearConsoleBtn.addEventListener('click', () => {
        consoleOutput.innerHTML = '';
    });

    toggleConsoleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleConsole();
    });

    consoleSection.querySelector('.console-header').addEventListener('click', () => {
        toggleConsole();
    });

    return {
        startMetricsCollection,
        stopMetricsCollection,
        resetMeters,
        updateTapeCounter,
        appendConsole,
        showConsole
    };
}
