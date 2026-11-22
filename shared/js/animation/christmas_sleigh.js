import { AnimationBase } from '../animation_base.js';

/**
 * Christmas Sleigh Animation
 * Santa's sleigh pulled by a reindeer glides across the whole width of
 * the display over one 120-second cycle, leaving a fading trail of
 * stardust behind it. Small stars twinkle in the sky.
 * トナカイに引かれたサンタのそりが、120秒周期で画面をゆっくり横切り、
 * 後ろに消えていく星屑の軌跡を引くアニメーションです。
 *
 * Design notes (why this shape):
 * - The pause display is a wide, short strip, so a horizontally moving
 *   silhouette reads better in dots than a tall motif would.
 * - The sleigh, Santa and the reindeer are drawn as one bold filled
 *   silhouette; fine detail would be lost when sampled into 6px cells.
 * - Everything is a pure function of elapsedMs (rewindable): the trail
 *   sparkles are recomputed from the sleigh's past positions.
 */
export default class ChristmasSleigh extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Santa's Sleigh",
            ja: 'サンタのそり',
            de: 'Weihnachtsschlitten',
            es: 'Trineo de Santa',
            fr: 'Traîneau du Père Noël',
            pt: 'Trenó do Papai Noel',
            ko: '산타의 썰매',
            zh: '圣诞老人的雪橇'
        },
        description: {
            en: "Santa's sleigh pulled by a reindeer glides across the night sky, leaving a trail of twinkling stardust.",
            ja: 'トナカイに引かれたサンタのそりが、きらめく星屑の軌跡を残しながら夜空を横切る待機用アニメーション。',
            de: 'Der Schlitten des Weihnachtsmanns gleitet, von einem Rentier gezogen, über den Nachthimmel und hinterlässt eine Spur aus Sternenstaub.',
            es: 'El trineo de Santa, tirado por un reno, cruza el cielo nocturno dejando una estela de polvo de estrellas.',
            fr: 'Le traîneau du Père Noël, tiré par un renne, traverse le ciel nocturne en laissant une traînée de poussière d’étoiles.',
            pt: 'O trenó do Papai Noel, puxado por uma rena, cruza o céu noturno deixando um rastro de poeira de estrelas.',
            ko: '순록이 끄는 산타의 썰매가 반짝이는 별가루를 남기며 밤하늘을 가로지르는 대기용 애니메이션.',
            zh: '驯鹿拉着圣诞老人的雪橇划过夜空，身后留下一串闪烁的星尘。'
        },
        author: 'QuickLog-Solo',
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'mask' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        // Fixed star field (positions are fractions of the viewport so
        // the same sky appears at any width).
        this.stars = [];
        for (let i = 0; i < 12; i++) {
            this.stars.push({
                fx: (Math.sin(i * 127.1) * 0.5 + 0.5) * 0.96 + 0.02,
                fy: (Math.sin(i * 311.7) * 0.5 + 0.5) * 0.55 + 0.04,
                phase: i * 1.37,
                speed: 0.6 + (i % 4) * 0.23
            });
        }
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
    }

    // Horizontal position of the sleigh group centre at a given time.
    // The group starts fully off-screen left and ends fully off-screen
    // right within one 120 s cycle.
    sleighXAt(elapsedMs, scale) {
        const cycleMs = 120000;
        const progress = (((elapsedMs % cycleMs) + cycleMs) % cycleMs) / cycleMs;
        const margin = 95 * scale;
        return -margin + progress * (this.width + margin * 2);
    }

    sleighYAt(elapsedMs, scale) {
        return this.height * 0.44 + Math.sin(elapsedMs * 0.0011) * 3 * scale;
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;

        if (width <= 0 || height <= 0) return;

        // Base scaling factor relative to standard guide height (80px)
        const scale = Math.max(0.4, height / 80);

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';

        // --- 1. Twinkling stars in the sky ---
        this.drawStars(ctx, elapsedMs, scale);

        // --- 2. Fading stardust trail behind the sleigh ---
        this.drawTrail(ctx, elapsedMs, scale);

        // --- 3. The sleigh group ---
        const cx = this.sleighXAt(elapsedMs, scale);
        const cy = this.sleighYAt(elapsedMs, scale);
        const rock = Math.sin(elapsedMs * 0.0011 + 0.6) * 0.03;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rock);
        ctx.scale(scale, scale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        this.drawReindeer(ctx, elapsedMs);
        this.drawSleigh(ctx);

        ctx.restore();
    }

    drawStars(ctx, elapsedMs, scale) {
        for (const star of this.stars) {
            const twinkle = 0.5 + 0.5 * Math.sin(elapsedMs * 0.001 * star.speed + star.phase);
            const alpha = 0.15 + 0.55 * twinkle;
            const r = (1.1 + twinkle * 0.9) * scale;
            const x = star.fx * this.width;
            const y = star.fy * this.height;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            // Four-point sparkle
            ctx.moveTo(x, y - r * 1.8);
            ctx.quadraticCurveTo(x, y, x + r * 1.8, y);
            ctx.quadraticCurveTo(x, y, x, y + r * 1.8);
            ctx.quadraticCurveTo(x, y, x - r * 1.8, y);
            ctx.quadraticCurveTo(x, y, x, y - r * 1.8);
            ctx.fill();
            ctx.restore();
        }
    }

    drawTrail(ctx, elapsedMs, scale) {
        const count = 16;
        for (let k = 1; k <= count; k++) {
            // Where the sleigh was k steps ago (deterministic, rewindable)
            const pastMs = elapsedMs - k * 420;
            const x = this.sleighXAt(pastMs, scale) - 34 * scale;
            const y =
                this.sleighYAt(pastMs, scale) +
                8 * scale +
                Math.sin(k * 12.9898) * 5 * scale +
                k * 0.55 * scale;
            const fade = 1 - k / (count + 1);
            const r = (0.7 + fade * 1.1) * scale;

            ctx.save();
            ctx.globalAlpha = 0.75 * fade;
            ctx.beginPath();
            ctx.moveTo(x, y - r * 1.7);
            ctx.quadraticCurveTo(x, y, x + r * 1.7, y);
            ctx.quadraticCurveTo(x, y, x, y + r * 1.7);
            ctx.quadraticCurveTo(x, y, x - r * 1.7, y);
            ctx.quadraticCurveTo(x, y, x, y - r * 1.7);
            ctx.fill();
            ctx.restore();
        }
    }

    // The reindeer is drawn around local origin at the front (right) of
    // the group, facing right, in units of the group scale.
    drawReindeer(ctx, elapsedMs) {
        const trot = Math.sin(elapsedMs * 0.011);

        ctx.save();
        ctx.translate(30, -3);

        // Legs (gallop pose, alternating slightly with the trot cycle)
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        // Front legs reach forward
        ctx.moveTo(7, 3);
        ctx.lineTo(13 + trot * 1.5, 10);
        ctx.moveTo(5, 3);
        ctx.lineTo(9 - trot * 1.5, 11);
        // Back legs push backward
        ctx.moveTo(-7, 3);
        ctx.lineTo(-13 - trot * 1.5, 10);
        ctx.moveTo(-5, 3);
        ctx.lineTo(-9 + trot * 1.5, 11);
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, 11.5, 6.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail
        ctx.beginPath();
        ctx.moveTo(-11, -3);
        ctx.lineTo(-14.5, -6);
        ctx.lineTo(-10.5, 0.5);
        ctx.closePath();
        ctx.fill();

        // Neck up to the head
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(9, -3);
        ctx.lineTo(14.5, -9.5);
        ctx.stroke();

        // Head
        ctx.save();
        ctx.translate(16.5, -10.5);
        ctx.rotate(0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.4, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Muzzle
        ctx.beginPath();
        ctx.ellipse(5.2, 0.8, 2.2, 1.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Antlers: one main beam with two tines, plus a smaller front point
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(13.5, -13);
        ctx.quadraticCurveTo(15, -18, 13.5, -22);
        ctx.moveTo(14.3, -16.5);
        ctx.lineTo(18.5, -19);
        ctx.moveTo(14.2, -19.5);
        ctx.lineTo(17.5, -23);
        ctx.moveTo(15.5, -12.5);
        ctx.quadraticCurveTo(18, -15, 20.5, -15.5);
        ctx.stroke();

        ctx.restore();
    }

    // The sleigh with Santa sits behind (left of) the reindeer.
    drawSleigh(ctx) {
        ctx.save();
        ctx.translate(-24, 0);

        // Runner with the classic front curl (kept bold: a thin line
        // all but disappears when sampled into 6px dots)
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-17, 12.5);
        ctx.lineTo(14, 12.5);
        ctx.quadraticCurveTo(20, 12.5, 20.5, 7);
        ctx.quadraticCurveTo(21, 3, 17.5, 2.5);
        ctx.stroke();
        // Struts
        ctx.beginPath();
        ctx.moveTo(-11, 12.5);
        ctx.lineTo(-10, 7);
        ctx.moveTo(9, 12.5);
        ctx.lineTo(8, 7);
        ctx.stroke();

        // Sleigh body: high back on the left, sweeping down to the front
        ctx.beginPath();
        ctx.moveTo(-16, -6);
        ctx.quadraticCurveTo(-17, 2, -13, 7);
        ctx.lineTo(10, 7);
        ctx.quadraticCurveTo(15, 6.5, 15.5, 1);
        ctx.quadraticCurveTo(15.8, -2, 12.5, -2.3);
        ctx.quadraticCurveTo(2, -0.7, -6, -1.7);
        ctx.quadraticCurveTo(-12, -2.3, -13.5, -6.5);
        ctx.closePath();
        ctx.fill();

        // Sack of presents behind Santa, kept low and to the back so it
        // does not merge with Santa's head in the dot sampling
        ctx.beginPath();
        ctx.ellipse(-12.5, -5.5, 5.0, 5.6, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-14.5, -10);
        ctx.lineTo(-10.5, -10);
        ctx.lineTo(-12.5, -7.2);
        ctx.closePath();
        ctx.fill();

        // Santa sits high so his head and hat clear the sleigh body and
        // the sack: round body, head, beard, and a floppy hat
        ctx.beginPath();
        ctx.ellipse(0, -7.5, 6.2, 7.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.ellipse(0.5, -18, 4.4, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Beard
        ctx.beginPath();
        ctx.ellipse(1.3, -14.7, 3.6, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Hat: brim and a tip that flops backward with a pompom
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-3.7, -20.8);
        ctx.lineTo(4.7, -20.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-2.9, -21.3);
        ctx.quadraticCurveTo(-0.5, -27, -6, -28);
        ctx.quadraticCurveTo(-8.5, -28.3, -9.3, -26.3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-9.4, -25.7, 1.9, 1.9, 0, 0, Math.PI * 2);
        ctx.fill();
        // Arm reaching forward toward the reins
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(4, -9);
        ctx.quadraticCurveTo(8.5, -7.5, 12, -5.5);
        ctx.stroke();

        ctx.restore();

        // Reins from Santa's hand to the reindeer
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-12, -5.5);
        ctx.quadraticCurveTo(2, -9, 17, -8.5);
        ctx.stroke();
    }
}
