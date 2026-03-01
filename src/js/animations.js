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
     * name: Display name (can be a string or an object for i18n)
     * description: Short description (can be a string or an object for i18n)
     * author: Author's name
     */
    static metadata = {
        name: 'Base Animation',
        description: 'Template for animations',
        author: 'QuickLog-Solo'
    };

    /**
     * Called when the animation starts or the viewport is resized.
     * Use this to initialize internal state or setup coordinates.
     */
    setup() {}

    /**
     * Called every frame to draw the animation.
     * @param {CanvasRenderingContext2D} ctx - Offscreen context for monotone drawing.
     * @param {Object} params - Animation parameters.
     * @returns {number[][]|void} - Return a 2D matrix of dot sizes (0-3) or draw directly to ctx.
     */
    draw() {}
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
        if (typeof this.activeAnimation.setup === 'function') {
            this.activeAnimation.setup(this.canvas.width, this.canvas.height);
        } else if (typeof this.activeAnimation.init === 'function') {
            // Backward compatibility for temporary init method
            this.activeAnimation.init(this.canvas.width, this.canvas.height);
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

        const cols = Math.ceil(w / CELL_SIZE);
        const rows = Math.ceil(h / CELL_SIZE);

        // Offscreen canvas for actual animation drawing
        if (!this.offscreen) {
            this.offscreen = document.createElement('canvas');
        }
        if (this.offscreen.width !== w || this.offscreen.height !== h) {
            this.offscreen.width = w;
            this.offscreen.height = h;
        }
        const octx = this.offscreen.getContext('2d', { willReadFrequently: true });
        octx.clearRect(0, 0, w, h);

        // Draw the monochromatic animation to offscreen
        // We use white as the base "on" color, then map brightness to dot size
        const params = {
            width: w,
            height: h,
            elapsedMs,
            progress,
            step: Math.floor(progress * 240),
            exclusionAreas: this.exclusionAreas
        };
        const matrix = this.activeAnimation.draw(octx, params);

        this.ctx.fillStyle = this.color;

        if (matrix && Array.isArray(matrix)) {
            // Matrix Mode
            for (let r = 0; r < Math.min(matrix.length, rows); r++) {
                for (let c = 0; c < Math.min(matrix[r].length, cols); c++) {
                    const cellX = c * CELL_SIZE;
                    const cellY = r * CELL_SIZE;

                    const inExclusion = this.exclusionAreas.some(area =>
                        cellX < area.x + area.width && cellX + CELL_SIZE > area.x &&
                        cellY < area.y + area.height && cellY + CELL_SIZE > area.y
                    );
                    if (inExclusion) continue;

                    const val = matrix[r][c];
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
        } else {
            // Canvas Mode
            const imgData = octx.getImageData(0, 0, w, h).data;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cellX = c * CELL_SIZE;
                    const cellY = r * CELL_SIZE;

                    const inExclusion = this.exclusionAreas.some(area =>
                        cellX < area.x + area.width && cellX + CELL_SIZE > area.x &&
                        cellY < area.y + area.height && cellY + CELL_SIZE > area.y
                    );
                    if (inExclusion) continue;

                    let totalBrightness = 0;
                    let count = 0;
                    for (let dy = 0; dy < CELL_SIZE; dy++) {
                        for (let dx = 0; dx < CELL_SIZE; dx++) {
                            const x = cellX + dx;
                            const y = cellY + dy;
                            if (x < w && y < h) {
                                const idx = (y * w + x) * 4;
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

    resize() {
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        if (this.activeAnimation) {
            if (typeof this.activeAnimation.setup === 'function') {
                this.activeAnimation.setup(this.canvas.width, this.canvas.height);
            } else if (typeof this.activeAnimation.init === 'function') {
                this.activeAnimation.init(this.canvas.width, this.canvas.height);
            }
            this.draw();
        }
    }
}
