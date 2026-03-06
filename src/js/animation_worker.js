/**
 * QuickLog-Solo: Animation Web Worker
 * Handles animation logic and LCD conversion in a separate thread.
 */

// Proxy console to main thread
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
};

console.log = (...args) => {
    self.postMessage({ type: 'log', payload: args.join(' '), level: 'info' });
    originalConsole.log(...args);
};
console.warn = (...args) => {
    self.postMessage({ type: 'log', payload: args.join(' '), level: 'warn' });
    originalConsole.warn(...args);
};
console.error = (...args) => {
    self.postMessage({ type: 'log', payload: args.join(' '), level: 'error' });
    originalConsole.error(...args);
};

let animation = null;
let offscreenCanvas = null;
let offscreenCtx = null;
let speedFactor = 1.0;
let initPromise = null;

const CELL_SIZE = 6;
const BRIGHTNESS_HIGH = 120;
const BRIGHTNESS_MID = 60;
const BRIGHTNESS_LOW = 10;
const DOT_SIZE_LARGE = 4;
const DOT_SIZE_MID = 3;
const DOT_SIZE_SMALL = 2;

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    try {
        if (type === 'init') {
            const { modulePath } = payload;
            initPromise = (async () => {
                const module = await import(modulePath);
                const AnimClass = module.default;
                animation = new AnimClass();
                self.postMessage({ type: 'initialized' });
            })();
            return;
        }

        // Wait for initialization to complete for other message types
        if (initPromise) await initPromise;

        switch (type) {
            case 'setup':
                if (animation && typeof animation.setup === 'function') {
                    animation.setup(payload.width, payload.height);
                }
                break;

            case 'draw': {
                if (!animation) return;
                const result = performDraw(payload);
                if (!result || !result.dots) return;
                const { dots, rawBitmap } = result;
                const response = {
                    type: 'drawResponse',
                    payload: {
                        dots,
                        rawBitmap,
                        elapsedMs: payload.elapsedMs
                    }
                };
                if (rawBitmap) {
                    self.postMessage(response, [rawBitmap]);
                } else {
                    self.postMessage(response);
                }
                break;
            }

            case 'click':
                if (animation && typeof animation.onClick === 'function') {
                    animation.onClick(payload.x, payload.y);
                }
                break;

            case 'mousemove':
                if (animation && typeof animation.onMouseMove === 'function') {
                    animation.onMouseMove(payload.x, payload.y);
                }
                break;

            case 'setSpeed':
                speedFactor = payload;
                break;
        }
    } catch (err) {
        self.postMessage({ type: 'error', payload: err.message });
    }
};

function _getPseudoInfo(exclusionAreas, canvasWidth) {
    if (!exclusionAreas || exclusionAreas.length === 0) {
        return { left: 0, width: 0, totalWidth: canvasWidth };
    }
    const minX = Math.min(...exclusionAreas.map(a => a.x));
    const maxX = Math.max(...exclusionAreas.map(a => a.x + a.width));
    const left = Math.floor(minX / CELL_SIZE) * CELL_SIZE;
    const right = Math.ceil(maxX / CELL_SIZE) * CELL_SIZE;
    const width = right - left;
    return { left, width, totalWidth: canvasWidth - width };
}

function _mapToRealX(virtualX, usePseudoSpace, exclusionAreas, canvasWidth) {
    if (!usePseudoSpace) return virtualX;
    const info = _getPseudoInfo(exclusionAreas, canvasWidth);
    if (virtualX < info.left) return virtualX;
    return virtualX + info.width;
}

function _isInExclusion(x, y, exclusionAreas) {
    return exclusionAreas.some(area =>
        x < area.x + area.width && x + CELL_SIZE > area.x &&
        y < area.y + area.height && y + CELL_SIZE > area.y
    );
}

function performDraw(params) {
    const { width, height, canvasWidth, exclusionAreas, realExclusionAreas, elapsedMs, requestRawBitmap } = params;

    // Apply speed factor to elapsed time
    const modifiedElapsedMs = elapsedMs * speedFactor;
    const cycleMs = 120000; // 2 minutes cycle
    const progress = (modifiedElapsedMs % cycleMs) / cycleMs;

    const modifiedParams = {
        ...params,
        elapsedMs: modifiedElapsedMs,
        progress: progress,
        step: Math.floor(progress * 240),
        speed: speedFactor // Ensure speed is passed for legacy or manual use
    };
    const config = animation.config || { mode: 'canvas' };
    const usePseudoSpace = !!config.usePseudoSpace;

    // Use raw exclusion areas for physical masking to prevent drawing over UI
    const physicalMask = realExclusionAreas || exclusionAreas;

    let dots = [];
    let rawBitmap = null;

    if (config.mode === 'matrix') {
        const matrix = animation.draw(null, modifiedParams);
        if (!matrix || !Array.isArray(matrix)) return [];
        const rows = Math.ceil(height / CELL_SIZE);
        const cols = Math.ceil(canvasWidth / CELL_SIZE);

        for (let r = 0; r < Math.min(matrix.length, rows); r++) {
            if (!matrix[r]) continue;
            for (let c = 0; c < cols; c++) {
                const cellX = c * CELL_SIZE;
                const cellY = r * CELL_SIZE;

                // 1. Physical Masking: Prevent drawing over UI text/buttons
                if (_isInExclusion(cellX, cellY, physicalMask)) continue;

                let virtualC = c;
                if (usePseudoSpace) {
                    const info = _getPseudoInfo(physicalMask, canvasWidth);
                    const realX = cellX;
                    if (realX < info.left) virtualC = Math.floor(realX / CELL_SIZE);
                    else if (realX < info.left + info.width) continue;
                    else virtualC = Math.floor((realX - info.width) / CELL_SIZE);
                }

                if (matrix[r][virtualC] !== undefined) {
                    const val = matrix[r][virtualC];
                    let dotSize = 0;
                    if (val === 3) dotSize = DOT_SIZE_LARGE;
                    else if (val === 2) dotSize = DOT_SIZE_MID;
                    else if (val === 1) dotSize = DOT_SIZE_SMALL;

                    if (dotSize > 0) {
                        dots.push({ x: cellX, y: cellY, size: dotSize });
                    }
                }
            }
        }
    } else if (config.mode === 'sprite') {
        const sprites = animation.draw(null, modifiedParams);
        if (!sprites || !Array.isArray(sprites)) return [];

        sprites.forEach(sprite => {
            const realX = _mapToRealX(sprite.x, usePseudoSpace, physicalMask, canvasWidth);
            const realY = sprite.y;
            const cellX = Math.floor(realX / CELL_SIZE) * CELL_SIZE;
            const cellY = Math.floor(realY / CELL_SIZE) * CELL_SIZE;

            // 1. Physical Masking: Prevent drawing over UI text/buttons
            if (_isInExclusion(cellX, cellY, physicalMask)) return;

            let dotSize = 0;
            if (sprite.size === 3) dotSize = DOT_SIZE_LARGE;
            else if (sprite.size === 2) dotSize = DOT_SIZE_MID;
            else if (sprite.size === 1) dotSize = DOT_SIZE_SMALL;

            if (dotSize > 0) {
                dots.push({ x: cellX, y: cellY, size: dotSize });
            }
        });
    } else {
        // Canvas mode
        if (!offscreenCanvas || offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
            offscreenCanvas = new OffscreenCanvas(width, height);
            offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
        }
        offscreenCtx.clearRect(0, 0, width, height);
        animation.draw(offscreenCtx, modifiedParams);

        const imgData = offscreenCtx.getImageData(0, 0, width, height).data;
        const rows = Math.ceil(height / CELL_SIZE);
        const cols = Math.ceil(canvasWidth / CELL_SIZE);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellX = c * CELL_SIZE;
                const cellY = r * CELL_SIZE;

                // 1. Physical Masking: Prevent drawing over UI text/buttons
                if (_isInExclusion(cellX, cellY, physicalMask)) continue;

                let vCellX = cellX;
                if (usePseudoSpace) {
                    const info = _getPseudoInfo(physicalMask, canvasWidth);
                    if (cellX < info.left) {
                        vCellX = cellX;
                    } else if (cellX < info.left + info.width) {
                        // Gap handling is already covered by physical masking above
                        continue;
                    } else {
                        vCellX = cellX - info.width;
                    }
                }

                let totalBrightness = 0;
                let count = 0;
                for (let dy = 0; dy < CELL_SIZE; dy++) {
                    for (let dx = 0; dx < CELL_SIZE; dx++) {
                        const x = vCellX + dx;
                        const y = cellY + dy;
                        if (x >= 0 && x < width && y >= 0 && y < height) {
                            const idx = (y * width + x) * 4;
                            totalBrightness += imgData[idx];
                            count++;
                        }
                    }
                }
                const brightness = count > 0 ? totalBrightness / count : 0;

                let dotSize = 0;
                if (brightness > BRIGHTNESS_HIGH) dotSize = DOT_SIZE_LARGE;
                else if (brightness > BRIGHTNESS_MID) dotSize = DOT_SIZE_MID;
                else if (brightness > BRIGHTNESS_LOW) dotSize = DOT_SIZE_SMALL;

                if (dotSize > 0) {
                    dots.push({ x: cellX, y: cellY, size: dotSize });
                }
            }
        }

        if (requestRawBitmap) {
            rawBitmap = offscreenCanvas.transferToImageBitmap();
        }
    }
    return { dots, rawBitmap };
}
