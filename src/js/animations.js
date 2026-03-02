/**
 * QuickLog-Solo: Canvas-based Animation Engine
 */

const CELL_SIZE = 6;
const BRIGHTNESS_HIGH = 120;
const BRIGHTNESS_MID = 60;
const BRIGHTNESS_LOW = 10;
const DOT_SIZE_LARGE = 4;
const DOT_SIZE_MID = 3;
const DOT_SIZE_SMALL = 2;

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
        this.config = { usePseudoSpace: false };
        this.initialized = false;

        this.perfThreshold = 100; // ms
        this.perfViolations = 0;
        this.maxViolations = 10;
        this.isMonitoring = false;

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
        if (!this.config.usePseudoSpace) return realX;
        const info = this._getPseudoInfo();
        if (realX < info.left) return realX;
        if (realX < info.left + info.width) return info.left;
        return realX - info.width;
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
        this.perfViolations = 0;
        this.isMonitoring = true;

        const animInstance = new entry.class();
        this.config = animInstance.config || { mode: 'canvas', usePseudoSpace: false };

        this.worker = new Worker(new URL('./animation_worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this._handleWorkerMessage(e);

        const modulePath = `./animation/${this.activeAnimationId}.js`;
        this.worker.postMessage({ type: 'init', payload: { modulePath } });
    }

    _handleWorkerMessage(e) {
        const { type, payload } = e.data;

        if (type === 'initialized') {
            this.initialized = true;
            this.resize();
            this.animate();
        } else if (type === 'drawResponse') {
            const now = Date.now();
            const latency = now - this.lastDrawRequestTime;

            if (latency > this.perfThreshold) {
                this.perfViolations++;
                if (this.perfViolations > this.maxViolations) {
                    console.error('Animation performance too low. Stopping.');
                    this.stop();
                    // Alert user?
                    return;
                }
            } else {
                this.perfViolations = Math.max(0, this.perfViolations - 1);
            }

            this._renderDots(payload.dots);
        } else if (type === 'error') {
            console.error('Animation Worker Error:', payload);
            this.stop();
        }
    }

    _renderDots(dots) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.color;
        dots.forEach(dot => {
            const dotX = dot.x + (CELL_SIZE - dot.size) / 2;
            const dotY = dot.y + (CELL_SIZE - dot.size) / 2;
            this.ctx.fillRect(dotX, dotY, dot.size, dot.size);
        });
    }

    stop() {
        this.isMonitoring = false;
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
        const now = Date.now();
        const elapsed = now - this.startTime;
        const progress = (elapsed % this.cycleMs) / this.cycleMs;

        let drawWidth = this.canvas.width;
        if (this.config.usePseudoSpace) {
            drawWidth = this._getPseudoInfo().totalWidth;
        }

        const params = {
            width: drawWidth,
            height: this.canvas.height,
            canvasWidth: this.canvas.width,
            elapsedMs: elapsed,
            progress,
            step: Math.floor(progress * 240),
            exclusionAreas: this.exclusionAreas
        };

        this.lastDrawRequestTime = Date.now();
        this.worker.postMessage({ type: 'draw', payload: params });
    }

    setExclusionAreas(areas) {
        this.exclusionAreas = areas;
    }

    resize() {
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        if (this.worker && this.initialized) {
            let w = this.canvas.width;
            if (this.config.usePseudoSpace) {
                w = this._getPseudoInfo().totalWidth;
            }
            this.worker.postMessage({ type: 'setup', payload: { width: w, height: this.canvas.height } });
        }
    }
}
