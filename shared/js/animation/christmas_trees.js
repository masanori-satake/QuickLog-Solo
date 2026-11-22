import { AnimationBase } from '../animation_base.js';

/**
 * Christmas Trees Animation
 * A Christmas tree stands at each end of the display, following the
 * left/right layout of the Halloween animation. Ornaments twinkle by
 * fading in and out, and the star on top of each tree breathes slowly.
 * 画面の左右の端にクリスマスツリーが1本ずつ立つアニメーションです。
 * オーナメントが明暗で瞬き、てっぺんの星がゆっくりと明滅します。
 *
 * Design notes (why this shape):
 * - A triangle silhouette is the shape that survives 6px dot sampling
 *   best, so the trees stay recognisable at any panel width.
 * - Trees sit at the far left and right so the centre display (work
 *   category and elapsed time) is never covered.
 * - Everything is a pure function of elapsedMs (rewindable).
 */
export default class ChristmasTrees extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: 'Christmas Trees',
            ja: 'クリスマスツリー',
            de: 'Weihnachtsbäume',
            es: 'Árboles de Navidad',
            fr: 'Sapins de Noël',
            pt: 'Árvores de Natal',
            ko: '크리스마스 트리',
            zh: '圣诞树'
        },
        description: {
            en: 'Two Christmas trees stand at either side, their ornaments twinkling softly and the stars on top glowing gently.',
            ja: '左右に立つ2本のクリスマスツリー。オーナメントが静かに瞬き、てっぺんの星が淡く光る待機用アニメーション。',
            de: 'Zwei Weihnachtsbäume stehen links und rechts, ihre Kugeln funkeln sanft und die Sterne an der Spitze leuchten.',
            es: 'Dos árboles de Navidad a cada lado, con adornos que parpadean suavemente y estrellas brillando en la copa.',
            fr: 'Deux sapins de Noël de chaque côté, leurs décorations scintillent doucement et les étoiles brillent au sommet.',
            pt: 'Duas árvores de Natal, uma de cada lado, com enfeites piscando suavemente e estrelas brilhando no topo.',
            ko: '양쪽에 선 두 그루의 크리스마스 트리. 장식이 부드럽게 반짝이고 꼭대기의 별이 은은하게 빛나는 대기용 애니메이션.',
            zh: '两侧各立一棵圣诞树，饰物轻轻闪烁，树顶的星星散发柔和的光。'
        },
        author: 'QuickLog-Solo',
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'mask' };

    constructor() {
        super();
        this.width = 0;
        this.height = 0;
        // Ornament positions inside one tree, in tree units (x: -1..1
        // across the widest tier, y: 0 at the apex, 1 at the base).
        this.ornaments = [
            { x: 0.0, y: 0.3, phase: 0.0 },
            { x: -0.28, y: 0.48, phase: 1.3 },
            { x: 0.3, y: 0.52, phase: 2.6 },
            { x: -0.12, y: 0.62, phase: 3.9 },
            { x: 0.16, y: 0.7, phase: 5.2 },
            { x: -0.42, y: 0.76, phase: 0.8 },
            { x: 0.44, y: 0.8, phase: 2.1 },
            { x: -0.2, y: 0.86, phase: 3.4 },
            { x: 0.24, y: 0.9, phase: 4.7 }
        ];
        // Small stars scattered in the sky between the trees.
        this.stars = [];
        for (let i = 0; i < 8; i++) {
            this.stars.push({
                fx: 0.24 + (Math.sin(i * 197.3) * 0.5 + 0.5) * 0.52,
                fy: (Math.sin(i * 269.5) * 0.5 + 0.5) * 0.34 + 0.03,
                phase: i * 1.91,
                speed: 0.5 + (i % 3) * 0.31
            });
        }
    }

    setup(width, height) {
        this.width = width;
        this.height = height;
    }

    draw(ctx, { elapsedMs = 0 } = {}) {
        const width = this.width;
        const height = this.height;

        if (width <= 0 || height <= 0) return;

        // Base scaling factor relative to standard guide height (80px)
        const scale = Math.max(0.4, height / 80);

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';

        const groundY = height * 0.95;

        // --- 1. Twinkling stars in the sky between the trees ---
        this.drawStars(ctx, elapsedMs, scale);

        // --- 2. A faint dotted line of light on the ground ---
        this.drawGround(ctx, elapsedMs, scale, groundY);

        // --- 3. The two trees ---
        const leftX = Math.max(30 * scale, width * 0.11);
        const rightX = Math.min(width - 30 * scale, width * 0.89);
        this.drawTree(ctx, leftX, groundY, 56 * scale, elapsedMs, 0);
        this.drawTree(ctx, rightX, groundY, 47 * scale, elapsedMs, 2.4);
    }

    drawStars(ctx, elapsedMs, scale) {
        for (const star of this.stars) {
            const twinkle = 0.5 + 0.5 * Math.sin(elapsedMs * 0.001 * star.speed + star.phase);
            const alpha = 0.12 + 0.45 * twinkle;
            const r = (0.9 + twinkle * 0.7) * scale;
            const x = star.fx * this.width;
            const y = star.fy * this.height;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(x, y - r * 1.8);
            ctx.quadraticCurveTo(x, y, x + r * 1.8, y);
            ctx.quadraticCurveTo(x, y, x, y + r * 1.8);
            ctx.quadraticCurveTo(x, y, x - r * 1.8, y);
            ctx.quadraticCurveTo(x, y, x, y - r * 1.8);
            ctx.fill();
            ctx.restore();
        }
    }

    drawGround(ctx, elapsedMs, scale, groundY) {
        const step = 9 * scale;
        const count = Math.floor(this.width / step);
        for (let i = 0; i <= count; i++) {
            const shimmer = 0.5 + 0.5 * Math.sin(elapsedMs * 0.0009 + i * 0.85);
            ctx.save();
            ctx.globalAlpha = 0.1 + 0.16 * shimmer;
            ctx.beginPath();
            ctx.ellipse(i * step + step * 0.5, groundY + 2.2 * scale, 1.15 * scale, 1.15 * scale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // One tree, centred at cx with its trunk base on groundY.
    // treeHeight is the full height including the star.
    drawTree(ctx, cx, groundY, treeHeight, elapsedMs, phaseOffset) {
        const trunkH = treeHeight * 0.13;
        const foliageTop = groundY - treeHeight;
        const foliageH = treeHeight - trunkH;
        const maxHalf = treeHeight * 0.34; // half width of the widest tier

        ctx.save();
        ctx.translate(cx, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Trunk
        ctx.beginPath();
        ctx.rect(-maxHalf * 0.14, groundY - trunkH, maxHalf * 0.28, trunkH);
        ctx.fill();

        // Foliage: three overlapping tiers, each a triangle with a
        // slightly scalloped lower edge so the silhouette stays soft.
        const tiers = [
            { top: 0.0, bottom: 0.46, half: 0.52 },
            { top: 0.3, bottom: 0.72, half: 0.76 },
            { top: 0.56, bottom: 1.0, half: 1.0 }
        ];
        for (const tier of tiers) {
            const yTop = foliageTop + foliageH * tier.top;
            const yBottom = foliageTop + foliageH * tier.bottom;
            const halfW = maxHalf * tier.half;
            ctx.beginPath();
            ctx.moveTo(0, yTop);
            ctx.lineTo(halfW, yBottom);
            ctx.quadraticCurveTo(halfW * 0.45, yBottom - foliageH * 0.045, 0, yBottom);
            ctx.quadraticCurveTo(-halfW * 0.45, yBottom - foliageH * 0.045, -halfW, yBottom);
            ctx.closePath();
            ctx.fill();
        }

        // Ornaments twinkling inside the foliage
        for (const orn of this.ornaments) {
            const twinkle = 0.5 + 0.5 * Math.sin(elapsedMs * 0.0016 + orn.phase + phaseOffset);
            const x = orn.x * maxHalf;
            const y = foliageTop + foliageH * orn.y;
            const r = treeHeight * 0.028 * (0.8 + twinkle * 0.45);
            ctx.save();
            ctx.globalAlpha = 0.25 + 0.75 * twinkle;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Star on top, breathing slowly
        const breathe = 0.5 + 0.5 * Math.sin(elapsedMs * 0.0009 + phaseOffset);
        const starR = treeHeight * 0.075 * (0.85 + breathe * 0.3);
        const starY = foliageTop - starR * 0.7;
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.45 * breathe;
        ctx.beginPath();
        ctx.moveTo(0, starY - starR * 1.9);
        ctx.quadraticCurveTo(0, starY, starR * 1.9, starY);
        ctx.quadraticCurveTo(0, starY, 0, starY + starR * 1.9);
        ctx.quadraticCurveTo(0, starY, -starR * 1.9, starY);
        ctx.quadraticCurveTo(0, starY, 0, starY - starR * 1.9);
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }
}
