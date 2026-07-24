/**
 * QuickLog-Solo: Canvas-based Animation Engine
 */

import { CELL_SIZE } from './utils.js';
import { AnimationBase } from './animation_base.js';

export { AnimationBase };

export class AnimationEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.worker = null;
        this.startTime = 0;
        this.color = '#1976d2';
        this.requestId = null;
        this.registry = new Map();
        this.cycleMs = 120000; // 2 minutes cycle
        this.exclusionAreas = [];
        this.activeAnimationId = null;
        this.config = { exclusionStrategy: 'mask' };
        this.initialized = false;
        this.setupDone = false;
        this.requestRawBitmap = false;
        this.lastRenderStartTime = 0;
        this.lastDots = null;
        this.onRawBitmapDraw = null;
        this.onStop = null;

        this.perfThreshold = 200; // ms
        this.perfViolations = 0;
        this.maxViolations = 20;
        this.isDrawPending = false;
        this.lastDrawRequestTime = 0;
        this.warmupFrames = 0;
        this.WARMUP_LIMIT = 180; // 3 seconds @ 60fps

        this._initListeners();
    }

    _initListeners() {
        this.canvas.addEventListener('click', (e) => {
            if (this.worker && this.initialized) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const mappedX = this._mapToVirtualX(x);
                this.worker.postMessage({ type: 'click', payload: { x: mappedX, y } });
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.worker && this.initialized) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const mappedX = this._mapToVirtualX(x);
                this.worker.postMessage({ type: 'mousemove', payload: { x: mappedX, y } });
            }
        });
    }

    _getPseudoInfo() {
        if (!this.exclusionAreas || this.exclusionAreas.length === 0) {
            return { left: 0, width: 0, totalWidth: this.canvas.width };
        }
        const minX = Math.min(...this.exclusionAreas.map(a => a.x));
        const maxX = Math.max(...this.exclusionAreas.map(a => a.x + a.width));
        const left = Math.floor(minX / CELL_SIZE) * CELL_SIZE;
        const right = Math.ceil(maxX / CELL_SIZE) * CELL_SIZE;
        const width = right - left;
        return { left, width, totalWidth: this.canvas.width - width };
    }

    _mapToVirtualX(realX) {
        if (this.config.exclusionStrategy !== 'jump') return realX;
        const info = this._getPseudoInfo();
        if (realX < info.left) return realX;
        if (realX < info.left + info.width) return info.left;
        return realX - info.width;
    }

    _getVirtualExclusionAreas() {
        if (this.config.exclusionStrategy !== 'jump') return this.exclusionAreas;
        const info = this._getPseudoInfo();
        return this.exclusionAreas.map(area => {
            const vX = this._mapToVirtualX(area.x);
            let vWidth = area.width;
            const areaRight = area.x + area.width;
            const gapLeft = info.left;
            const gapRight = info.left + info.width;

            if (area.x < gapLeft && areaRight > gapRight) {
                vWidth -= info.width;
            } else if (area.x >= gapLeft && area.x < gapRight) {
                const overlap = gapRight - area.x;
                vWidth = Math.max(0, area.width - overlap);
            } else if (areaRight > gapLeft && areaRight <= gapRight) {
                vWidth = gapLeft - area.x;
            }
            return { ...area, x: vX, width: vWidth };
        }).filter(a => a.width > 0);
    }

    register(name, animationClass, id) {
        // In the new architecture, we store the ID or path to the module
        this.registry.set(name, { class: animationClass, id: id });
    }

    async start(name, startTime, color) {
        this.stop();
        const entry = this.registry.get(name);
        if (entry) {
            this._startStandard(entry, startTime, color);
            return;
        }

        // Try custom animations
        let metadata = null;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const res = await chrome.storage.local.get('custom_animation_metadata');
            metadata = res.custom_animation_metadata;
        } else {
            const raw = localStorage.getItem('custom_animation_metadata');
            if (raw) metadata = JSON.parse(raw);
        }

        if (metadata && metadata.id === name) {
            await this._startCustom(metadata, startTime, color);
        } else {
            console.warn(`Animation "${name}" not found in registry or custom animations.`);
        }
    }

    _startStandard(entry, startTime, color) {
        this.activeAnimationId = entry.id;
        this.startTime = startTime;
        this.color = color;
        this.initialized = false;
        this.setupDone = false;
        this.perfViolations = 0;
        this.warmupFrames = 0;

        // Ensure we have correct dimensions before starting
        this.resize();
        this.isDrawPending = false;

        const animInstance = new entry.class();
        this.config = animInstance.config || { mode: 'canvas', exclusionStrategy: 'mask' };

        this.worker = new Worker(new URL('./animation_worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this._handleWorkerMessage(e);

        // Use absolute URL for module loading to be more robust across different loading contexts
        const moduleUrl = new URL(`./animation/${this.activeAnimationId}.js`, import.meta.url).href;
        this.worker.postMessage({ type: 'init', payload: { modulePath: moduleUrl } });
    }

    async _startCustom(metadata, startTime, color) {
        this.activeAnimationId = metadata.id;
        this.startTime = startTime;
        this.color = color;
        this.initialized = false;
        this.setupDone = false;
        this.perfViolations = 0;
        this.warmupFrames = 0;

        this.resize();
        this.isDrawPending = false;

        this.config = metadata.config || { mode: 'canvas', exclusionStrategy: 'mask' };

        if (metadata.type === 'js-module') {
            let code = '';
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const res = await chrome.storage.local.get(`custom_animation_code_${metadata.id}`);
                code = res[`custom_animation_code_${metadata.id}`] || '';
            } else {
                code = localStorage.getItem(`custom_animation_code_${metadata.id}`) || '';
            }

            if (!code) {
                console.error('Custom animation code not found');
                return;
            }

            if (!this.sandboxIframe) {
                this.sandboxIframe = document.createElement('iframe');
                this.sandboxIframe.id = 'ql-animation-sandbox';
                this.sandboxIframe.style.display = 'none';
                const url = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('sandbox.html') : 'sandbox.html';
                this.sandboxIframe.src = url;
                document.body.appendChild(this.sandboxIframe);

                window.addEventListener('message', (e) => {
                    if (this.sandboxIframe && e.source === this.sandboxIframe.contentWindow) {
                        const { type: msgType, dots } = e.data;
                        if (msgType === 'drawResponse') {
                            this._renderDots(dots);
                        } else if (msgType === 'error') {
                            console.error('Sandbox error:', e.data.payload);
                            this.stop();
                        }
                    }
                });
            }

            const postStart = () => {
                let drawWidth = this.canvas.width;
                if (this.config.exclusionStrategy === 'jump') {
                    drawWidth = this._getPseudoInfo().totalWidth;
                }

                const payload = {
                    code,
                    width: drawWidth,
                    height: this.canvas.height,
                    canvasWidth: this.canvas.width,
                    startTime: this.startTime,
                    color: this.color,
                    animationBaseUrl: typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('shared/js/animation_base.js') : new URL('./animation_base.js', import.meta.url).href,
                    utilsUrl: typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL('shared/js/utils.js') : new URL('./utils.js', import.meta.url).href,
                    speed: 1.0
                };
                this.sandboxIframe.contentWindow.postMessage({ type: 'start', payload }, '*');
                this.initialized = true;
                this.setupDone = true;
            };

            if (this.sandboxIframe.dataset.loaded === 'true') {
                postStart();
            } else {
                this.sandboxIframe.onload = () => {
                    this.sandboxIframe.dataset.loaded = 'true';
                    postStart();
                };
            }

        } else if (metadata.type === 'gif-sprite') {
            const { default: GenericGifAnimation } = await import('./GenericGifAnimation.js');
            const { getAnimationBlob } = await import('./idb_storage.js');
            const blob = await getAnimationBlob(metadata.id);

            if (!blob) {
                console.error('GIF sprite blob not found in IndexedDB');
                return;
            }

            this.customBlobUrl = URL.createObjectURL(blob);
            const renderSpec = metadata.config.renderSpec || {};
            this.localAnimation = new GenericGifAnimation(this.customBlobUrl, renderSpec);

            let drawWidth = this.canvas.width;
            if (this.config.exclusionStrategy === 'jump') {
                drawWidth = this._getPseudoInfo().totalWidth;
            }
            this.localAnimation.setup(drawWidth, this.canvas.height);

            this.initialized = true;
            this.setupDone = true;

            this.animate();
        }
    }

    _handleWorkerMessage(e) {
        const { type, payload } = e.data;

        if (type === 'initialized') {
            this.initialized = true;
            this.resize();
            this.animate();
        } else if (type === 'drawResponse') {
            this.isDrawPending = false;
            const now = performance.now();
            const latency = now - this.lastDrawRequestTime;

            // Count every frame towards warmup
            if (this.warmupFrames < this.WARMUP_LIMIT) {
                this.warmupFrames++;
            }

            if (latency > this.perfThreshold) {
                // Only count violations after the grace period (warmup)
                if (this.warmupFrames >= this.WARMUP_LIMIT) {
                    this.perfViolations++;
                    if (this.perfViolations > this.maxViolations) {
                        console.warn(`QuickLog-Solo: Animation performance below threshold (${this.perfThreshold}ms, latency: ${Math.round(latency)}ms). Auto-stopping to save resources.`);
                        this.stop();
                        if (typeof this.onStop === 'function') {
                            this.onStop();
                        }
                        return;
                    }
                }
            } else {
                this.perfViolations = Math.max(0, this.perfViolations - 1);
            }

            if (payload.rawBitmap && typeof this.onRawBitmapDraw === 'function') {
                this.onRawBitmapDraw(payload.rawBitmap);
            }
            this._renderDots(payload.dots);
        } else if (type === 'error') {
            console.error('Animation Worker Error:', payload);
            this.stop();
            if (typeof this.onStop === 'function') {
                this.onStop();
            }
        }
    }

    _renderDots(dots) {
        if (!dots) return;
        const colLower = this.color?.toLowerCase();
        const mode = (colLower === 'retro-lcd' || colLower === '#9bbc0f') ? 'retro-lcd' :
                     (colLower === 'retro-crt' || colLower === '#33ff33') ? 'retro-crt' :
                     (colLower === 'retro-nixie' || colLower === '#ff5500') ? 'retro-nixie' :
                     (this.displayMode || 'normal');

        // 1. Clear background (transparent canvas for CSS-level backgrounds and drop-shadows)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.lastRenderStartTime !== this.startTime) {
            this.lastDots = null;
            this.lastRenderStartTime = this.startTime;
        }

        // 2. Render STN LCD Ghosting (Slow latency simulation)
        if (mode === 'retro-lcd' && this.lastDots) {
            this.ctx.fillStyle = 'rgba(48, 98, 48, 0.25)'; // Legacy persistent shade
            this.lastDots.forEach(dot => {
                const dotX = dot.x + (CELL_SIZE - dot.size) / 2;
                const dotY = dot.y + (CELL_SIZE - dot.size) / 2;
                this.ctx.fillRect(dotX, dotY, dot.size, dot.size);
            });
        }

        // 3. Render STN LCD 3D Shadow projection
        if (mode === 'retro-lcd') {
            this.ctx.fillStyle = 'rgba(15, 56, 15, 0.22)'; // Offset shadow under dots
            dots.forEach(dot => {
                const dotX = dot.x + (CELL_SIZE - dot.size) / 2 + 1;
                const dotY = dot.y + (CELL_SIZE - dot.size) / 2 + 1;
                this.ctx.fillRect(dotX, dotY, dot.size, dot.size);
            });
        }

        // 4. Render Main dots
        dots.forEach(dot => {
            const dotX = dot.x + (CELL_SIZE - dot.size) / 2;
            const dotY = dot.y + (CELL_SIZE - dot.size) / 2;

            if (mode === 'retro-lcd') {
                if (dot.size === 4) this.ctx.fillStyle = '#0f380f'; // Darkest
                else if (dot.size === 3) this.ctx.fillStyle = '#306230'; // Dark mid
                else this.ctx.fillStyle = '#8bac0f'; // Light mid
            } else if (mode === 'retro-crt') {
                this.ctx.fillStyle = '#33ff33'; // Neon phosphor green
            } else if (mode === 'retro-nixie') {
                this.ctx.fillStyle = '#ff5500'; // Discharge neon orange
            } else {
                this.ctx.fillStyle = this.color;
            }

            this.ctx.fillRect(dotX, dotY, dot.size, dot.size);
        });

        // 5. Save current dots as buffer for next frame's ghosting
        if (mode === 'retro-lcd') {
            this.lastDots = dots;
        } else {
            this.lastDots = null;
        }
    }

    stop() {
        this.isDrawPending = false;
        if (this.requestId) {
            cancelAnimationFrame(this.requestId);
            this.requestId = null;
        }
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        if (this.sandboxIframe) {
            this.sandboxIframe.contentWindow.postMessage({ type: 'stop' }, '*');
        }
        if (this.localAnimation) {
            this.localAnimation = null;
        }
        if (this.customBlobUrl) {
            URL.revokeObjectURL(this.customBlobUrl);
            this.customBlobUrl = null;
        }
        this.activeAnimationId = null;
        this.initialized = false;
        this.setupDone = false;
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    animate() {
        if (this.localAnimation) {
            this.drawLocal();
            this.requestId = requestAnimationFrame(() => this.animate());
            return;
        }
        if (!this.worker || !this.initialized) return;
        this.draw();
        this.requestId = requestAnimationFrame(() => this.animate());
    }

    drawLocal() {
        if (!this.localAnimation || !this.initialized) return;

        let drawWidth = this.canvas.width;
        if (this.config.exclusionStrategy === 'jump') {
            drawWidth = this._getPseudoInfo().totalWidth;
        }

        if (!this.localOffscreenCanvas || this.localOffscreenCanvas.width !== drawWidth || this.localOffscreenCanvas.height !== this.canvas.height) {
            this.localOffscreenCanvas = new OffscreenCanvas(drawWidth, this.canvas.height);
            this.localOffscreenCtx = this.localOffscreenCanvas.getContext('2d', { willReadFrequently: true });
        }

        const now = Date.now();
        const elapsed = now - this.startTime;
        const progress = (elapsed % this.cycleMs) / this.cycleMs;

        const params = {
            elapsedMs: elapsed,
            progress,
            step: Math.floor(progress * 240),
            speed: 1.0,
            exclusionAreas: []
        };

        this.localOffscreenCtx.clearRect(0, 0, drawWidth, this.canvas.height);
        this.localAnimation.draw(this.localOffscreenCtx, params);

        const imgData = this.localOffscreenCtx.getImageData(0, 0, drawWidth, this.canvas.height).data;
        const rows = Math.ceil(this.canvas.height / CELL_SIZE);
        const cols = Math.ceil(this.canvas.width / CELL_SIZE);
        const dots = [];

        const BRIGHTNESS_HIGH = 120;
        const BRIGHTNESS_MID = 60;
        const BRIGHTNESS_LOW = 10;
        const DOT_SIZE_LARGE = 4;
        const DOT_SIZE_MID = 3;
        const DOT_SIZE_SMALL = 2;

        const physicalMask = this.exclusionAreas;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellX = c * CELL_SIZE;
                const cellY = r * CELL_SIZE;

                if (this.config.exclusionStrategy !== 'freedom' && this._isInExclusionLocal(cellX, cellY, physicalMask)) {
                    continue;
                }

                let vCellX = cellX;
                if (this.config.exclusionStrategy === 'jump') {
                    const info = this._getPseudoInfo();
                    if (cellX < info.left) {
                        vCellX = cellX;
                    } else if (cellX < info.left + info.width) {
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
                        if (x >= 0 && x < drawWidth && y >= 0 && y < this.canvas.height) {
                            const idx = (y * drawWidth + x) * 4;
                            const R = imgData[idx];
                            const G = imgData[idx+1];
                            const B = imgData[idx+2];
                            const A = imgData[idx+3]/255;
                            totalBrightness += (0.299 * R + 0.587 * G + 0.114 * B) * A;
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

        this._renderDots(dots);
    }

    _isInExclusionLocal(x, y, exclusionAreas) {
        return exclusionAreas.some(area =>
            x < area.x + area.width && x + CELL_SIZE > area.x &&
            y < area.y + area.height && y + CELL_SIZE > area.y
        );
    }

    draw() {
        if (!this.worker || !this.initialized) return;

        // Emergency resize check: If dimensions are 0 but we think setup is done, or vice-versa
        const parent = this.canvas.parentElement;
        const rect = parent?.getBoundingClientRect();
        if (rect && (rect.width === 0 || rect.height === 0 || !this.setupDone)) {
            this.resize();
            if (!this.setupDone) return;
        }

        // If a draw is already pending in the worker, skip this frame
        // to avoid queuing up messages and causing latency spikes.
        if (this.isDrawPending) {
            return;
        }

        const now = Date.now();
        const elapsed = now - this.startTime;
        const progress = (elapsed % this.cycleMs) / this.cycleMs;

        let drawWidth = this.canvas.width;
        if (this.config.exclusionStrategy === 'jump') {
            drawWidth = this._getPseudoInfo().totalWidth;
        }

        const params = {
            width: drawWidth,
            height: this.canvas.height,
            canvasWidth: this.canvas.width,
            elapsedMs: elapsed,
            progress,
            step: Math.floor(progress * 240),
            exclusionAreas: this.config.exclusionStrategy === 'jump' ? [] : this._getVirtualExclusionAreas(),
            realExclusionAreas: this.exclusionAreas,
            requestRawBitmap: this.requestRawBitmap
        };

        this.lastDrawRequestTime = performance.now();
        this.isDrawPending = true;
        this.worker.postMessage({ type: 'draw', payload: params });
    }

    setExclusionAreas(areas) {
        this.exclusionAreas = areas;
    }

    resize() {
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            this.setupDone = false;
            return;
        }

        this.canvas.width = Math.floor(rect.width);
        this.canvas.height = Math.floor(rect.height);

        if (this.worker && this.initialized) {
            let w = this.canvas.width;
            if (this.config.exclusionStrategy === 'jump') {
                w = this._getPseudoInfo().totalWidth;
            }
            this.worker.postMessage({ type: 'setup', payload: { width: w, height: this.canvas.height } });
            this.setupDone = true;
        }
    }
}
