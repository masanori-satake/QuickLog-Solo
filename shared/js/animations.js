/**
 * QuickLog-Solo: Canvas-based Animation Engine
 */

const CELL_SIZE = 6;

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

    start(name, startTime, color) {
        this.stop();
        const entry = this.registry.get(name);
        if (!entry) {
            console.warn(`Animation "${name}" not found in registry.`);
            return;
        }

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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.color;
        dots.forEach(dot => {
            const dotX = dot.x + (CELL_SIZE - dot.size) / 2;
            const dotY = dot.y + (CELL_SIZE - dot.size) / 2;
            this.ctx.fillRect(dotX, dotY, dot.size, dot.size);
        });
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
        this.activeAnimationId = null;
        this.initialized = false;
        this.setupDone = false;
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    animate() {
        if (!this.worker || !this.initialized) return;
        this.draw();
        this.requestId = requestAnimationFrame(() => this.animate());
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
