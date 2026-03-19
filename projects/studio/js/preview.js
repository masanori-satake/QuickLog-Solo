/**
 * QL-Animation Studio - Preview Module
 */

export function initPreview(state, elements) {
    const {
        canvas, exclusionSim, showExclusionCheck, showCanvasCheck,
        rawCanvasContainer, rawCanvas, shrinkPreviewBtn, expandPreviewBtn,
        previewContainer, colorPresetsContainer, speedSlider, speedValue,
        stopBtn, rewindBtn, playBtn, ffBtn, pauseBtn, ejectBtn, sampleSelect,
        configMode, configExclusionStrategy, configRewindable
    } = elements;

    let isScrubbing = false;

    function getMsg(key) {
        if (state.getMsg) return state.getMsg(key);
        return key;
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
            if (color === state.currentPreviewColor) div.classList.add('active');
            div.style.backgroundColor = color;
            div.addEventListener('click', () => {
                state.currentPreviewColor = color;
                document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('active'));
                div.classList.add('active');
                if (state.currentState !== 'STOPPED' && state.engine) {
                    state.engine.color = color;
                }
            });
            colorPresetsContainer.appendChild(div);
        });
    }

    function adjustPreviewHeight(delta) {
        const currentHeight = previewContainer.offsetHeight;
        const newHeight = Math.max(100, Math.min(600, currentHeight + delta));
        previewContainer.style.height = `${newHeight}px`;
        rawCanvasContainer.style.height = `${newHeight}px`;
        if (state.engine) state.engine.resize();
    }

    function updateExclusionAreas() {
        if (!state.engine) return;

        if (rawCanvas.width !== state.engine.canvas.width || rawCanvas.height !== state.engine.canvas.height) {
            rawCanvas.width = state.engine.canvas.width;
            rawCanvas.height = state.engine.canvas.height;
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
            state.engine.setExclusionAreas([area]);
        } else {
            state.engine.setExclusionAreas([]);
        }

        if (state.currentState !== 'STOPPED' && state.engine.initialized) {
            state.engine.resize();
        }
    }

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

    function updateCanvasControlVisibility() {
        const isCanvasMode = configMode.value === 'canvas';
        const hasSample = !!sampleSelect.value;
        const showCanvasLabel = document.getElementById('show-canvas-label');
        if (showCanvasLabel) showCanvasLabel.style.display = isCanvasMode ? 'flex' : 'none';

        if (isCanvasMode && hasSample) {
            showCanvasCheck.checked = true;
            rawCanvasContainer.classList.remove('hidden');
            if (state.engine) state.engine.requestRawBitmap = true;
        } else {
            showCanvasCheck.checked = false;
            rawCanvasContainer.classList.add('hidden');
            if (state.engine) state.engine.requestRawBitmap = false;
        }
    }

    function updateTapeControlState() {
        rewindBtn.disabled = !configRewindable.checked;
    }

    async function scrub(direction) {
        if (state.currentState === 'STOPPED' || isScrubbing) return;
        if (direction === -1 && rewindBtn.disabled) return;

        isScrubbing = true;
        const originalState = state.currentState;
        const btn = direction === -1 ? rewindBtn : ffBtn;
        btn.classList.add('active');

        const interval = 10;
        const count = 10;
        const stepSize = 100 * state.currentSpeed;

        for (let i = 0; i < count; i++) {
            if (state.currentState === 'STOPPED') break;

            if (direction === -1) {
                state.virtualElapsedMs = Math.max(0, state.virtualElapsedMs - stepSize);
            } else {
                state.virtualElapsedMs += stepSize;
            }

            if (state.updateTapeCounter) state.updateTapeCounter();

            const startWait = performance.now();
            while (state.engine.isDrawPending && performance.now() - startWait < 50) {
                await new Promise(r => setTimeout(r, 2));
            }

            if (state.requestStudioDraw) state.requestStudioDraw(state.virtualElapsedMs);
            await new Promise(resolve => setTimeout(resolve, interval));
        }

        btn.classList.remove('active');
        isScrubbing = false;

        if (state.currentState !== 'STOPPED') {
            if (originalState === 'PLAYING') {
                state.lastFrameTime = performance.now();
            }
        }
    }

    // Event Listeners
    showExclusionCheck.addEventListener('change', (e) => {
        exclusionSim.style.display = e.target.checked ? 'flex' : 'none';
        updateExclusionAreas();
    });

    showCanvasCheck.addEventListener('change', (e) => {
        const checked = e.target.checked;
        rawCanvasContainer.classList.toggle('hidden', !checked);
        if (state.engine) state.engine.requestRawBitmap = checked;
    });

    shrinkPreviewBtn.addEventListener('click', () => adjustPreviewHeight(-20));
    expandPreviewBtn.addEventListener('click', () => adjustPreviewHeight(20));

    speedSlider.addEventListener('input', (e) => {
        state.currentSpeed = parseFloat(e.target.value);
        speedValue.textContent = state.currentSpeed.toFixed(1);
    });

    playBtn.addEventListener('click', () => {
        if (state.currentState === 'STOPPED') {
            if (state.startTest) state.startTest();
        } else if (state.currentState === 'PAUSED') {
            if (state.resumeTest) state.resumeTest();
        }
    });

    stopBtn.addEventListener('click', () => {
        if (state.stopTest) state.stopTest();
    });

    pauseBtn.addEventListener('click', () => {
        if (state.currentState === 'PLAYING') {
            if (state.pauseTest) state.pauseTest();
        } else if (state.currentState === 'PAUSED') {
            if (state.resumeTest) state.resumeTest();
        }
    });

    rewindBtn.addEventListener('click', () => scrub(-1));
    ffBtn.addEventListener('click', () => scrub(1));

    ejectBtn.addEventListener('click', () => {
        if (state.currentState === 'STOPPED') {
            sampleSelect.value = '';
            if (state.resetStudioUI) state.resetStudioUI(true);
        }
    });

    // Initialize
    setupColorPresets();
    setupDraggableResizable();

    return {
        updateExclusionAreas,
        updateCanvasControlVisibility,
        updateTapeControlState,
        adjustPreviewHeight
    };
}
