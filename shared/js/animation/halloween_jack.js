import { AnimationBase } from '../animation_base.js';

/**
 * Halloween Animation
 * Halloween Jack-o'-lantern with a flickering candle inside on the left,
 * and fluttering bats flying on the right.
 * 左側にロウソクの火が揺らめくジャック・オー・ランタン（ハロウィンかぼちゃ）、
 * 右側にパタパタと飛び交うコウモリを描画するアニメーションです。
 */
export default class HalloweenJack extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Halloween",
            ja: "ハロウィン",
            de: "Halloween",
            es: "Halloween",
            fr: "Halloween",
            pt: "Halloween",
            ko: "할로윈",
            zh: "万圣节"
        },
        description: {
            en: "A flickering carved Jack-o'-lantern on the left with fluttering bats on the right.",
            ja: "左側にロウソクの火が揺らめくジャック・オー・ランタン、右側にパタパタ飛び交うコウモリを描画する待機用アニメーション。",
            de: "Ein flackernder Kürbis-Kopf (Jack-o'-lantern) links mit flatternden Fledermäusen rechts.",
            es: "Una calabaza de Halloween (Jack-o'-lantern) con vela parpadeante a la izquierda y murciélagos volando a la derecha.",
            fr: "Une citrouille d'Halloween (Jack-o'-lantern) scintillante à gauche avec des chauves-souris voletant à droite.",
            pt: "Uma abóbora de Halloween (Jack-o'-lantern) tremeluzente à esquerda com morcegos esvoaçantes à direita.",
            ko: "왼쪽에는 촛불이 일렁이는 잭오랜턴과 오른쪽에는 팔딱거리는 박쥐들이 떠다닙니다.",
            zh: "左侧是烛光摇曳的南瓜灯，右侧是上下扑腾的蝙蝠。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'mask' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        this.bats = [];
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.initBats();
    }

    initBats() {
        if (!this.width || !this.height) return;

        this.bats = [
            { speedX: 1.2, speedY: 0.8, phase: 0, size: 1.0 },
            { speedX: -0.9, speedY: 1.1, phase: Math.PI * 0.6, size: 0.8 },
            { speedX: 1.1, speedY: -0.7, phase: Math.PI * 1.2, size: 0.9 }
        ];
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;

        if (width <= 0 || height <= 0) return;

        // Base scaling factor relative to standard guide height (80px)
        const scale = Math.max(0.4, height / 80);

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';

        // --- 1. Draw Jack-o'-lantern on the Left Center ---
        const pumpkinX = Math.max(35 * scale, width * 0.18);
        const pumpkinY = height * 0.52;
        const radiusX = 18 * scale;
        const radiusY = 14 * scale;

        this.drawJackOLantern(ctx, pumpkinX, pumpkinY, radiusX, radiusY, elapsedMs, scale);

        // --- 2. Draw Fluttering Bats on the Right Side ---
        this.updateAndDrawBats(ctx, elapsedMs, scale);
    }

    drawJackOLantern(ctx, cx, cy, rx, ry, elapsedMs, scale) {
        ctx.save();

        // Pumpkin Stem
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.beginPath();
        ctx.moveTo(cx, cy - ry + 1 * scale);
        ctx.quadraticCurveTo(cx + 3 * scale, cy - ry - 6 * scale, cx + 5 * scale, cy - ry - 7 * scale);
        ctx.stroke();

        // Pumpkin Outer Body (main rounded ellipse)
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Pumpkin Segment Ribs (inner curves for 3D pumpkin texture)
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 0.65, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 0.3, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Candle Flame Flickering inside (Flicker effect using sine waves and noise simulation)
        const flickerTime = elapsedMs * 0.008;
        const flickerAlpha = 0.6 + 0.4 * Math.sin(flickerTime) * Math.cos(flickerTime * 1.73);
        const flameOffset = Math.sin(flickerTime * 2.5) * 1.2 * scale;

        // Carved Eye L (Triangle)
        const eyeW = 4 * scale;
        const eyeH = 4 * scale;
        const leftEyeX = cx - rx * 0.4;
        const eyeY = cy - ry * 0.2;

        ctx.globalAlpha = flickerAlpha;
        ctx.beginPath();
        ctx.moveTo(leftEyeX - eyeW / 2, eyeY + eyeH / 2);
        ctx.lineTo(leftEyeX + eyeW / 2, eyeY + eyeH / 2);
        ctx.lineTo(leftEyeX, eyeY - eyeH / 2);
        ctx.closePath();
        ctx.fill();

        // Carved Eye R (Triangle)
        const rightEyeX = cx + rx * 0.4;
        ctx.beginPath();
        ctx.moveTo(rightEyeX - eyeW / 2, eyeY + eyeH / 2);
        ctx.lineTo(rightEyeX + eyeW / 2, eyeY + eyeH / 2);
        ctx.lineTo(rightEyeX, eyeY - eyeH / 2);
        ctx.closePath();
        ctx.fill();

        // Carved Nose (Small inverted triangle)
        const noseY = cy + 0.5 * scale;
        const noseW = 2.5 * scale;
        const noseH = 2.5 * scale;
        ctx.beginPath();
        ctx.moveTo(cx, noseY + noseH / 2);
        ctx.lineTo(cx - noseW / 2, noseY - noseH / 2);
        ctx.lineTo(cx + noseW / 2, noseY - noseH / 2);
        ctx.closePath();
        ctx.fill();

        // Carved Toothy Mouth
        const mouthY = cy + ry * 0.35;
        const mouthW = rx * 1.1;

        ctx.beginPath();
        ctx.moveTo(cx - mouthW / 2, mouthY);
        // Jagged teeth curve
        ctx.lineTo(cx - mouthW * 0.3, mouthY + 3 * scale + flameOffset * 0.3);
        ctx.lineTo(cx - mouthW * 0.2, mouthY + 1 * scale);
        ctx.lineTo(cx, mouthY + 4 * scale);
        ctx.lineTo(cx + mouthW * 0.2, mouthY + 1 * scale);
        ctx.lineTo(cx + mouthW * 0.3, mouthY + 3 * scale + flameOffset * 0.3);
        ctx.lineTo(cx + mouthW / 2, mouthY);
        ctx.lineTo(cx + mouthW * 0.3, mouthY - 1 * scale);
        ctx.lineTo(cx + mouthW * 0.15, mouthY + 1 * scale);
        ctx.lineTo(cx, mouthY - 1 * scale);
        ctx.lineTo(cx - mouthW * 0.15, mouthY + 1 * scale);
        ctx.lineTo(cx - mouthW * 0.3, mouthY - 1 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    updateAndDrawBats(ctx, elapsedMs, scale) {
        if (!this.bats || this.bats.length === 0) {
            this.initBats();
        }

        const minX = this.width * 0.55;
        const maxX = Math.max(minX + 10, this.width - 15 * scale);
        const minY = 10 * scale;
        const maxY = Math.max(minY + 10, this.height - 10 * scale);

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;

        for (const bat of this.bats) {
            // Deterministic flight position derived directly from elapsedMs
            const angleX = elapsedMs * 0.001 * bat.speedX + bat.phase;
            const angleY = elapsedMs * 0.0012 * bat.speedY + bat.phase * 1.5;

            const batX = minX + (Math.sin(angleX) * 0.5 + 0.5) * rangeX;
            const batY = minY + (Math.sin(angleY) * 0.5 + 0.5) * rangeY;

            // Velocity direction for horizontal flipping
            const dirX = Math.cos(angleX) * bat.speedX;

            // Wing flap animation cycle (faster flapping speed)
            const flapAngle = Math.sin(elapsedMs * 0.02 + bat.phase) * 0.6; // -0.6 to +0.6 rad

            ctx.save();
            ctx.translate(batX, batY);
            ctx.scale(bat.size * scale, bat.size * scale);
            if (dirX < 0) {
                ctx.scale(-1, 1); // Flip horizontally depending on flight direction
            }

            // Bat body (small oval/head)
            ctx.beginPath();
            ctx.ellipse(0, 0, 2.5, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Bat ears
            ctx.beginPath();
            ctx.moveTo(-1.5, -3);
            ctx.lineTo(-3, -6);
            ctx.lineTo(-0.5, -4);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(1.5, -3);
            ctx.lineTo(3, -6);
            ctx.lineTo(0.5, -4);
            ctx.fill();

            // Left Wing
            ctx.save();
            ctx.rotate(flapAngle);
            ctx.beginPath();
            ctx.moveTo(0, -1);
            ctx.quadraticCurveTo(-6, -8, -12, -2);
            ctx.quadraticCurveTo(-8, -1, -5, 2);
            ctx.quadraticCurveTo(-3, 0, 0, 1);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Right Wing
            ctx.save();
            ctx.rotate(-flapAngle);
            ctx.beginPath();
            ctx.moveTo(0, -1);
            ctx.quadraticCurveTo(6, -8, 12, -2);
            ctx.quadraticCurveTo(8, -1, 5, 2);
            ctx.quadraticCurveTo(3, 0, 0, 1);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            ctx.restore();
        }
    }
}
