import { AnimationBase } from '../animation_base.js';

/**
 * Clock Animation
 * A simple circular progress indicator using a clock motif.
 * 時計をモチーフにしたシンプルな円形の進捗インジケーターです。
 */
export default class Clock extends AnimationBase {
    static metadata = {
        specVersion: '1.0',
        name: {
            en: "Clock",
            ja: "時計",
            de: "Uhr",
            es: "Reloj",
            fr: "Horloge",
            pt: "Relógio",
            ko: "시계",
            zh: "时钟"
        },
        description: {
            en: "A simple circular progress indicator using a clock motif.",
            ja: "時計をモチーフにしたシンプルな円形の進捗インジケーターです。",
            de: "Eine einfache kreisförmige Fortschrittsanzeige mit einem Uhrenmotiv.",
            es: "Un simple indicador de progreso circular que utiliza un motivo de reloj.",
            fr: "Un simple indicateur de progression circulaire utilisant un motif d'horloge.",
            pt: "Um simples indicador de progresso circular usando um motivo de relógio.",
            ko: "시계를 모티브로 한 심플한 원형 진행 표시기입니다.",
            zh: "使用时钟图案的简单圆形进度指示器。"
        },
        author: "QuickLog-Solo",
        rewindable: true
    };

    config = { mode: 'canvas', exclusionStrategy: 'mask' };

    /**
     * Initial setup and resizing
     * 初期設定およびリサイズ時の処理
     */
    setup(width, height) {
        this.width = width;
        this.height = height;

        // Calculate the radius based on current area size
        // 描画領域のサイズに基づいて半径を計算
        this.radius = Math.min(width, height) * 0.4;
    }

    /**
     * Main drawing loop
     * 描画ループ
     */
    draw(ctx, { progress, exclusionAreas = [] } = {}) {
        const width = this.width;
        const height = this.height;
        const angle = (progress || 0) * Math.PI * 2;

        // Default position: center
        // デフォルト位置：中央
        let cx = width / 2;
        let cy = height / 2;

        // Smart placement logic: avoid UI text areas if they overlap with the center
        // 回避ロジック：中央がテキスト領域と重なる場合、四隅の空いている場所を探す
        if (exclusionAreas && exclusionAreas.length > 0) {
            const margin = this.radius + 10;
            const spots = [
                {x: margin, y: margin},
                {x: width - margin, y: margin},
                {x: margin, y: height - margin},
                {x: width - margin, y: height - margin},
                {x: width / 2, y: height / 2}
            ];

            for (const spot of spots) {
                const overlap = exclusionAreas.some(area => {
                    return spot.x + this.radius > area.x && spot.x - this.radius < area.x + area.width &&
                           spot.y + this.radius > area.y && spot.y - this.radius < area.y + area.height;
                });
                if (!overlap) {
                    cx = spot.x;
                    cy = spot.y;
                    break;
                }
            }
        }

        // Draw the progress arc
        // 進捗を示す扇形の描画
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, this.radius, -Math.PI / 2, -Math.PI / 2 + angle);
        ctx.closePath();
        ctx.fill();
    }
}
