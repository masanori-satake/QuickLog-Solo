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

/**
 * Animation Module Base Class
 * Developers should extend this class to create custom animations.
 */
export class AnimationBase {
    /**
     * Static metadata for the animation.
     */
    static metadata = {
        name: 'Base Animation',
        description: 'Template for animations',
        author: 'QuickLog-Solo'
    };

    /**
     * Animation Configuration.
     * mode: 'canvas' (default), 'matrix', or 'sprite'
     * usePseudoSpace: If true, the engine provides a virtual width excluding the widest exclusion area.
     */
    config = {
        mode: 'canvas',
        usePseudoSpace: false
    };

    /**
     * Called when the animation starts or the viewport is resized.
     * @param {number} width - Viewport width (mapped if usePseudoSpace is true)
     * @param {number} height - Viewport height
     */
    setup(width, height) {}

    /**
     * Called every frame to draw the animation.
     * @param {CanvasRenderingContext2D} ctx - Offscreen context (Canvas Mode only).
     * @param {Object} params - Animation parameters (width, height, elapsedMs, progress, step, exclusionAreas).
     * @returns {number[][]|Array<{x,y,size}>|void} - Data based on the selected mode.
     */
    draw(ctx, params) {}

    /**
     * Interaction hooks (Optional)
     */
    onClick(x, y) {}
    onMouseMove(x, y) {}
}

export class AnimationEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.activeAnimation = null;
        this.startTime = 0;
        this.color = '#1976d2';
        this.requestId = null;
        this.registry = new Map();
        this.cycleMs = 120000; // 2 minutes cycle
        this.exclusionAreas = [];

        this._initListeners();
    }

    _initListeners() {
        this.canvas.addEventListener('click', (e) => {
            if (this.activeAnimation && typeof this.activeAnimation.onClick === 'function') {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const mappedX = this._mapToVirtualX(x);
                this.activeAnimation.onClick(mappedX, y);
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.activeAnimation && typeof this.activeAnimation.onMouseMove === 'function') {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const mappedX = this._mapToVirtualX(x);
                this.activeAnimation.onMouseMove(mappedX, y);
            }
        });
    }

    _getPseudoInfo() {
        if (!this.exclusionAreas || this.exclusionAreas.length === 0) {
            return { left: 0, width: 0, totalWidth: this.canvas.width };
        }
        // Snapping to grid to maintain LCD consistency and prevent phase shifts
        const minX = Math.min(...this.exclusionAreas.map(a => a.x));
        const maxX = Math.max(...this.exclusionAreas.map(a => a.x + a.width));
        const left = Math.floor(minX / CELL_SIZE) * CELL_SIZE;
        const right = Math.ceil(maxX / CELL_SIZE) * CELL_SIZE;
        const width = right - left;
        return { left, width, totalWidth: this.canvas.width - width };
    }

    _mapToVirtualX(realX) {
        if (!this.activeAnimation?.config?.usePseudoSpace) return realX;
        const info = this._getPseudoInfo();
        if (realX < info.left) return realX;
        if (realX < info.left + info.width) return info.left; // Inside exclusion
        return realX - info.width;
    }

    _mapToRealX(virtualX) {
        if (!this.activeAnimation?.config?.usePseudoSpace) return virtualX;
        const info = this._getPseudoInfo();
        if (virtualX < info.left) return virtualX;
        return virtualX + info.width;
    }

    register(name, animationClass) {
        this.registry.set(name, animationClass);
    }

    start(name, startTime, color) {
        this.stop();
        const AnimClass = this.registry.get(name);
        if (!AnimClass) {
            console.warn(`Animation "${name}" not found in registry.`);
            return;
        }
        this.activeAnimation = new AnimClass();

        let w = this.canvas.width;
        if (this.activeAnimation.config?.usePseudoSpace) {
            w = this._getPseudoInfo().totalWidth;
        }

        if (typeof this.activeAnimation.setup === 'function') {
            this.activeAnimation.setup(w, this.canvas.height);
        }
        this.startTime = startTime;
        this.color = color;
        this.animate();
    }

    stop() {
        if (this.requestId) {
            cancelAnimationFrame(this.requestId);
            this.requestId = null;
        }
        // Explicitly clear reference to avoid memory leaks as requested
        this.activeAnimation = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    animate() {
        if (!this.activeAnimation) return;
        this.draw();
        this.requestId = requestAnimationFrame(() => this.animate());
    }

    draw() {
        if (!this.activeAnimation) return;
        const now = Date.now();
        const elapsed = now - this.startTime;
        const progress = (elapsed % this.cycleMs) / this.cycleMs;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawLCD(progress, elapsed);
    }

    setExclusionAreas(areas) {
        this.exclusionAreas = areas;
    }

    drawLCD(progress, elapsedMs) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        if (w === 0 || h === 0) return;

        const config = this.activeAnimation.config || { mode: 'canvas' };
        let drawWidth = w;
        if (config.usePseudoSpace) {
            drawWidth = this._getPseudoInfo().totalWidth;
        }

        const params = {
            width: drawWidth,
            height: h,
            elapsedMs,
            progress,
            step: Math.floor(progress * 240),
            exclusionAreas: this.exclusionAreas
        };

        this.ctx.fillStyle = this.color;

        if (config.mode === 'matrix') {
            const matrix = this.activeAnimation.draw(null, params);
            if (!matrix || !Array.isArray(matrix)) return;
            const rows = Math.ceil(h / CELL_SIZE);
            const cols = Math.ceil(w / CELL_SIZE);

            for (let r = 0; r < Math.min(matrix.length, rows); r++) {
                if (!matrix[r]) continue;
                for (let c = 0; c < cols; c++) {
                    const cellX = c * CELL_SIZE;
                    const cellY = r * CELL_SIZE;

                    if (this._isInExclusion(cellX, cellY)) continue;

                    const virtualC = config.usePseudoSpace ? Math.floor(this._mapToVirtualX(cellX) / CELL_SIZE) : c;
                    const val = matrix[r][virtualC];
                    let dotSize = 0;
                    if (val === 3) dotSize = DOT_SIZE_LARGE;
                    else if (val === 2) dotSize = DOT_SIZE_MID;
                    else if (val === 1) dotSize = DOT_SIZE_SMALL;

                    if (dotSize > 0) {
                        const dotX = cellX + (CELL_SIZE - dotSize) / 2;
                        const dotY = cellY + (CELL_SIZE - dotSize) / 2;
                        this.ctx.fillRect(dotX, dotY, dotSize, dotSize);
                    }
                }
            }
        } else if (config.mode === 'sprite') {
            const sprites = this.activeAnimation.draw(null, params);
            if (!sprites || !Array.isArray(sprites)) return;

            sprites.forEach(sprite => {
                const realX = this._mapToRealX(sprite.x);
                const realY = sprite.y;

                // Snap to the nearest cell grid to prevent blurring and maintain the LCD look
                const cellX = Math.floor(realX / CELL_SIZE) * CELL_SIZE;
                const cellY = Math.floor(realY / CELL_SIZE) * CELL_SIZE;

                if (this._isInExclusion(cellX, cellY)) return;

                let dotSize = 0;
                if (sprite.size === 3) dotSize = DOT_SIZE_LARGE;
                else if (sprite.size === 2) dotSize = DOT_SIZE_MID;
                else if (sprite.size === 1) dotSize = DOT_SIZE_SMALL;

                if (dotSize > 0) {
                    const dotX = cellX + (CELL_SIZE - dotSize) / 2;
                    const dotY = cellY + (CELL_SIZE - dotSize) / 2;
                    this.ctx.fillRect(dotX, dotY, dotSize, dotSize);
                }
            });
        } else {
            // Canvas Mode
            if (!this.offscreen) {
                this.offscreen = document.createElement('canvas');
            }
            if (this.offscreen.width !== drawWidth || this.offscreen.height !== h) {
                this.offscreen.width = drawWidth;
                this.offscreen.height = h;
            }
            const octx = this.offscreen.getContext('2d', { willReadFrequently: true });
            octx.clearRect(0, 0, drawWidth, h);

            this.activeAnimation.draw(octx, params);

            const imgData = octx.getImageData(0, 0, drawWidth, h).data;
            const rows = Math.ceil(h / CELL_SIZE);
            const cols = Math.ceil(w / CELL_SIZE);

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cellX = c * CELL_SIZE;
                    const cellY = r * CELL_SIZE;

                    if (this._isInExclusion(cellX, cellY)) continue;

                    const virtualCellX = config.usePseudoSpace ? this._mapToVirtualX(cellX) : cellX;

                    let totalBrightness = 0;
                    let count = 0;
                    for (let dy = 0; dy < CELL_SIZE; dy++) {
                        for (let dx = 0; dx < CELL_SIZE; dx++) {
                            const x = virtualCellX + dx;
                            const y = cellY + dy;
                            if (x < drawWidth && y < h) {
                                const idx = (y * drawWidth + x) * 4;
                                totalBrightness += imgData[idx];
                                count++;
                            }
                        }
                    }
                    const brightness = totalBrightness / count;

                    let dotSize = 0;
                    if (brightness > BRIGHTNESS_HIGH) dotSize = DOT_SIZE_LARGE;
                    else if (brightness > BRIGHTNESS_MID) dotSize = DOT_SIZE_MID;
                    else if (brightness > BRIGHTNESS_LOW) dotSize = DOT_SIZE_SMALL;

                    if (dotSize > 0) {
                        const dotX = cellX + (CELL_SIZE - dotSize) / 2;
                        const dotY = cellY + (CELL_SIZE - dotSize) / 2;
                        this.ctx.fillRect(dotX, dotY, dotSize, dotSize);
                    }
                }
            }
        }
    }

    _isInExclusion(x, y) {
        return this.exclusionAreas.some(area =>
            x < area.x + area.width && x + CELL_SIZE > area.x &&
            y < area.y + area.height && y + CELL_SIZE > area.y
        );
    }

    resize() {
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        if (this.activeAnimation) {
            let w = this.canvas.width;
            if (this.activeAnimation.config?.usePseudoSpace) {
                w = this._getPseudoInfo().totalWidth;
            }

            if (typeof this.activeAnimation.setup === 'function') {
                this.activeAnimation.setup(w, this.canvas.height);
            }
            this.draw();
        }
    }
}
