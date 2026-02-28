/**
 * QuickLog-Solo: Canvas-based Animation Engine
 */

export class AnimationEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.activeAnimation = null;
        this.startTime = 0;
        this.color = '#1976d2';
        this.requestId = null;
        this.registry = new Map();
        this.cycleMs = 120000; // 2 minutes cycle
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
        this.activeAnimation.draw(this.ctx, this.canvas.width, this.canvas.height, progress, this.color);
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        if (this.activeAnimation) {
            this.draw();
        }
    }
}

// Group A: 「積み上げ・成長」を感じるアイデア

export class TetrisBuilding {
    draw(ctx, w, h, p, color) {
        const rows = 10;
        const cols = 6;
        const cellSize = Math.min(w / cols, h / rows);
        const xOffset = (w - (cols * cellSize)) / 2;
        const yOffset = (h - (rows * cellSize)) / 2;

        const totalBlocks = rows * cols;
        const blocksToDraw = Math.floor(p * totalBlocks);

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;

        for (let i = 0; i < blocksToDraw; i++) {
            const r = rows - 1 - Math.floor(i / cols);
            const c = i % cols;
            ctx.fillRect(xOffset + c * cellSize + 1, yOffset + r * cellSize + 1, cellSize - 2, cellSize - 2);
        }

        // Line clear effect at the end
        if (p > 0.95) {
            ctx.globalAlpha = (1 - p) * 10;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
        }
        ctx.globalAlpha = 1.0;
    }
}

export class PlantGrowth {
    draw(ctx, w, h, p, color) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        const centerX = w / 2;
        const bottomY = h - 20;
        const maxHeight = h * 0.6;

        // Stem
        const currentHeight = maxHeight * Math.min(p * 1.5, 1);
        ctx.beginPath();
        ctx.moveTo(centerX, bottomY);
        ctx.lineTo(centerX, bottomY - currentHeight);
        ctx.stroke();

        // Leaves
        if (p > 0.3) {
            const leafP = Math.min((p - 0.3) * 2, 1);
            ctx.beginPath();
            ctx.ellipse(centerX - 10, bottomY - maxHeight * 0.3, 10 * leafP, 5 * leafP, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        }
        if (p > 0.5) {
            const leafP = Math.min((p - 0.5) * 2, 1);
            ctx.beginPath();
            ctx.ellipse(centerX + 10, bottomY - maxHeight * 0.5, 10 * leafP, 5 * leafP, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Flower
        if (p > 0.8) {
            const flowerP = Math.min((p - 0.8) * 5, 1);
            ctx.globalAlpha = 0.6;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                const angle = (i * Math.PI * 2) / 5;
                ctx.ellipse(centerX + Math.cos(angle) * 10 * flowerP,
                            bottomY - currentHeight + Math.sin(angle) * 10 * flowerP,
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
    }
    draw(ctx, w, h, p, color) {
        ctx.fillStyle = color;
        ctx.font = "12px monospace";
        ctx.globalAlpha = 0.4;

        const rows = 5;
        const cols = 15;
        const totalChars = rows * cols;
        const charsToDraw = Math.floor(p * totalChars);

        for (let i = 0; i < charsToDraw; i++) {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const char = this.chars[i % this.chars.length];
            ctx.fillText(char, 20 + c * 15, 30 + r * 15);
        }

        // Cursor
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            const r = Math.floor(charsToDraw / cols);
            const c = charsToDraw % cols;
            ctx.fillRect(20 + c * 15, 30 + r * 15 - 10, 8, 12);
        }
        ctx.globalAlpha = 1.0;
    }
}

// Group B: 「物理的な心地よさ」を感じるアイデア

export class NewtonsCradle {
    draw(ctx, w, h, p, color) {
        const centerX = w / 2;
        const centerY = h / 3;
        const ballCount = 5;
        const ballRadius = 10;
        const stringLength = h / 2;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;

        // Amplitude varies with 2 min cycle
        const amplitude = Math.PI / 6 * (1 + 0.2 * Math.sin(p * Math.PI * 10));
        const time = Date.now() / 300;
        const angle = Math.sin(time);

        for (let i = 0; i < ballCount; i++) {
            let currentAngle = 0;
            if (i === 0 && angle < 0) currentAngle = angle * amplitude;
            if (i === ballCount - 1 && angle > 0) currentAngle = angle * amplitude;

            const x = centerX + (i - (ballCount - 1) / 2) * ballRadius * 2;
            const bx = x + Math.sin(currentAngle) * stringLength;
            const by = centerY + Math.cos(currentAngle) * stringLength;

            ctx.beginPath();
            ctx.moveTo(x, centerY);
            ctx.lineTo(bx, by);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(bx, by, ballRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 360 degree spin at the end
        if (p > 0.95) {
            const spinAngle = (p - 0.95) * 20 * Math.PI * 2;
            ctx.save();
            ctx.translate(centerX, centerY + stringLength / 2);
            ctx.rotate(spinAngle);
            ctx.globalAlpha = 0.2;
            ctx.fillRect(-w, -h, w * 2, h * 2);
            ctx.restore();
        }
    }
}

export class Ripple {
    draw(ctx, w, h, p, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        const centerX = w / 2;
        const centerY = h / 2;
        const maxRadius = Math.sqrt(w * w + h * h) / 2;

        const rippleCount = 5 + Math.floor(p * 20);
        const time = Date.now() / 1000;

        for (let i = 0; i < rippleCount; i++) {
            const offset = (i / rippleCount + time / 2) % 1;
            const radius = offset * maxRadius;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.globalAlpha = (1 - offset) * 0.5;
            ctx.stroke();
        }

        // Screen fill at the end
        if (p > 0.9) {
            ctx.fillStyle = color;
            ctx.globalAlpha = (p - 0.9) * 10;
            ctx.fillRect(0, 0, w, h);
        }
        ctx.globalAlpha = 1.0;
    }
}

export class LissajousPendulum {
    draw(ctx, w, h, p, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;

        const centerX = w / 2;
        const centerY = h / 2;
        const size = Math.min(w, h) * 0.4;

        const a = 3;
        const b = 2 + p; // Frequency ratio changes slowly
        const delta = Math.PI / 2;

        ctx.beginPath();
        for (let t = 0; t < Math.PI * 2; t += 0.05) {
            const x = centerX + size * Math.sin(a * t + delta);
            const y = centerY + size * Math.sin(b * t);
            if (t === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Trace trajectory
        const now = Date.now() / 1000;
        const tx = centerX + size * Math.sin(a * now + delta);
        const ty = centerY + size * Math.sin(b * now);
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 1.0;
        ctx.fill();
    }
}

// Group C: 「物語・旅」を感じるアイデア

export class MigratingBirds {
    draw(ctx, w, h, p, color) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;

        const birdCount = 7;
        const birdSize = 10;
        const spacing = 30;

        // V-shape movement from left to right over 2 minutes
        const xBase = -100 + (w + 200) * p;
        const yBase = h / 2;

        for (let i = 0; i < birdCount; i++) {
            const offset = i - Math.floor(birdCount / 2);
            const bx = xBase - Math.abs(offset) * spacing;
            const by = yBase + offset * spacing * 0.5;

            // Flapping wing
            const flap = Math.sin(Date.now() / 100 + i) * 5;

            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - birdSize, by - flap);
            ctx.lineTo(bx - birdSize * 0.5, by);
            ctx.lineTo(bx - birdSize, by + flap);
            ctx.fill();
        }
    }
}

export class CoffeeDrip {
    draw(ctx, w, h, p, color) {
        const centerX = w / 2;
        ctx.fillStyle = color;

        // Filter/Dripper shape
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(centerX - 30, 20);
        ctx.lineTo(centerX + 30, 20);
        ctx.lineTo(centerX + 5, 50);
        ctx.lineTo(centerX - 5, 50);
        ctx.closePath();
        ctx.fill();

        // Server/Pot shape
        ctx.beginPath();
        ctx.rect(centerX - 25, 60, 50, 40);
        ctx.stroke();

        // Drip droplets
        const dropP = (Date.now() / 1000) % 1;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(centerX, 50 + dropP * 30, 3, 0, Math.PI * 2);
        ctx.fill();

        // Filling coffee
        ctx.globalAlpha = 0.6;
        const fillHeight = 40 * p;
        ctx.fillRect(centerX - 24, 100 - fillHeight, 48, fillHeight);
    }
}

export class NightSky {
    draw(ctx, w, h, p, color) {
        const points = [
            {x: 0.2, y: 0.2}, {x: 0.3, y: 0.4}, {x: 0.5, y: 0.3},
            {x: 0.7, y: 0.5}, {x: 0.8, y: 0.2}, {x: 0.6, y: 0.7},
            {x: 0.4, y: 0.8}, {x: 0.2, y: 0.6}
        ];

        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        // Draw stars
        points.forEach((pt, i) => {
            const x = pt.x * w;
            const y = pt.y * h;
            const twinkle = Math.sin(Date.now() / 500 + i) * 0.5 + 0.5;
            ctx.globalAlpha = 0.3 + twinkle * 0.7;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw lines
        const linesToDraw = Math.floor(p * points.length);
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        for (let i = 0; i <= linesToDraw && i < points.length; i++) {
            const x = points[i].x * w;
            const y = points[i].y * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Reveal motif at the end
        if (p > 0.9) {
            ctx.globalAlpha = (p - 0.9) * 5;
            ctx.font = "40px serif";
            ctx.textAlign = "center";
            ctx.fillText("✨", w / 2, h / 2);
        }
    }
}

// Group D: 「抽象的・幾何学的」なアイデア

export class Kaleidoscope {
    draw(ctx, w, h, p, color) {
        const centerX = w / 2;
        const centerY = h / 2;
        const segments = 8;
        const time = Date.now() / 2000;

        ctx.fillStyle = color;

        for (let i = 0; i < segments; i++) {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate((i * Math.PI * 2) / segments + time);

            const size = 20 + 30 * Math.sin(p * Math.PI + i);
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
    draw(ctx, w, h, p, color) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;

        const lineCount = 10;
        const time = Date.now() / 3000;

        for (let i = 0; i < lineCount; i++) {
            const radius = 20 + i * 15 + Math.sin(time + i) * 10;
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 2; a += 0.2) {
                const noise = Math.sin(a * 3 + time + i) * 10 * p;
                const r = radius + noise;
                const x = w / 2 + Math.cos(a) * r;
                const y = h / 2 + Math.sin(a) * r;
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
    draw(ctx, w, h, p, color) {
        const fontSize = 14;
        const cols = Math.floor(w / fontSize);

        if (this.columns.length !== cols) {
            this.columns = Array(cols).fill(0).map(() => Math.random() * h);
        }

        ctx.fillStyle = color;
        ctx.font = fontSize + "px monospace";
        ctx.globalAlpha = 0.4 + p * 0.4;

        this.columns.forEach((y, i) => {
            const char = String.fromCharCode(0x30A0 + Math.random() * 96);
            ctx.fillText(char, i * fontSize, y);

            if (y > h && Math.random() > 0.975) {
                this.columns[i] = 0;
            } else {
                this.columns[i] += fontSize;
            }
        });
    }
}
