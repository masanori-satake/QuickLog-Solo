import { AnimationBase } from '../animation_base.js';

/**
 * Red-Cap Jumper & Dust Clouds
 * A classic retro side-scroller jump loop with particles.
 * 横スクロールアクションのキャラクターが、ジャンプする瞬間に縮み、放物線を描いて飛び上がります。
 * 着地時には砂煙（白い2ピクセルの四角）が左右に広がります。
 */
export default class RedCapJumper extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Red-Cap Jumper & Dust Clouds",
            ja: "ジャンプアクション",
            de: "Rotkappen-Springer & Staubwolken",
            es: "Saltador de gorra roja y nubes de polvo",
            fr: "Sauteur à casquette rouge et nuages de poussière",
            pt: "Saltador de boné vermelho e nuvens de poeira",
            ko: "빨간 모자 점퍼와 먼지 구름",
            zh: "红帽跳跃者与尘埃云"
        },
        description: {
            en: "A retro pixel hero leaps in a parabolic arc every 1.5 seconds, emitting tiny dust particles upon landing.",
            ja: "レトロなドット絵のヒーローが1.5秒ごとに跳躍し、着地時に足元から白い砂煙が左右に飛び散ります。",
            de: "Ein Retro-Pixel-Held springt alle 1,5 Sekunden in einem parabolischen Bogen und stößt beim Landen winzige Staubpartikel aus.",
            es: "Un héroe de píxeles retro salta en un arco parabólico cada 1,5 segundos, emitiendo pequeñas partículas de polvo al aterrizar.",
            fr: "Un héros rétro en pixel saut dans un arc parabolique toutes les 1,5 secondes, émettant de minuscules particules de poussière à l'atterrissage.",
            pt: "Um herói retro em pixel salta em um arco parabólico a cada 1,5 segundos, emitindo minúsculas partículas de poeira ao aterrissar.",
            ko: "레트로 픽셀 영웅이 1.5초마다 포물선을 그리며 도약하고, 착지할 때 미세한 먼지 입자를 뿜어냅니다.",
            zh: "一个复古像素英雄每1.5秒以抛物线弧度跃起，在落地时发射微小的尘埃粒子。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'jump' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        this.particles = [];
        this.groundY = 0;
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
        this.groundY = height - Math.max(12, height * 0.2);
        this.particles = [];
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;
        const groundY = this.groundY;

        // 1.5s loop cycle
        const cycleMs = 1500;
        const t = elapsedMs % cycleMs;

        let charY = groundY;
        let scaleX = 1.0;
        let scaleY = 1.0;
        let armUp = false;

        // States within 1.5s:
        // 0 - 300ms: Stand/IDLE
        // 300 - 500ms: Squash (Anticipation)
        // 500 - 1100ms: Parabolic Jump (600ms air time)
        // 1100 - 1250ms: Landing squash
        // 1250 - 1500ms: Stand/IDLE

        const jumpStart = 500;
        const jumpDuration = 600;
        const jumpEnd = jumpStart + jumpDuration;

        if (t >= 300 && t < jumpStart) {
            // Squash downward before jumping
            const factor = (t - 300) / 200; // 0 to 1
            scaleY = 1.0 - factor * 0.3;    // Squash to 0.7
            scaleX = 1.0 + factor * 0.2;    // Stretch wide
        } else if (t >= jumpStart && t < jumpEnd) {
            // Parabolic Arc: y = -4 * max_height * progress * (1 - progress)
            const progress = (t - jumpStart) / jumpDuration; // 0 to 1
            const maxHeight = Math.max(25, height * 0.4);
            const offset = maxHeight * 4 * progress * (1 - progress);
            charY = groundY - offset;

            armUp = true;
            if (progress < 0.2) {
                scaleY = 1.3; scaleX = 0.8; // Stretch up at start
            } else if (progress > 0.8) {
                scaleY = 1.1; scaleX = 0.9;
            } else {
                scaleY = 1.0; scaleX = 1.0;
            }
        } else if (t >= jumpEnd && t < jumpEnd + 150) {
            // Landing squash
            const progress = (t - jumpEnd) / 150; // 0 to 1
            scaleY = 1.0 - (1 - progress) * 0.25;
            scaleX = 1.0 + (1 - progress) * 0.15;

            // Trigger dust particles exactly at landing (exactly at jumpEnd)
            // We can check if particles are empty or trigger based on timestamp window
            if (this.particles.length === 0 && t < jumpEnd + 30) {
                this.particles.push({ x: width / 2, vx: -2, life: 150 });
                this.particles.push({ x: width / 2, vx: 2, life: 150 });
            }
        } else {
            // IDLE / Standing
            scaleX = 1.0;
            scaleY = 1.0;
            armUp = false;
        }

        // Reset particle trigger flag when not near landing
        if (t < jumpEnd || t > jumpEnd + 100) {
            this.particles = [];
        }

        // Draw ground line
        ctx.fillStyle = '#555';
        ctx.fillRect(0, groundY, width, 2);

        // Draw dust particles
        ctx.fillStyle = '#fff';
        this.particles.forEach(p => {
            p.x += p.vx;
            // Draw a tiny 2px dust particle
            ctx.fillRect(p.x - 1, groundY - 2, 2, 2);
        });

        // Draw character in the center
        const charX = width / 2;
        const charSize = Math.max(10, height * 0.15);

        ctx.save();
        ctx.translate(charX, charY);
        ctx.scale(scaleX, scaleY);

        // Head and Cap
        ctx.fillStyle = '#e57373'; // Red Cap
        ctx.fillRect(-3, -charSize - 5, 6, 2); // Cap dome
        ctx.fillRect(-3, -charSize - 3, 8, 1); // Cap visor
        ctx.fillStyle = '#ffd54f'; // Face skin tone
        ctx.fillRect(-3, -charSize - 2, 6, 4);  // Face

        // Body
        ctx.fillStyle = '#1976d2'; // Blue overalls / body
        ctx.fillRect(-4, -charSize + 2, 8, charSize - 2);

        // Arms
        ctx.fillStyle = '#e57373'; // Red sleeves
        if (armUp) {
            // One arm raised high, other down
            ctx.fillRect(-6, -charSize + 2, 2, 4); // Left arm down
            ctx.fillRect(4, -charSize - 4, 2, 6);  // Right arm up
        } else {
            // Both arms down
            ctx.fillRect(-6, -charSize + 3, 2, 4);
            ctx.fillRect(4, -charSize + 3, 2, 4);
        }

        // Feet
        ctx.fillStyle = '#795548'; // Brown shoes
        ctx.fillRect(-4, 0, 3, 1);
        ctx.fillRect(1, 0, 3, 1);

        ctx.restore();
    }
}
