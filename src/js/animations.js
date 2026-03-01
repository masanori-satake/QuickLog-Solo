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
        if (typeof this.activeAnimation.init === 'function') {
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
        // Passing both static and dynamic parameters in params for convenience
        const params = {
            width: w,
            height: h,
            elapsedMs,
            progress,
            step: Math.floor(progress * 240),
            color: '#fff',
            exclusionAreas: this.exclusionAreas
        };
        this.activeAnimation.draw(octx, params);

        const imgData = octx.getImageData(0, 0, w, h).data;

        this.ctx.fillStyle = this.color;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellX = c * CELL_SIZE;
                const cellY = r * CELL_SIZE;

                // Optimization: Skip brightness calculation if the cell is in an exclusion area
                // A cell overlaps with an exclusion area if:
                // cell_start_x < area_end_x AND cell_end_x > area_start_x
                const inExclusion = this.exclusionAreas.some(area =>
                    cellX < area.x + area.width && cellX + CELL_SIZE > area.x &&
                    cellY < area.y + area.height && cellY + CELL_SIZE > area.y
                );

                if (inExclusion) continue;

                // Average brightness of the cell
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
                if (brightness > BRIGHTNESS_HIGH) dotSize = DOT_SIZE_LARGE;      // 大ドット
                else if (brightness > BRIGHTNESS_MID) dotSize = DOT_SIZE_MID;  // 中ドット
                else if (brightness > BRIGHTNESS_LOW) dotSize = DOT_SIZE_SMALL;  // 小ドット

                if (dotSize > 0) {
                    const dotX = cellX + (CELL_SIZE - dotSize) / 2;
                    const dotY = cellY + (CELL_SIZE - dotSize) / 2;
                    this.ctx.fillRect(dotX, dotY, dotSize, dotSize);
                }
            }
        }
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        if (this.activeAnimation && typeof this.activeAnimation.init === 'function') {
            this.activeAnimation.init(this.canvas.width, this.canvas.height);
        }
        if (this.activeAnimation) {
            this.draw();
        }
    }
}

// Basic Animations

export class LeftToRight {
    draw(ctx, { width, height, progress, color }) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width * progress, height);
    }
}

export class RightToLeft {
    draw(ctx, { width, height, progress, color }) {
        ctx.fillStyle = color;
        ctx.fillRect(width * (1 - progress), 0, width * progress, height);
    }
}

export class Clock {
    init(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.radius = Math.min(width, height) * 0.4;
    }
    draw(ctx, { progress, color }) {
        const angle = progress * Math.PI * 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY);
        ctx.arc(this.centerX, this.centerY, this.radius, -Math.PI / 2, -Math.PI / 2 + angle);
        ctx.closePath();
        ctx.fill();
    }
}

export class SandClock {
    init(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.size = Math.min(width, height) * 0.4;
    }
    draw(ctx, { progress, color }) {
        ctx.fillStyle = color;

        // Top triangle (emptying)
        ctx.beginPath();
        ctx.moveTo(this.centerX - this.size, this.centerY - this.size);
        ctx.lineTo(this.centerX + this.size, this.centerY - this.size);
        ctx.lineTo(this.centerX, this.centerY);
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(this.centerX - this.size, this.centerY - this.size, this.size * 2, this.size * progress);
        ctx.globalCompositeOperation = 'source-over';

        // Bottom triangle (filling)
        ctx.beginPath();
        ctx.moveTo(this.centerX - this.size, this.centerY + this.size);
        ctx.lineTo(this.centerX + this.size, this.centerY + this.size);
        ctx.lineTo(this.centerX, this.centerY);
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillRect(this.centerX - this.size, this.centerY + this.size - this.size * progress, this.size * 2, this.size * progress);
        ctx.globalCompositeOperation = 'source-over';
    }
}

// Group A: 「積み上げ・成長」を感じるアイデア

export class TetrisBuilding {
    init(width, height) {
        this.rows = 10;
        this.cols = 6;
        this.cellSize = Math.min(width / this.cols, height / this.rows);
        this.xOffset = (width - (this.cols * this.cellSize)) / 2;
        this.yOffset = (height - (this.rows * this.cellSize)) / 2;
    }

    draw(ctx, { width, height, progress, color }) {
        const totalBlocks = this.rows * this.cols;
        const blocksToDraw = Math.floor(progress * totalBlocks);

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;

        for (let i = 0; i < blocksToDraw; i++) {
            const r = this.rows - 1 - Math.floor(i / this.cols);
            const c = i % this.cols;
            ctx.fillRect(this.xOffset + c * this.cellSize + 1, this.yOffset + r * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2);
        }

        // Line clear effect at the end
        if (progress > 0.95) {
            ctx.globalAlpha = (1 - progress) * 10;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, height);
        }
        ctx.globalAlpha = 1.0;
    }
}

export class PlantGrowth {
    init(width, height) {
        this.centerX = width / 2;
        this.bottomY = height - 20;
        this.maxHeight = height * 0.6;
    }

    draw(ctx, { progress, color }) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        // Stem
        const currentHeight = this.maxHeight * Math.min(progress * 1.5, 1);
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.bottomY);
        ctx.lineTo(this.centerX, this.bottomY - currentHeight);
        ctx.stroke();

        // Leaves
        if (progress > 0.3) {
            const leafP = Math.min((progress - 0.3) * 2, 1);
            ctx.beginPath();
            ctx.ellipse(this.centerX - 10, this.bottomY - this.maxHeight * 0.3, 10 * leafP, 5 * leafP, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        }
        if (progress > 0.5) {
            const leafP = Math.min((progress - 0.5) * 2, 1);
            ctx.beginPath();
            ctx.ellipse(this.centerX + 10, this.bottomY - this.maxHeight * 0.5, 10 * leafP, 5 * leafP, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Flower
        if (progress > 0.8) {
            const flowerP = Math.min((progress - 0.8) * 5, 1);
            ctx.globalAlpha = 0.6;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                const angle = (i * Math.PI * 2) / 5;
                ctx.ellipse(this.centerX + Math.cos(angle) * 10 * flowerP,
                            this.bottomY - currentHeight + Math.sin(angle) * 10 * flowerP,
                            8 * flowerP, 4 * flowerP, angle, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        }
    }
}

export class DotTyping {
    constructor() {
        this.chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
        this.rows = 5;
        this.cols = 15;
    }
    draw(ctx, { progress, color }) {
        ctx.fillStyle = color;
        ctx.font = "12px monospace";
        ctx.globalAlpha = 0.7;

        const totalChars = this.rows * this.cols;
        const charsToDraw = Math.floor(progress * totalChars);

        for (let i = 0; i < charsToDraw; i++) {
            const r = Math.floor(i / this.cols);
            const c = i % this.cols;
            const char = this.chars[i % this.chars.length];
            ctx.fillText(char, 20 + c * 15, 30 + r * 15);
        }

        // Cursor
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            const r = Math.floor(charsToDraw / this.cols);
            const c = charsToDraw % this.cols;
            ctx.fillRect(20 + c * 15, 30 + r * 15 - 10, 8, 12);
        }
        ctx.globalAlpha = 1.0;
    }
}

// Group B: 「物理的な心地よさ」を感じるアイデア

export class NewtonsCradle {
    init(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 3;
        this.ballCount = 5;
        this.ballRadius = 10;
        this.stringLength = height / 2;
    }

    draw(ctx, { width, height, progress, color }) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;

        // Amplitude varies with 2 min cycle
        const amplitude = Math.PI / 6 * (1 + 0.2 * Math.sin(progress * Math.PI * 10));
        const time = Date.now() / 300;
        const angle = Math.sin(time);

        for (let i = 0; i < this.ballCount; i++) {
            let currentAngle = 0;
            if (i === 0 && angle < 0) currentAngle = angle * amplitude;
            if (i === this.ballCount - 1 && angle > 0) currentAngle = angle * amplitude;

            const x = this.centerX + (i - (this.ballCount - 1) / 2) * this.ballRadius * 2;
            const bx = x + Math.sin(currentAngle) * this.stringLength;
            const by = this.centerY + Math.cos(currentAngle) * this.stringLength;

            ctx.beginPath();
            ctx.moveTo(x, this.centerY);
            ctx.lineTo(bx, by);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(bx, by, this.ballRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 360 degree spin at the end
        if (progress > 0.95) {
            const spinAngle = (progress - 0.95) * 20 * Math.PI * 2;
            ctx.save();
            ctx.translate(this.centerX, this.centerY + this.stringLength / 2);
            ctx.rotate(spinAngle);
            ctx.globalAlpha = 0.2;
            ctx.fillRect(-width, -height, width * 2, height * 2);
            ctx.restore();
        }
    }
}

export class Ripple {
    init(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.maxRadius = Math.sqrt(width * width + height * height) / 2;
    }

    draw(ctx, { width, height, progress, color }) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        const rippleCount = 5 + Math.floor(progress * 20);
        const time = Date.now() / 1000;

        for (let i = 0; i < rippleCount; i++) {
            const offset = (i / rippleCount + time / 2) % 1;
            const radius = offset * this.maxRadius;
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
            ctx.globalAlpha = (1 - offset) * 0.5;
            ctx.stroke();
        }

        // Screen fill at the end
        if (progress > 0.9) {
            ctx.fillStyle = color;
            ctx.globalAlpha = (progress - 0.9) * 10;
            ctx.fillRect(0, 0, width, height);
        }
        ctx.globalAlpha = 1.0;
    }
}

export class LissajousPendulum {
    init(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.size = Math.min(width, height) * 0.4;
    }

    draw(ctx, { progress, color }) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;

        const a = 3;
        const b = 2 + progress; // Frequency ratio changes slowly
        const delta = Math.PI / 2;

        ctx.beginPath();
        for (let t = 0; t < Math.PI * 2; t += 0.05) {
            const x = this.centerX + this.size * Math.sin(a * t + delta);
            const y = this.centerY + this.size * Math.sin(b * t);
            if (t === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Trace trajectory
        const now = Date.now() / 1000;
        const tx = this.centerX + this.size * Math.sin(a * now + delta);
        const ty = this.centerY + this.size * Math.sin(b * now);
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 1.0;
        ctx.fill();
    }
}

// Group C: 「物語・旅」を感じるアイデア

export class MigratingBirds {
    init(width, height) {
        this.w = width;
        this.h = height;
        this.yBase = height / 2;
        this.birdCount = 7;
        this.birdSize = 10;
        this.spacing = 30;
    }

    draw(ctx, { progress, color }) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;

        // V-shape movement from left to right over 2 minutes
        const xBase = -100 + (this.w + 200) * progress;

        for (let i = 0; i < this.birdCount; i++) {
            const offset = i - Math.floor(this.birdCount / 2);
            const bx = xBase - Math.abs(offset) * this.spacing;
            const by = this.yBase + offset * this.spacing * 0.5;

            // Flapping wing
            const flap = Math.sin(Date.now() / 100 + i) * 5;

            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - this.birdSize, by - flap);
            ctx.lineTo(bx - this.birdSize * 0.5, by);
            ctx.lineTo(bx - this.birdSize, by + flap);
            ctx.fill();
        }
    }
}

export class CoffeeDrip {
    init(width, height) {
        this.centerX = width / 2;
    }

    draw(ctx, { progress, color }) {
        ctx.fillStyle = color;

        // Filter/Dripper shape
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(this.centerX - 30, 20);
        ctx.lineTo(this.centerX + 30, 20);
        ctx.lineTo(this.centerX + 5, 50);
        ctx.lineTo(this.centerX - 5, 50);
        ctx.closePath();
        ctx.fill();

        // Server/Pot shape
        ctx.beginPath();
        ctx.rect(this.centerX - 25, 60, 50, 40);
        ctx.stroke();

        // Drip droplets
        const dropP = (Date.now() / 1000) % 1;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(this.centerX, 50 + dropP * 30, 3, 0, Math.PI * 2);
        ctx.fill();

        // Filling coffee
        ctx.globalAlpha = 0.6;
        const fillHeight = 40 * progress;
        ctx.fillRect(this.centerX - 24, 100 - fillHeight, 48, fillHeight);
    }
}

export class NightSky {
    constructor() {
        this.points = [
            {x: 0.2, y: 0.2}, {x: 0.3, y: 0.4}, {x: 0.5, y: 0.3},
            {x: 0.7, y: 0.5}, {x: 0.8, y: 0.2}, {x: 0.6, y: 0.7},
            {x: 0.4, y: 0.8}, {x: 0.2, y: 0.6}
        ];
    }
    init(width, height) {
        this.w = width;
        this.h = height;
    }
    draw(ctx, { progress, color }) {
        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        // Draw stars
        this.points.forEach((pt, i) => {
            const x = pt.x * this.w;
            const y = pt.y * this.h;
            const twinkle = Math.sin(Date.now() / 500 + i) * 0.5 + 0.5;
            ctx.globalAlpha = 0.3 + twinkle * 0.7;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw lines
        const linesToDraw = Math.floor(progress * this.points.length);
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        for (let i = 0; i <= linesToDraw && i < this.points.length; i++) {
            const x = this.points[i].x * this.w;
            const y = this.points[i].y * this.h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Reveal motif at the end
        if (progress > 0.9) {
            ctx.globalAlpha = (progress - 0.9) * 5;
            ctx.font = "40px serif";
            ctx.textAlign = "center";
            ctx.fillText("✨", this.w / 2, this.h / 2);
        }
    }
}

// Group D: 「抽象的・幾何学的」なアイデア

export class Kaleidoscope {
    init(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;
        this.segments = 8;
    }

    draw(ctx, { progress, color }) {
        const time = Date.now() / 2000;
        ctx.fillStyle = color;

        for (let i = 0; i < this.segments; i++) {
            ctx.save();
            ctx.translate(this.centerX, this.centerY);
            ctx.rotate((i * Math.PI * 2) / this.segments + time);

            const size = 20 + 30 * Math.sin(progress * Math.PI + i);
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(size, size);
            ctx.lineTo(size * 1.5, 0);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }
}

export class ContourLines {
    init(width, height) {
        this.width = width;
        this.height = height;
        this.lineCount = 10;
    }

    draw(ctx, { progress, color }) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;

        const time = Date.now() / 3000;

        for (let i = 0; i < this.lineCount; i++) {
            const radius = 20 + i * 15 + Math.sin(time + i) * 10;
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 2; a += 0.2) {
                const noise = Math.sin(a * 3 + time + i) * 10 * progress;
                const r = radius + noise;
                const x = this.width / 2 + Math.cos(a) * r;
                const y = this.height / 2 + Math.sin(a) * r;
                if (a === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }
}

export class MatrixCode {
    constructor() {
        this.columns = [];
    }
    init(width, height) {
        const fontSize = 14;
        const cols = Math.floor(width / fontSize);
        if (this.columns.length !== cols) {
            this.columns = Array(cols).fill(0).map(() => Math.random() * height);
        }
    }
    draw(ctx, { height, progress, color }) {
        const fontSize = 14;
        ctx.fillStyle = color;
        ctx.font = fontSize + "px monospace";
        ctx.globalAlpha = 0.4 + progress * 0.4;

        this.columns.forEach((y, i) => {
            const char = String.fromCharCode(0x30A0 + Math.random() * 96);
            ctx.fillText(char, i * fontSize, y);

            if (y > height && Math.random() > 0.975) {
                this.columns[i] = 0;
            } else {
                this.columns[i] += fontSize;
            }
        });
    }
}
