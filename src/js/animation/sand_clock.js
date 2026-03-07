import { AnimationBase } from '../animation_base.js';

/**
 * SandClock Animation
 * A digital hourglass where sand gradually flows from the top to the bottom.
 * 上から下へと砂がさらさらと落ちていく、デジタルな砂時計のアニメーションです。
 */
export default class SandClock extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Sand Clock",
            ja: "砂時計",
            de: "Sanduhr",
            es: "Reloj de arena",
            fr: "Sablier",
            pt: "Ampulheta",
            ko: "모래시계",
            zh: "沙漏"
        },
        description: {
            en: "A digital hourglass where sand gradually flows from the top to the bottom.",
            ja: "上から下へと砂がさらさらと落ちていく、デジタルな砂時計のアニメーションです。",
            de: "Eine digitale Sanduhr, bei der der Sand allmählich von oben nach unten fließt.",
            es: "Un reloj de arena digital donde la arena fluye gradualmente de arriba hacia abajo.",
            fr: "Un sablier numérique où le sable s'écoule progressivement du haut vers le bas.",
            pt: "Uma ampulheta digital onde a areia flui gradualmente do topo para o fundo.",
            ko: "모래가 위에서 아래로 서서히 흐르는 디지털 모래시계 애니메이션입니다。",
            zh: "一种数字沙漏，沙子逐渐从顶部流到底部。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', usePseudoSpace: false };

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;
        // Hourglass size / 砂時計のサイズ
        this.size = Math.min(width, height) * 0.35;
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { progress = 0, exclusionAreas = [] } = {}) {
        const width = this.width;
        const height = this.height;
        const size = this.size;

        // Find a safe spot for the hourglass (default to center)
        // 砂時計を置く安全な（UIと重ならない）場所を探す
        let centerX = width / 2;
        let centerY = height / 2;

        if (exclusionAreas && exclusionAreas.length > 0) {
            const margin = size + 15;
            const spots = [
                {x: margin, y: margin},
                {x: width - margin, y: margin},
                {x: margin, y: height - margin},
                {x: width - margin, y: height - margin},
                {x: width / 2, y: height / 2}
            ];
            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot.x + size > area.x && spot.x - size < area.x + area.width &&
                           spot.y + size > area.y && spot.y - size < area.y + area.height;
                });
                if (!overlap) {
                    centerX = spot.x;
                    centerY = spot.y;
                    break;
                }
            }
        }

        // 1. Draw Hourglass Outline
        // 1. 砂時計の外枠を描画
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY - size);
        ctx.lineTo(centerX + size, centerY - size);
        ctx.lineTo(centerX - size, centerY + size);
        ctx.lineTo(centerX + size, centerY + size);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = '#fff';

        // 2. Top triangle (sand falling)
        // 2. 上側の三角形（砂が減っていく）
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY - size);
        ctx.lineTo(centerX + size, centerY - size);
        ctx.lineTo(centerX, centerY);
        ctx.closePath();
        ctx.clip(); // Mask to triangle shape / 三角形にクリップ

        ctx.fillRect(centerX - size, centerY - size + size * progress, size * 2, size);
        ctx.restore();

        // 3. Bottom triangle (sand accumulating)
        // 3. 下側の三角形（砂が溜まっていく）
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY + size);
        ctx.lineTo(centerX + size, centerY + size);
        ctx.lineTo(centerX, centerY);
        ctx.closePath();
        ctx.clip(); // Mask to triangle shape / 三角形にクリップ

        ctx.fillRect(centerX - size, centerY + size - size * progress, size * 2, size);
        ctx.restore();

        // 4. Falling sand stream
        // 4. 落ちている最中の砂の線
        if (progress < 1.0) {
            ctx.fillRect(centerX - 1, centerY, 2, size);
        }
    }
}
